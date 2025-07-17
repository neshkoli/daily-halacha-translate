// Import Express.js
const express = require('express');
// Import dotenv to load environment variables
require('dotenv').config();
const axios = require('axios');

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

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

  if (from && text) {
    let reply;
    if (text.trim().toLowerCase() === '/help') {
      reply = 'Welcome to the Daily Halacha WhatsApp bot!\nSend /help to see this message.\nSend /daf for today\'s Daf Yomi.';
    } else if (text.trim().toLowerCase() === '/daf') {
      // Fetch Daf Yomi from Sefaria API
      try {
        const sefariaRes = await axios.get('https://www.sefaria.org.il/api/calendars');
        const items = sefariaRes.data.calendar_items || [];
        const dafYomi = items.find(item => item.title && item.title.en === 'Daf Yomi');
        if (dafYomi && dafYomi.displayValue && dafYomi.displayValue.he && dafYomi.url) {
          reply = `הדף היומי להיום: ${dafYomi.displayValue.he}\nhttps://sefaria.org.il/${dafYomi.url}`;
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

    // Send reply via WhatsApp API
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${whatsappPhoneNumberId}/messages`,
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

  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
