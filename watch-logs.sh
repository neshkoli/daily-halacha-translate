#!/bin/bash

echo "🔍 Cloud Run Log Monitor"
echo "========================="
echo "Service: daily-halacha-translate"
echo "Region: us-central1"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "=== $(date) ==="
    echo "📋 Recent logs (last 10 entries):"
    echo ""
    
    gcloud run services logs read daily-halacha-translate --region us-central1 --limit=10 --format="table(timestamp,severity,textPayload)" 2>/dev/null || echo "No logs found"
    
    echo ""
    echo "🔄 Refreshing in 10 seconds... (Press Ctrl+C to stop)"
    sleep 10
done 