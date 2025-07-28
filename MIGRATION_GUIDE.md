# Migration Guide: Render.com to Google Cloud Run

This guide will help you migrate your WhatsApp bot from Render.com to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account**: You need a Google Cloud account with billing enabled
2. **Google Cloud CLI**: Install the gcloud CLI tool
3. **Docker**: Install Docker Desktop or Docker Engine
4. **Git**: Ensure your code is in a Git repository

## Step 1: Install Google Cloud CLI

### macOS (using Homebrew):
```bash
brew install google-cloud-sdk
```

### Manual installation:
Download from: https://cloud.google.com/sdk/docs/install

## Step 2: Set up Google Cloud Project

1. **Create a new project** (or use existing):
```bash
gcloud projects create daily-halacha-translate --name="Daily Halacha Translate"
```

2. **Set the project as default**:
```bash
gcloud config set project daily-halacha-translate
```

3. **Enable required APIs**:
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

4. **Authenticate with Google Cloud**:
```bash
gcloud auth login
gcloud auth configure-docker
```

## Step 3: Configure Environment Variables

You'll need to set up your environment variables in Google Cloud Run. You can do this via the console or CLI:

### Option A: Using Google Cloud Console
1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Create a new service
3. In the "Variables & Secrets" section, add your environment variables:
   - `VERIFY_TOKEN`
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `GEMINI_API_KEY`
   - `PORT=8080`

### Option B: Using gcloud CLI
```bash
gcloud run services update daily-halacha-translate \
  --set-env-vars VERIFY_TOKEN=your_verify_token \
  --set-env-vars WHATSAPP_TOKEN=your_whatsapp_token \
  --set-env-vars WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id \
  --set-env-vars GEMINI_API_KEY=your_gemini_api_key \
  --set-env-vars PORT=8080
```

## Step 4: Deploy to Google Cloud Run

### Option A: Using the deployment script (Recommended)
1. **Update the PROJECT_ID** in `deploy.sh`:
```bash
# Edit deploy.sh and change:
PROJECT_ID="your-gcp-project-id"
# to:
PROJECT_ID="daily-halacha-translate"
```

2. **Run the deployment script**:
```bash
./deploy.sh
```

### Option B: Manual deployment
```bash
# Build and push the Docker image
docker build -t gcr.io/daily-halacha-translate/daily-halacha-translate .
docker push gcr.io/daily-halacha-translate/daily-halacha-translate

# Deploy to Cloud Run
gcloud run deploy daily-halacha-translate \
  --image gcr.io/daily-halacha-translate/daily-halacha-translate \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300s
```

## Step 5: Update WhatsApp Webhook URL

1. **Get your Cloud Run service URL**:
```bash
gcloud run services describe daily-halacha-translate --region us-central1 --format="value(status.url)"
```

2. **Update your WhatsApp webhook**:
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Navigate to your WhatsApp app
   - Update the webhook URL to your new Cloud Run URL
   - Example: `https://daily-halacha-translate-xxxxx-uc.a.run.app`

## Step 6: Test the Migration

1. **Test the webhook verification**:
```bash
curl "https://your-cloud-run-url.com/?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_verify_token"
```

2. **Send a test message** to your WhatsApp bot

3. **Check the logs**:
```bash
gcloud run services logs read daily-halacha-translate --region us-central1
```

## Step 7: Set up Continuous Deployment (Optional)

### Using Cloud Build:
1. **Connect your GitHub repository** to Cloud Build
2. **Create a trigger** that builds and deploys on push to main branch
3. **Use the provided `cloudbuild.yaml`** file

### Manual trigger:
```bash
gcloud builds submit --config cloudbuild.yaml .
```

## Step 8: Clean up Render.com

Once you've confirmed everything is working on Google Cloud Run:

1. **Stop your Render.com service**
2. **Update your DNS** if you're using a custom domain
3. **Monitor the logs** for a few days to ensure stability

## Configuration Comparison

| Feature | Render.com | Google Cloud Run |
|---------|------------|------------------|
| **Port** | `process.env.PORT` | `process.env.PORT` (8080) |
| **Memory** | 512MB | 512Mi |
| **CPU** | 0.5 vCPU | 1 vCPU |
| **Timeout** | 30s | 300s |
| **Scaling** | Auto | Auto (0-10 instances) |
| **Cost** | $7/month | Pay per use (~$5-15/month) |

## Troubleshooting

### Common Issues:

1. **Authentication errors**:
```bash
gcloud auth login
gcloud auth configure-docker
```

2. **Permission errors**:
```bash
gcloud projects add-iam-policy-binding daily-halacha-translate \
  --member="user:your-email@gmail.com" \
  --role="roles/run.admin"
```

3. **Service not starting**:
```bash
gcloud run services logs read daily-halacha-translate --region us-central1
```

4. **Environment variables not set**:
```bash
gcloud run services describe daily-halacha-translate --region us-central1
```

### Useful Commands:

```bash
# View service details
gcloud run services describe daily-halacha-translate --region us-central1

# View logs
gcloud run services logs read daily-halacha-translate --region us-central1

# Update environment variables
gcloud run services update daily-halacha-translate --region us-central1 --set-env-vars KEY=value

# Scale the service
gcloud run services update daily-halacha-translate --region us-central1 --max-instances 20
```

## Cost Optimization

1. **Set minimum instances to 0** for cost savings
2. **Use appropriate memory/CPU** for your workload
3. **Monitor usage** in Google Cloud Console
4. **Set up billing alerts** to avoid surprises

## Security Best Practices

1. **Use Secret Manager** for sensitive environment variables
2. **Enable Cloud Audit Logs** for monitoring
3. **Set up proper IAM roles** for team members
4. **Use VPC Connector** if needed for private networking

## Support

- **Google Cloud Documentation**: https://cloud.google.com/run/docs
- **Google Cloud Support**: Available with billing account
- **Community**: Stack Overflow with `google-cloud-run` tag 