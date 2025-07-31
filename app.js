// Import required libraries
const express = require('express');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenAI } = require('@google/genai');
const wav = require('wav');
const { Storage } = require('@google-cloud/storage');

// Configure axios for SSL issues
const https = require('https');
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 30000
});

// Initialize Google Cloud Storage
const storage = new Storage();
const bucketName = 'daily-halacha-audio-files';
const bucket = storage.bucket(bucketName);

// Function to ensure bucket exists
async function ensureBucketExists() {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log(`📦 Creating bucket: ${bucketName}`);
      await bucket.create({
        location: 'US-CENTRAL1',
        public: true
      });
      console.log(`✅ Bucket created: ${bucketName}`);
    } else {
      console.log(`✅ Bucket exists: ${bucketName}`);
    }
  } catch (error) {
    console.error('❌ Error ensuring bucket exists:', error.message);
    // Don't throw - the app can still work without storage
  }
}

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

// Function to save audio file to Google Cloud Storage
async function saveAudioToStorage(audioBuffer, originalFormat = 'opus') {
  try {
    // Create date-based filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
    const fileName = `audio_${dateStr}.mp3`;
    
    console.log(`📁 Converting and saving audio file: ${fileName}`);
    
    // Convert audio to MP3 using ffmpeg with temporary file
    const mp3Buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      
      // Create temporary input file
      const tempInputFile = `/tmp/temp_audio_${Date.now()}.${originalFormat}`;
      
      try {
        // Write audio buffer to temporary file
        fs.writeFileSync(tempInputFile, audioBuffer);
        
        ffmpeg(tempInputFile)
          .audioCodec('libmp3lame')
          .audioChannels(1) // Mono
          .audioBitrate(64) // Small size - 64kbps
          .audioFrequency(22050) // Lower frequency for smaller size
          .toFormat('mp3')
          .on('error', (err) => {
            console.error('FFmpeg conversion error:', err.message);
            // Clean up temp file
            try { fs.unlinkSync(tempInputFile); } catch (e) {}
            reject(err);
          })
          .on('end', () => {
            console.log('✅ Audio converted to MP3 successfully');
            // Clean up temp input file
            try { fs.unlinkSync(tempInputFile); } catch (e) {}
          })
          .pipe()
          .on('data', (chunk) => {
            chunks.push(chunk);
          })
          .on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          });
      } catch (writeError) {
        console.error('Error writing temp file:', writeError.message);
        reject(writeError);
      }
    });
    
    // Save to Google Cloud Storage in source-audio folder
    const file = bucket.file(`source-audio/${fileName}`);
    await file.save(mp3Buffer, {
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          uploadedAt: now.toISOString(),
          source: 'whatsapp-bot',
          originalFormat: originalFormat,
          convertedTo: 'mp3',
          audioChannels: '1',
          audioBitrate: '64kbps',
          audioFrequency: '22050Hz',
          type: 'source-audio'
        }
      }
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${file.name}`;
    
    console.log(`✅ Source audio file saved successfully: ${publicUrl}`);
    console.log(`📊 File size: ${(mp3Buffer.length / 1024).toFixed(2)} KB`);
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Error saving audio to storage:', error.message);
    throw error;
  }
}

// Function to save TTS audio file to Google Cloud Storage and return the MP3 buffer
async function saveTTSAudioToStorage(audioBuffer, fileName) {
  try {
    console.log(`🎤 Converting and saving TTS audio file: ${fileName}`);
    
    // First, save the raw PCM data as a proper WAV file
    const tempWavFile = `/tmp/temp_tts_${Date.now()}.wav`;
    
    try {
      // Save raw PCM data as proper WAV file
      await saveWaveFile(tempWavFile, audioBuffer, 1, 24000, 2);
      console.log(`📁 Created proper WAV file: ${tempWavFile}`);
      
      // Convert WAV to MP3 using ffmpeg
      const mp3Buffer = await new Promise((resolve, reject) => {
        const chunks = [];
        
        ffmpeg(tempWavFile)
          .audioCodec('libmp3lame')
          .audioChannels(1) // Mono
          .audioBitrate(128) // Higher quality for TTS
          .audioFrequency(24000) // Match TTS output frequency
          .toFormat('mp3')
          .on('error', (err) => {
            console.error('FFmpeg TTS conversion error:', err.message);
            // Clean up temp file
            try { fs.unlinkSync(tempWavFile); } catch (e) {}
            reject(err);
          })
          .pipe()
          .on('data', (chunk) => {
            chunks.push(chunk);
          })
          .on('end', () => {
            console.log('✅ TTS audio converted to MP3 successfully');
            // Clean up temp input file after conversion is complete
            try { fs.unlinkSync(tempWavFile); } catch (e) {}
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          });
      });
      
      // Save to Google Cloud Storage in english folder
      const file = bucket.file(`english/${fileName}`);
      await file.save(mp3Buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            originalFormat: 'wav',
            convertedTo: 'mp3',
            channels: '1',
            bitrate: '128kbps',
            frequency: '24000Hz',
            conversionDate: new Date().toISOString(),
            type: 'english-audio'
          }
        }
      });

      // Make the file publicly accessible
      await file.makePublic();
      
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${file.name}`;
      console.log(`✅ English audio file saved successfully: ${publicUrl}`);
      console.log(`📊 File size: ${(mp3Buffer.length / 1024).toFixed(2)} KB`);
      
      return { publicUrl, mp3Buffer };
    } catch (error) {
      console.error('❌ Error in TTS audio processing:', error.message);
      // Clean up temp file if it exists
      try { fs.unlinkSync(tempWavFile); } catch (e) {}
      throw error;
    }
  } catch (err) {
    console.error('❌ Error saving TTS audio to storage:', err.message);
    throw err;
  }
}

