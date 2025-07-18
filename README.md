# Daily Halacha Translate WhatsApp Bot

A WhatsApp bot that provides daily Jewish learning content and translates Hebrew audio messages to English. Built with Node.js, Express, and Google Gemini AI.

## Features

### 📖 Daily Learning Commands
- **`/help`** - Shows available commands
- **`/daf`** - Returns today's Daf Yomi (daily Talmud page) with a link to Sefaria

### 🎤 Audio Translation
- **Voice Messages** - Automatically transcribes Hebrew audio and translates to English
- **TTS Generation** - Converts English translations to speech using AI voice synthesis

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- ffmpeg (for audio processing)
- WhatsApp Business API access
- Google Gemini API key

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/neshkoli/daily-halacha-translate.git
   cd daily-halacha-translate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install ffmpeg** (for audio processing)
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# WhatsApp Business API
WHATSAPP_TOKEN=your_whatsapp_business_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
VERIFY_TOKEN=your_webhook_verify_token

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=3000
```

### Getting API Keys

#### WhatsApp Business API
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a WhatsApp Business app
3. Get your access token and phone number ID
4. Set up webhook verification

#### Google Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Enable the Gemini API

## Usage

### Local Development

1. **Start the server**
   ```bash
   node app.js
   ```

2. **Test audio transcription locally**
   ```bash
   node app.js --test
   ```
   This will process `sample.opus` and generate `output-audio.mp3`

### Deployment

The bot is designed to run on Render.com or similar cloud platforms.

1. **Deploy to Render**
   - Connect your GitHub repository
   - Set environment variables in Render dashboard
   - Deploy automatically

2. **Webhook Setup**
   - Set webhook URL: `https://your-app.onrender.com/`
   - Verify token: Use your `VERIFY_TOKEN` value

## API Endpoints

### GET `/`
- **Purpose**: Webhook verification for WhatsApp
- **Parameters**: `hub.mode`, `hub.challenge`, `hub.verify_token`
- **Response**: Challenge string for verification

### POST `/`
- **Purpose**: Handle WhatsApp webhook messages
- **Supports**: Text commands and audio messages
- **Response**: WhatsApp messages sent back to users

## Commands

### Text Commands

| Command | Description | Example Response |
|---------|-------------|------------------|
| `/help` | Show available commands | Welcome message with command list |
| `/daf` | Get today's Daf Yomi | Hebrew daf name + Sefaria link |

### Audio Messages

When users send voice messages:
1. Audio is downloaded from WhatsApp
2. Sent to Gemini AI for transcription and translation
3. English text is converted to speech using TTS
4. MP3 audio file is generated

## File Structure

```
daily-halacha-translate/
├── app.js              # Main application file
├── package.json        # Dependencies and scripts
├── prompt.txt          # Voice instructions for TTS
├── sample.opus         # Sample audio for testing
├── .env               # Environment variables (create this)
└── README.md          # This file
```

## Dependencies

- **express**: Web server framework
- **axios**: HTTP client for API calls
- **dotenv**: Environment variable management
- **fluent-ffmpeg**: Audio processing (optional)

## Configuration Files

### prompt.txt
Contains voice instructions for the TTS system, describing the desired voice characteristics for the English audio output.

### sample.opus
A sample Hebrew audio file for testing the transcription and translation functionality.

## Troubleshooting

### Common Issues

1. **"Cannot find module 'dotenv'"**
   - Run `npm install` to install dependencies

2. **"Invalid OAuth access token"**
   - Check your `WHATSAPP_TOKEN` environment variable
   - Ensure the token is valid and has proper permissions

3. **"Object with ID 'undefined' does not exist"**
   - Verify `WHATSAPP_PHONE_NUMBER_ID` is set correctly
   - Check that the phone number ID exists in your WhatsApp Business app

4. **FFmpeg errors**
   - Ensure ffmpeg is installed: `brew install ffmpeg`
   - Check that ffmpeg is in your system PATH

5. **Gemini API errors**
   - Verify your `GEMINI_API_KEY` is correct
   - Check that the API key has proper permissions
   - Ensure you're using the correct API endpoint

### Debug Mode

Run with debug logging:
```bash
DEBUG=* node app.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review WhatsApp Business API documentation
- Review Google Gemini API documentation

## Acknowledgments

- [Sefaria](https://sefaria.org.il/) for providing the Daf Yomi API
- [Google Gemini](https://aistudio.google.com/) for AI transcription and translation
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp) for messaging platform 