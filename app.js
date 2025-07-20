// Import required libraries
const express = require('express');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenAI } = require('@google/genai');
const wav = require('wav');

// Configure axios for SSL issues
const https = require('https');
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 30000
});

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Environment variables
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const geminiApiKey = process.env.GEMINI_API_KEY;

// Initialize Google GenAI
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Helper function to save WAV file
async function saveWaveFile(filename, pcmData, channels = 1, rate = 24000, sampleWidth = 2) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', resolve);
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}

// Function to transcribe and translate audio
async function transcribeAndTranslate(audioBuffer, prompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'audio/ogg',
              data: audioBuffer.toString('base64')
            }
          },
          {
            text: prompt + '\n\nTranscribe this Hebrew audio and translate the transcription to English. Output only the English translation.'
          }
        ]
      }]
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.text || '[No text found in response]';
  } catch (err) {
    console.error('Error in transcription:', err.message);
    throw err;
  }
}

// Function to generate speech from text
async function generateSpeech(text, prompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ 
        parts: [{ 
          text: prompt + '\n\n' + text 
        }] 
      }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Enceladus' },
          },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      throw new Error('No audio data received from Gemini');
    }

    return Buffer.from(data, 'base64');
  } catch (err) {
    console.error('Error in speech generation:', err.message);
    throw err;
  }
}

// Track processed messages to avoid duplicates
const processedMessages = new Set();

