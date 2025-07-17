// Import Express.js
const express = require('express');
// Import dotenv to load environment variables
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const geminiApiKey = process.env.GEMINI_API_KEY;
//const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Route for GET requests
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

  // WhatsApp webhook structure
  const entry = req.body.entry && req.body.entry[0];
  const changes = entry && entry.changes && entry.changes[0];
  const message = changes && changes.value && changes.value.messages && changes.value.messages[0];
  const from = message && message.from;
  const text = message && message.text && message.text.body;

  // --- AUDIO HANDLING ---
  const audioMessage = message && message.type === 'audio' && message.audio;
  if (from && audioMessage) {
    try {
      // 1. Get the media ID from the message
      const mediaId = audioMessage.id;

      // 2. Get the media URL from WhatsApp API
      const mediaRes = await axios.get(
        `https://graph.facebook.com/v23.0/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${whatsappToken}` }
        }
      );
      const mediaUrl = mediaRes.data.url;

      // 3. Download the audio file (as a buffer)
      const audioRes = await axios.get(mediaUrl, {
        headers: { Authorization: `Bearer ${whatsappToken}` },
        responseType: 'arraybuffer'
      });
      const audioBuffer = Buffer.from(audioRes.data, 'binary');

      // 4. Save the audio file locally (optional, for debugging)
      const audioFilePath = path.join(__dirname, `audio-${mediaId}.ogg`);
      fs.writeFileSync(audioFilePath, audioBuffer);

      // 5. Read prompt.txt for instructions
      const promptPath = path.join(__dirname, 'prompt.txt');
      let prompt = '';
      try {
        prompt = fs.readFileSync(promptPath, 'utf8');
      } catch (e) {
        console.warn('prompt.txt not found or unreadable. Proceeding without prompt.');
      }

      // 6. Send the audio and prompt to Gemini (or your AI service)
      // --- PLACEHOLDER: Replace with your actual Gemini API call ---
      // Example: send audioBuffer (base64) and prompt as payload
      const geminiRes = await axios.post(
        geminiEndpoint,
        {
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'audio/ogg',
                    data: audioBuffer.toString('base64')
                  }
                },
                {
                  text: prompt + '\n\nTranscribe this Hebrew audio and translate the transcription to English. Output only the English translation.'
                }
              ]
            }
          ]
        },
        {
          headers: {
            'x-goog-api-key': geminiApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      // Adjust this line to match your Gemini API response
      const englishText = geminiRes.data.candidates && geminiRes.data.candidates[0] && geminiRes.data.candidates[0].content && geminiRes.data.candidates[0].content.parts && geminiRes.data.candidates[0].content.parts[0].text || '[Gemini response placeholder]';

      // 7. Reply to the user with the English translation
      await axios.post(
        `https://graph.facebook.com/v23.0/${whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: englishText }
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Replied with English translation to WhatsApp user:', from);

      // Optionally, clean up the audio file
      fs.unlinkSync(audioFilePath);

      res.status(200).end();
      return; // Stop further processing
    } catch (err) {
      console.error('Error processing audio message:', err.message);
      // Optionally, reply with an error message
      try {
        await axios.post(
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
        console.error('Error sending error message to user:', e.message);
      }
      res.status(200).end();
      return;
    }
  }

  if (from && text) {
    let reply;
    if (text.trim().toLowerCase() === '/help') {
      reply = 'Welcome to the Daily Halacha WhatsApp bot!\nSend /help to see this message.\nSend /daf for today\'s Daf Yomi.';
    } else if (text.trim().toLowerCase() === '/daf') {
      // Fetch Daf Yomi from Sefaria API
      try {
        const sefariaUrl = 'https://www.sefaria.org.il/api/calendars';
        console.log('Fetching Daf Yomi from:', sefariaUrl);
        const sefariaRes = await axios.get(sefariaUrl);
        console.log('Sefaria API response:', sefariaRes.data);
        const items = sefariaRes.data.calendar_items || [];
        const dafYomi = items.find(item => item.title && item.title.en === 'Daf Yomi');
        if (dafYomi && dafYomi.displayValue && dafYomi.displayValue.he && dafYomi.url) {
          const dafText = `הדף היומי להיום: ${dafYomi.displayValue.he}`;
          const dafLink = `https://sefaria.org.il/${dafYomi.url}`;
          console.log('Daf Yomi:', dafText);
          console.log('Daf Link:', dafLink);
          reply = `${dafText}\n${dafLink}`;
        } else {
          reply = 'לא נמצא דף יומי להיום.';
        }
      } catch (err) {
        console.error('Error fetching Daf Yomi:', err.message);
        if (err.response) {
          console.error('Sefaria API error response:', err.response.data);
          console.error('Sefaria API error status:', err.response.status);
          console.error('Sefaria API error headers:', err.response.headers);
        }
        reply = 'שגיאה בשליפת הדף היומי.';
      }
    } else {
      reply = "Sorry, I didn't understand that. Send /help for options.";
    }

    if (reply) {
      // Send reply via WhatsApp API
      try {
        await axios.post(
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
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});

// Local test function for debugging
async function testTranscribeAndTranslate() {
  try {
    console.log('Testing transcription and translation with sample.opus...');
    
    // Read the sample audio file
    const audioFilePath = path.join(__dirname, 'sample.opus');
    if (!fs.existsSync(audioFilePath)) {
      console.error('sample.opus not found in the current directory');
      return;
    }
    
    const audioBuffer = fs.readFileSync(audioFilePath);
    console.log('Audio file loaded, size:', audioBuffer.length, 'bytes');
    
    // Read prompt.txt for instructions
    const promptPath = path.join(__dirname, 'prompt.txt');
    let prompt = '';
    try {
      prompt = fs.readFileSync(promptPath, 'utf8');
      console.log('Prompt loaded from prompt.txt');
    } catch (e) {
      console.warn('prompt.txt not found, using default prompt');
      prompt = 'Please transcribe and translate this Hebrew audio to English.';
    }
    
    // Check if Gemini API key is available
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      return;
    }
    
    console.log('Sending to Gemini API...');
    const geminiRes = await axios.post(
      geminiEndpoint,
      {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'audio/ogg',
                  data: audioBuffer.toString('base64')
                }
              },
              {
                text: prompt + '\n\nTranscribe this Hebrew audio and translate the transcription to English. Output only the English translation.'
              }
            ]
          }
        ]
      },
      {
        headers: {
          'x-goog-api-key': geminiApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Gemini API Response:', JSON.stringify(geminiRes.data, null, 2));
    
    const englishText = geminiRes.data.candidates && geminiRes.data.candidates[0] && geminiRes.data.candidates[0].content && geminiRes.data.candidates[0].content.parts && geminiRes.data.candidates[0].content.parts[0].text || '[No text found in response]';
    
    console.log('\n=== TRANSLATION RESULT ===');
    console.log(englishText);
    console.log('=== END TRANSLATION ===\n');
    
  } catch (err) {
    console.error('Error in test function:', err.message);
    if (err.response) {
      console.error('API Error Response:', err.response.data);
      console.error('API Error Status:', err.response.status);
    }
  }
}

// Run test if command line argument is provided
if (process.argv.includes('--test')) {
  testTranscribeAndTranslate().then(() => {
    console.log('Test completed');
    process.exit(0);
  }).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}
