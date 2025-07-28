# Daily Halacha Translate WhatsApp Bot

A WhatsApp bot that provides daily Jewish learning content and translates Hebrew audio messages to English. Built with Node.js, Express, and Google Gemini AI, deployed on Google Cloud Run.

## Features

### 📖 Daily Learning Commands
- **`/help`** - Shows available commands
- **`/daf`** - Returns today's Daf Yomi (daily Talmud page) with a link to Sefaria

### 🎤 Audio Translation
- **Voice Messages** - Automatically transcribes Hebrew audio and translates to English
- **Real-time Processing** - Sends immediate processing notifications to users

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Cloud CLI (for deployment)
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
PORT=8080
```

### Getting API Keys

#### WhatsApp Business API
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a WhatsApp Business app
3. Get your access token and phone number ID
4. Set up webhook verification

#### Google Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Enable the Gemini API

## Usage

### Local Development

1. **Start the server**
   ```bash
   node app.js
   ```

### Deployment

The bot is deployed on Google Cloud Run for optimal performance and cost efficiency.

#### Quick Deployment

1. **Deploy using the provided script**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. **Monitor logs**
   ```bash
   chmod +x watch-logs.sh
   ./watch-logs.sh
   ```

#### Manual Deployment

1. **Build and deploy with Cloud Build**
   ```bash
   gcloud builds submit --config cloudbuild.yaml .
   ```

2. **Or deploy manually**
   ```bash
   # Build Docker image
   docker build -t gcr.io/daily-halacha-translate/app .
   
   # Push to Container Registry
   docker push gcr.io/daily-halacha-translate/app
   
   # Deploy to Cloud Run
   gcloud run deploy daily-halacha-translate \
     --image gcr.io/daily-halacha-translate/app \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated
   ```

## Project Structure

```
daily-halacha-translate/
├── app.js                 # Main application file
├── package.json           # Node.js dependencies
├── Dockerfile             # Container configuration
├── cloudbuild.yaml        # CI/CD configuration
├── deploy.sh             # Deployment script
├── watch-logs.sh         # Log monitoring script
├── prompt.txt            # AI prompt for translation
├── .dockerignore         # Docker ignore rules
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Configuration

### Free Tier Optimization

The deployment is optimized for Google Cloud Run's free tier:
- **Memory**: 256Mi
- **CPU**: 1 vCPU
- **Max Instances**: 2
- **Min Instances**: 0 (scale to zero)
- **Timeout**: 60 seconds
- **Concurrency**: 80 requests per instance

## Monitoring

### View Logs
```bash
# Real-time logs
./watch-logs.sh

# Recent logs
gcloud run services logs read daily-halacha-translate --region us-central1 --limit=20
```

### Update Environment Variables
```bash
gcloud run services update daily-halacha-translate --region us-central1 --set-env-vars KEY=value
```

## Troubleshooting

### Common Issues

1. **API Key Expired**
   - Generate new Gemini API key from Google AI Studio
   - Update environment variable in Cloud Run

2. **Webhook Verification Failed**
   - Ensure `VERIFY_TOKEN` matches your WhatsApp webhook configuration

3. **Audio Processing Fails**
   - Check Gemini API key validity
   - Verify audio format (OGG/Opus supported)

## License

This project is licensed under the MIT License. # Test deployment - Mon Jul 28 22:30:11 IDT 2025