// Route for GET requests (webhook verification)
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests (WhatsApp webhook)
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  // Parse WhatsApp message
  const entry = req.body.entry && req.body.entry[0];
  const changes = entry && entry.changes && entry.changes[0];
  const message = changes && changes.value && changes.value.messages && changes.value.messages[0];
  const from = message && message.from;
  const text = message && message.text && message.text.body;
  const audioMessage = message && message.type === 'audio' && message.audio;

  // Handle audio messages
  if (from && audioMessage) {
    const messageId = audioMessage.id;
    
    // Check if we've already processed this message
    if (processedMessages.has(messageId)) {
      console.log('Message already processed, skipping:', messageId);
      res.status(200).end();
      return;
    }
    
    // Mark message as processed
    processedMessages.add(messageId);
    
    try {
      // Send immediate response that processing has started
      await axiosInstance.post(
        `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: '🎤 Processing your audio message... Please wait while I transcribe and translate it to English.' }
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Sent processing notification to WhatsApp user:', from);

      // Download audio from WhatsApp
      const mediaId = audioMessage.id;
      const mediaRes = await axiosInstance.get(
        `https://graph.facebook.com/v23.0/${mediaId}`,
        { headers: { Authorization: `Bearer ${whatsappToken}` } }
      );
      const mediaUrl = mediaRes.data.url;

      const audioRes = await axiosInstance.get(mediaUrl, {
        headers: { Authorization: `Bearer ${whatsappToken}` },
        responseType: 'arraybuffer'
      });
      const audioBuffer = Buffer.from(audioRes.data, 'binary');

      // Read prompt for voice instructions
      const promptPath = path.join(__dirname, 'prompt.txt');
      let prompt = '';
      try {
        prompt = fs.readFileSync(promptPath, 'utf8');
      } catch (e) {
        console.warn('prompt.txt not found, using default prompt');
        prompt = 'Please transcribe and translate this Hebrew audio to English.';
      }

      // Transcribe and translate
      const englishText = await transcribeAndTranslate(audioBuffer, prompt);

      // Skip audio generation for now - only send text translation
      console.log('Transcription and translation completed, sending as text...');
      
      // Send the translation as text
      await axiosInstance.post(
        `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: `🎤 Translation: ${englishText}` }
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Replied with text translation to WhatsApp user:', from);
      res.status(200).end();
      return;

    } catch (err) {
      console.error('Error processing audio message:', err.message);
      try {
        await axiosInstance.post(
          `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: from,
            text: { body: 'Sorry, there was an error processing your audio message.' }
          },
          {
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (e) {
        console.error('Error sending error message:', e.message);
      }
      res.status(200).end();
      return;
    }
  }

  // Handle text commands
  if (from && text) {
    let reply;
    if (text.trim().toLowerCase() === '/help') {
      reply = 'Welcome to the Daily Halacha WhatsApp bot!\nSend /help to see this message.\nSend /daf for today\'s Daf Yomi.';
    } else if (text.trim().toLowerCase() === '/daf') {
      try {
        const sefariaRes = await axiosInstance.get('https://www.sefaria.org.il/api/calendars');
        const items = sefariaRes.data.calendar_items || [];
        const dafYomi = items.find(item => item.title && item.title.en === 'Daf Yomi');
        if (dafYomi && dafYomi.displayValue && dafYomi.displayValue.he && dafYomi.url) {
          const dafText = `הדף היומי להיום: ${dafYomi.displayValue.he}`;
          const dafLink = `https://sefaria.org.il/${dafYomi.url}`;
          reply = `${dafText}\n${dafLink}`;
        } else {
          reply = 'לא נמצא דף יומי להיום.';
        }
      } catch (err) {
        console.error('Error fetching Daf Yomi:', err.message);
        reply = 'שגיאה בשליפת הדף היומי.';
      }
    } else {
      reply = "Sorry, I didn't understand that. Send /help for options.";
    }

    if (reply) {
      try {
        await axiosInstance.post(
          `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: from,
            text: { body: reply },
          },
          {
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('Replied to WhatsApp user:', from);
      } catch (err) {
        console.error('Error sending WhatsApp message:', err.response ? err.response.data : err.message);
      }
    }
  }

  res.status(200).end();
});

// Test functions for local development
async function testTranscribeAndTranslate() {
  try {
    console.log('Testing transcription and translation with sample.opus...');
    
    const audioFilePath = path.join(__dirname, 'sample.opus');
    if (!fs.existsSync(audioFilePath)) {
      console.error('sample.opus not found');
      return;
    }
    
    const audioBuffer = fs.readFileSync(audioFilePath);
    console.log('Audio file loaded, size:', audioBuffer.length, 'bytes');
    
    const promptPath = path.join(__dirname, 'prompt.txt');
    let prompt = '';
    try {
      prompt = fs.readFileSync(promptPath, 'utf8');
    } catch (e) {
      prompt = 'Please transcribe and translate this Hebrew audio to English.';
    }
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      return;
    }
    
    const englishText = await transcribeAndTranslate(audioBuffer, prompt);
    console.log('\n=== TRANSLATION RESULT ===');
    console.log(englishText);
    console.log('=== END TRANSLATION ===\n');
    
    const audioData = await generateSpeech(englishText, prompt);
    const wavPath = path.join(__dirname, 'output-audio.wav');
    const mp3Path = path.join(__dirname, 'output-audio.mp3');
    
    await saveWaveFile(wavPath, audioData);
    console.log(`WAV file saved to: ${wavPath}`);
    
    await new Promise((resolve, reject) => {
      ffmpeg(wavPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .on('end', () => {
          console.log(`MP3 conversion completed: ${mp3Path}`);
          resolve();
        })
        .on('error', reject)
        .save(mp3Path);
    });
    
  } catch (err) {
    console.error('Error in test function:', err.message);
  }
}

async function testTTSOnly() {
  try {
    console.log('Testing TTS with translation-results.txt...');
    
    const translationPath = path.join(__dirname, 'translation-results.txt');
    if (!fs.existsSync(translationPath)) {
      console.error('translation-results.txt not found');
      return;
    }
    
    const englishText = fs.readFileSync(translationPath, 'utf8');
    console.log('Translation text loaded:', englishText.substring(0, 100) + '...');
    
    const promptPath = path.join(__dirname, 'prompt.txt');
    let prompt = '';
    try {
      prompt = fs.readFileSync(promptPath, 'utf8');
    } catch (e) {
      prompt = 'Please generate audio for the following text in the voice of a 35-year-old modern Orthodox Israeli rabbi.';
    }
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      return;
    }
    
    const audioData = await generateSpeech(englishText, prompt);
    const wavPath = path.join(__dirname, 'tts-output.wav');
    const mp3Path = path.join(__dirname, 'tts-output.mp3');
    
    await saveWaveFile(wavPath, audioData);
    console.log(`WAV file saved to: ${wavPath}`);
    
    await new Promise((resolve, reject) => {
      ffmpeg(wavPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .on('end', () => {
          console.log(`MP3 conversion completed: ${mp3Path}`);
          resolve();
        })
        .on('error', reject)
        .save(mp3Path);
    });
    
  } catch (err) {
    console.error('Error in TTS test:', err.message);
  }
}

// Command line test runners
if (process.argv.includes('--test')) {
  testTranscribeAndTranslate().then(() => {
    console.log('Test completed');
    process.exit(0);
  }).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}

if (process.argv.includes('--tts-only')) {
  testTTSOnly().then(() => {
    console.log('TTS test completed');
    process.exit(0);
  }).catch(err => {
    console.error('TTS test failed:', err);
    process.exit(1);
  });
}

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
