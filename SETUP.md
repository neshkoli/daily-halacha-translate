# Continuous Deployment Setup

This project is configured for continuous deployment to Google Cloud Run using Cloud Buildpacks and GitHub Actions.

## Prerequisites

1. **Google Cloud Project**: Ensure you have a Google Cloud project set up
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Google Cloud Service Account**: Create a service account with necessary permissions

## Setup Steps

### 1. Create Google Cloud Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding daily-halacha-translate \
    --member="serviceAccount:github-actions@daily-halacha-translate.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding daily-halacha-translate \
    --member="serviceAccount:github-actions@daily-halacha-translate.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding daily-halacha-translate \
    --member="serviceAccount:github-actions@daily-halacha-translate.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create ~/github-actions-key.json \
    --iam-account=github-actions@daily-halacha-translate.iam.gserviceaccount.com
```

### 2. Set up GitHub Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add these secrets:

- `GCP_SA_KEY`: The content of the `~/github-actions-key.json` file
- `GEMINI_API_KEY`: Your Gemini API key
- `VERIFY_TOKEN`: Your WhatsApp webhook verify token
- `WHATSAPP_TOKEN`: Your WhatsApp access token
- `WHATSAPP_PHONE_NUMBER_ID`: Your WhatsApp phone number ID

### 3. Initial Deployment

For the first deployment, you can use the local script:

```bash
./deploy.sh
```

### 4. Continuous Deployment

After the initial setup, any push to the `main` branch will automatically trigger a deployment via GitHub Actions.

## How It Works

1. **Cloud Buildpacks**: Google Cloud automatically detects your Node.js application and builds it using Cloud Buildpacks
2. **GitHub Actions**: Automatically deploys on every push to main branch
3. **Free Tier Optimized**: Configured to stay within Google Cloud Run free tier limits

## Benefits

- ✅ No local Docker builds required
- ✅ Automatic deployments on code changes
- ✅ Free tier optimized
- ✅ Simple setup and maintenance
- ✅ Automatic scaling to zero when not in use

## Environment Variables

The following environment variables are automatically set by the deployment:

- `PORT=8080`: Application port
- `GEMINI_API_KEY`: Your Gemini API key
- `VERIFY_TOKEN`: WhatsApp webhook verify token
- `WHATSAPP_TOKEN`: WhatsApp access token
- `WHATSAPP_PHONE_NUMBER_ID`: WhatsApp phone number ID

## Monitoring

- View deployment logs in GitHub Actions
- Monitor service logs: `gcloud logs read --service=$SERVICE_NAME`
- Check service status: `gcloud run services describe $SERVICE_NAME --region $REGION` 