// Function to upload audio file to WhatsApp and get media ID
async function uploadAudioToWhatsApp(audioBuffer, fileName) {
  try {
    console.log(`📤 Uploading audio to WhatsApp: ${fileName}`);
    
    // Create form data for file upload
    const FormData = require('form-data');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', audioBuffer, {
      filename: fileName,
      contentType: 'audio/mpeg'
    });
    
    // Upload to WhatsApp
    const uploadResponse = await axiosInstance.post(
      `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${whatsappToken}`
        }
      }
    );
    
    const mediaId = uploadResponse.data.id;
    console.log(`✅ Audio uploaded to WhatsApp with media ID: ${mediaId}`);
    return mediaId;
    
  } catch (err) {
    console.error('❌ Error uploading audio to WhatsApp:', err.message);
    throw err;
  }
}

// Function to send audio message via WhatsApp
async function sendAudioMessage(to, mediaId) {
  try {
    console.log(`📱 Sending audio message to ${to} with media ID: ${mediaId}`);
    
    const response = await axiosInstance.post(
      `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'audio',
        audio: {
          id: mediaId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Audio message sent successfully to ${to}`);
    return response.data;
    
  } catch (err) {
    console.error('❌ Error sending audio message:', err.message);
    throw err;
  }
}

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

// Function to get Hebrew date
async function getHebrewDate() {
  try {
    // Use hebcal API for accurate Hebrew date
    const response = await axiosInstance.get('https://www.hebcal.com/converter', {
      params: {
        cfg: 'json',
        date: new Date().toISOString().split('T')[0],
        g2h: 1
      }
    });
    
    if (response.data && response.data.hebrew) {
      return response.data.hebrew;
    } else {
      throw new Error('No Hebrew date data received from hebcal API');
    }
  } catch (err) {
    console.error('Error fetching Hebrew date from hebcal:', err.message);
    
    // Fallback: try Sefaria Tanya Yomi (day and month only)
    try {
      const sefariaResponse = await axiosInstance.get('https://www.sefaria.org.il/api/calendars');
      const items = sefariaResponse.data.calendar_items || [];
      const tanyaYomi = items.find(item => item.title && item.title.en === 'Tanya Yomi');
      
      if (tanyaYomi && tanyaYomi.displayValue && tanyaYomi.displayValue.he) {
        // Add current Hebrew year to Tanya Yomi date
        const currentYear = new Date().getFullYear() - 3760; // Approximate Hebrew year
        return `${tanyaYomi.displayValue.he} תשפ״ה`;
      }
    } catch (sefariaErr) {
      console.error('Error fetching from Sefaria fallback:', sefariaErr.message);
    }
    
    // Final fallback: return error message
    return 'לא ניתן לקבל תאריך עברי';
  }
}

// Track processed messages to avoid duplicates
const processedMessages = new Set();

