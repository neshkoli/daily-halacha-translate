#!/bin/bash

echo "💰 Google Cloud Run Cost Monitor"
echo "================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed."
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project set. Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📊 Project: $PROJECT_ID"
echo ""

# Get billing account
BILLING_ACCOUNT=$(gcloud billing accounts list --format="value(ACCOUNT_ID)" --limit=1)
if [ -n "$BILLING_ACCOUNT" ]; then
    echo "💳 Billing Account: $BILLING_ACCOUNT"
else
    echo "⚠️  No billing account found. Free tier requires a billing account."
fi
echo ""

# Check Cloud Run service status
echo "🔍 Cloud Run Service Status:"
SERVICE_URL=$(gcloud run services describe daily-halacha-translate --region us-central1 --format="value(status.url)" 2>/dev/null)
if [ -n "$SERVICE_URL" ]; then
    echo "✅ Service is running at: $SERVICE_URL"
else
    echo "❌ Service not found or not running"
fi
echo ""

# Get service configuration
echo "⚙️  Current Configuration (Free Tier Optimized):"
gcloud run services describe daily-halacha-translate --region us-central1 --format="table(
    metadata.name,
    spec.template.spec.containers[0].resources.limits.memory,
    spec.template.spec.containers[0].resources.limits.cpu,
    spec.template.metadata.annotations.'autoscaling.knative.dev/minScale',
    spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale'
)" 2>/dev/null || echo "❌ Could not retrieve service configuration"
echo ""

# Free tier limits reminder
echo "🆓 Free Tier Limits:"
echo "   • 2 million requests per month"
echo "   • 360,000 vCPU-seconds per month"
echo "   • 180,000 GiB-seconds per month"
echo "   • 1 GB network egress per month"
echo ""

# Cost estimation for typical WhatsApp bot usage
echo "📈 Estimated Usage for WhatsApp Bot:"
echo "   • ~100 requests/day = ~3,000/month (well within free tier)"
echo "   • Audio processing: ~30s per request"
echo "   • Memory usage: ~256Mi per request"
echo "   • Estimated cost: FREE (within limits)"
echo ""

# Check recent logs for activity
echo "📋 Recent Activity (last 10 log entries):"
gcloud run services logs read daily-halacha-translate --region us-central1 --limit=10 --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "❌ Could not retrieve logs"
echo ""

# Usage monitoring tips
echo "💡 Cost Monitoring Tips:"
echo "1. Set up billing alerts in Google Cloud Console"
echo "2. Monitor usage with: gcloud billing accounts describe $BILLING_ACCOUNT"
echo "3. Check service logs: gcloud run services logs read daily-halacha-translate --region us-central1"
echo "4. View service metrics in Google Cloud Console"
echo ""

# Upgrade path if needed
echo "🚀 If you exceed free tier limits:"
echo "   • Upgrade to paid tier: gcloud run services update daily-halacha-translate --region us-central1 --memory 512Mi --cpu 1 --max-instances 10"
echo "   • Monitor costs: https://console.cloud.google.com/billing"
echo "   • Set budget alerts: https://console.cloud.google.com/billing/budgets"
echo ""

echo "✅ Cost monitoring complete!" 