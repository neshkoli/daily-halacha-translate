# Migration Guide: Render.com to Google Cloud Run (Free Tier Optimized)

This guide will help you migrate your WhatsApp bot from Render.com to Google Cloud Run while staying within the free tier and minimizing costs.

## 🆓 Google Cloud Run Free Tier Limits

**Monthly Free Tier Includes:**
- **2 million requests** per month
- **360,000 vCPU-seconds** per month
- **180,000 GiB-seconds** per month
- **1 GB network egress** per month

**Our Configuration:**
- **Memory**: 256Mi (free tier limit)
- **CPU**: 0.5 vCPU (free tier limit)
- **Min instances**: 0 (scale to zero for cost savings)
- **Max instances**: 2 (free tier limit)
- **Timeout**: 60s (optimized for free tier)

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

3. **Enable required APIs** (all free):
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
  --set-env-vars GEMINI_API_KEY=your_gemini_api_key
```

## Step 4: Deploy to Google Cloud Run (Free Tier Optimized)

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

# Deploy to Cloud Run (Free Tier Optimized)
gcloud run deploy daily-halacha-translate \
  --image gcr.io/daily-halacha-translate/daily-halacha-translate \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 0.5 \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 60s \
  --concurrency 80
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

| Feature | Render.com | Google Cloud Run (Free) |
|---------|------------|-------------------------|
| **Port** | `process.env.PORT` | `process.env.PORT` (8080) |
| **Memory** | 512MB | 256Mi (free tier) |
| **CPU** | 0.5 vCPU | 0.5 vCPU (free tier) |
| **Timeout** | 30s | 60s |
| **Scaling** | Auto | Auto (0-2 instances) |
| **Cost** | $7/month | **FREE** (within limits) |
| **Requests** | Unlimited | 2M/month free |

## 💰 Cost Optimization Strategies

### 1. **Stay Within Free Tier**
- **Memory**: 256Mi (free tier limit)
- **CPU**: 0.5 vCPU (free tier limit)
- **Max instances**: 2 (free tier limit)
- **Scale to zero**: Enabled (no cost when idle)

### 2. **Monitor Usage**
```bash
# Check your current usage
gcloud billing accounts list
gcloud billing accounts describe ACCOUNT_ID

# Set up billing alerts
# Go to Google Cloud Console → Billing → Budgets & Alerts
```

### 3. **Optimize for WhatsApp Usage**
- **Concurrency**: 80 requests per instance (optimized for WhatsApp)
- **Timeout**: 60s (sufficient for audio processing)
- **Memory**: 256Mi (adequate for your workload)

### 4. **Free Tier Limits for Your Use Case**
- **2M requests/month**: ~66K requests/day (plenty for WhatsApp bot)
- **360K vCPU-seconds**: ~10 hours/day of continuous usage
- **180K GiB-seconds**: ~20 hours/day of memory usage

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

5. **Out of free tier**:
```bash
# Check usage
gcloud billing accounts describe ACCOUNT_ID

# Consider upgrading to paid tier if needed
gcloud run services update daily-halacha-translate \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10
```

### Useful Commands:

```bash
# View service details
gcloud run services describe daily-halacha-translate --region us-central1

# View logs
gcloud run services logs read daily-halacha-translate --region us-central1

# Update environment variables
gcloud run services update daily-halacha-translate --region us-central1 --set-env-vars KEY=value

# Check billing
gcloud billing accounts list
gcloud billing accounts describe ACCOUNT_ID

# Monitor usage
gcloud run services describe daily-halacha-translate --region us-central1 --format="value(status.url)"
```

## 🚨 Important Free Tier Notes

1. **Billing Account Required**: Even for free tier, you need a billing account
2. **Usage Monitoring**: Set up billing alerts to avoid surprises
3. **Scale to Zero**: Your service will scale to zero when not in use (no cost)
4. **Cold Starts**: First request after idle period may be slower
5. **Network Egress**: 1GB free per month (sufficient for WhatsApp webhooks)

## Security Best Practices

1. **Use Secret Manager** for sensitive environment variables (free tier available)
2. **Enable Cloud Audit Logs** for monitoring (free)
3. **Set up proper IAM roles** for team members
4. **Use VPC Connector** if needed for private networking

## Support

- **Google Cloud Documentation**: https://cloud.google.com/run/docs
- **Free Tier Documentation**: https://cloud.google.com/free/docs
- **Google Cloud Support**: Available with billing account
- **Community**: Stack Overflow with `google-cloud-run` tag 