// Clean up old messages every 30 minutes to prevent memory leaks (optimized for free tier)
setInterval(() => {
  const oldSize = processedMessages.size;
  processedMessages.clear();
  console.log(`Cleaned up ${oldSize} processed message IDs`);
  
  // Log memory usage for monitoring
  const memUsage = process.memoryUsage();
  console.log(`Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used, ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB total`);
}, 30 * 60 * 1000); // Clean up every 30 minutes

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

  // Early duplicate detection - check immediately after parsing
  let messageId = null;
  if (audioMessage) {
    messageId = audioMessage.id;
    console.log('Processing audio message with ID:', messageId);
  } else if (text) {
    // For text messages, create a unique ID based on content and sender
    // Use a 5-minute window to allow for retries but prevent immediate duplicates
    const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute windows
    messageId = `${from}-${text.trim()}-${timeWindow}`;
    console.log('Processing text message with ID:', messageId);
  }

  // Check if we've already processed this message
  if (messageId && processedMessages.has(messageId)) {
    console.log('Message already processed, skipping:', messageId);
    res.status(200).end();
    return;
  }

  // Mark message as processed immediately
  if (messageId) {
    processedMessages.add(messageId);
    console.log('Marked message as processed:', messageId);
  }

  // Handle audio messages
  if (from && audioMessage) {
    
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

      console.log(`📥 Downloading audio file from WhatsApp...`);
      const audioRes = await axiosInstance.get(mediaUrl, {
        headers: { Authorization: `Bearer ${whatsappToken}` },
        responseType: 'arraybuffer',
        timeout: 60000 // 60 second timeout for large files
      });
      const audioBuffer = Buffer.from(audioRes.data, 'binary');
      
      console.log(`📊 Downloaded audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Check if file is too large (WhatsApp has 16MB limit, but we'll be conservative)
      if (audioBuffer.length > 15 * 1024 * 1024) { // 15MB
        throw new Error('Audio file is too large (over 15MB). Please send a shorter audio message.');
      }

      // Create date-based filename for both source and TTS audio
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
      const fileName = `audio_${dateStr}.mp3`;

      // Save source audio file to Google Cloud Storage
      let sourceAudioFileUrl = null;
      try {
        sourceAudioFileUrl = await saveAudioToStorage(audioBuffer, 'opus');
        console.log(`📁 Source audio file URL: ${sourceAudioFileUrl}`);
      } catch (storageError) {
        console.error('Warning: Failed to save source audio to storage:', storageError.message);
        // Continue processing even if storage fails
      }

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
      let englishText = await transcribeAndTranslate(audioBuffer, prompt);

      // Generate TTS from the original audio using the same prompt
      console.log('🎤 Generating TTS from original audio...');
      let ttsAudioFileUrl = null;
      let audioMediaId = null;
      try {
        // Check if the transcribed text is too long (to avoid memory issues)
        if (englishText.length > 1000) {
          console.log('⚠️  Text is very long, truncating for TTS to avoid memory issues');
          const truncatedText = englishText.substring(0, 1000) + '...';
          console.log(`📝 Original length: ${englishText.length} chars, truncated to: ${truncatedText.length} chars`);
          englishText = truncatedText;
        }
        
        // Generate speech from the original audio (we'll use the audio buffer as input)
        // For TTS, we'll use the transcribed text as input to generate speech
        const ttsPrompt = 'Please generate audio for the following text in the voice of a 35-year-old modern Orthodox Israeli rabbi.';
        const ttsAudioData = await generateSpeech(englishText, ttsPrompt);
        
        // Save TTS audio to storage and get MP3 buffer
        const ttsResult = await saveTTSAudioToStorage(ttsAudioData, fileName);
        ttsAudioFileUrl = ttsResult.publicUrl;
        console.log(`🎤 TTS audio file URL: ${ttsAudioFileUrl}`);
        
        // Upload audio to WhatsApp and get media ID
        audioMediaId = await uploadAudioToWhatsApp(ttsResult.mp3Buffer, fileName);
        console.log(`📤 Audio uploaded to WhatsApp with media ID: ${audioMediaId}`);
        
      } catch (ttsError) {
        console.error('Warning: Failed to generate or save TTS audio:', ttsError.message);
        // Continue processing even if TTS fails
      }

      console.log('Transcription, translation, and TTS completed...');
      
      // Send the translation text first
      const messageBody = `🎤 Translation:\n${englishText}`;
      
      await axiosInstance.post(
        `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: messageBody }
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Sent text translation to WhatsApp user:', from);
      
      // Send the English audio as an audio message if available
      if (audioMediaId) {
        try {
          await sendAudioMessage(from, audioMediaId);
          console.log('Sent English audio message to WhatsApp user:', from);
        } catch (audioError) {
          console.error('Warning: Failed to send audio message:', audioError.message);
          // Send fallback text with link
          await axiosInstance.post(
            `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
            {
              messaging_product: 'whatsapp',
              to: from,
              text: { body: `🎵 English Audio: ${ttsAudioFileUrl}` }
            },
            {
              headers: {
                Authorization: `Bearer ${whatsappToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      }
      res.status(200).end();
      return;

    } catch (err) {
      console.error('Error processing audio message:', err.message);
      try {
        // Create a user-friendly error message
        let errorMessage = 'Sorry, there was an error processing your audio message.';
        
        // If it's a Gemini API error, provide more specific information
        if (err.message && err.message.includes('model is overloaded')) {
          errorMessage = 'The AI service is currently busy. Please try again in a few minutes.';
        } else if (err.message && err.message.includes('UNAVAILABLE')) {
          errorMessage = 'The AI service is temporarily unavailable. Please try again later.';
        } else if (err.message) {
          // Include the actual error message for debugging
          errorMessage = `Error: ${err.message}`;
        }
        
        await axiosInstance.post(
          `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: from,
            text: { body: errorMessage }
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
      reply = 'Welcome to the Daily Halacha WhatsApp bot!\n\nAvailable commands:\n/help - Show this message\n/daf - Today\'s Daf Yomi\n/date - Today\'s Hebrew date';
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
    } else if (text.trim().toLowerCase() === '/date') {
      try {
        const hebrewDate = await getHebrewDate();
        reply = `התאריך היומי: ${hebrewDate}`;
      } catch (err) {
        console.error('Error fetching Hebrew date:', err.message);
        reply = 'שגיאה בשליפת התאריך היומי.';
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



// Start the server
app.listen(port, async () => {
  console.log(`\nListening on port ${port}\n`);
  
  // Initialize Google Cloud Storage bucket
  await ensureBucketExists();
});
