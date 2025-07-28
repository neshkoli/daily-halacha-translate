#!/bin/bash

# Google Cloud Logs Viewer Script
# Usage: ./view-logs.sh [option]

SERVICE_NAME="daily-halacha-translate"
REGION="us-central1"

case "${1:-recent}" in
    "recent")
        echo "📋 Recent logs (last 20 entries):"
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --limit=20 --format="table(timestamp,severity,textPayload)"
        ;;
    "tail")
        echo "🔄 Real-time log streaming (Ctrl+C to stop):"
        gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --format="table(timestamp,severity,textPayload)"
        ;;
    "errors")
        echo "❌ Error logs only:"
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" --limit=20 --format="table(timestamp,severity,textPayload)"
        ;;
    "service")
        echo "📊 Cloud Run service logs:"
        gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=20
        ;;
    "webhook")
        echo "🌐 Webhook activity logs:"
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND textPayload:\"webhook\"" --limit=20 --format="table(timestamp,severity,textPayload)"
        ;;
    "whatsapp")
        echo "📱 WhatsApp message logs:"
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND textPayload:\"WhatsApp\"" --limit=20 --format="table(timestamp,severity,textPayload)"
        ;;
    "help")
        echo "📖 Google Cloud Logs Viewer"
        echo ""
        echo "Usage: ./view-logs.sh [option]"
        echo ""
        echo "Options:"
        echo "  recent   - Show recent logs (default)"
        echo "  tail     - Real-time log streaming"
        echo "  errors   - Show error logs only"
        echo "  service  - Cloud Run service logs"
        echo "  webhook  - Webhook activity logs"
        echo "  whatsapp - WhatsApp message logs"
        echo "  help     - Show this help"
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo "Use './view-logs.sh help' for available options"
        exit 1
        ;;
esac 