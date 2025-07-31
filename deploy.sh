#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_ID="daily-halacha-translate"
REGION="us-central1"
SERVICE_NAME="daily-halacha-translate"

echo "🚀 Starting deployment to Google Cloud Run (Cloud Buildpacks - Free Tier Optimized)..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run: gcloud auth login"
    exit 1
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Build and push Docker image
echo "🔨 Building Docker image..."
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

echo "📤 Pushing Docker image..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Deploy to Cloud Run using Docker image
echo "🚀 Deploying to Cloud Run using Docker image..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 2 \
    --timeout 60s \
    --concurrency 80

echo "✅ Deployment completed!"
echo "💰 Free Tier Configuration:"
echo "   - Memory: 256Mi (free tier limit)"
echo "   - CPU: 1 vCPU"
echo "   - Min instances: 0 (scale to zero)"
echo "   - Max instances: 2 (free tier limit)"
echo "   - Concurrency: 80 requests per instance"
echo "🌐 Your service is available at:"
gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
echo ""
echo "📝 Note: For continuous deployment, push your changes to GitHub main branch."
echo "   The GitHub Actions workflow will automatically deploy updates." 