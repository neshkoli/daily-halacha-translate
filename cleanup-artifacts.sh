#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_ID="daily-halacha-translate"
REGION="us-central1"
SERVICE_NAME="daily-halacha-translate"

echo "🧹 Cleaning up old deployment artifacts..."

# Clean up old Cloud Build source files (keep only the most recent)
echo "📦 Cleaning Cloud Build source files..."
SOURCE_FILES=$(gsutil ls gs://${PROJECT_ID}_cloudbuild/source/ 2>/dev/null || echo "")
if [ ! -z "$SOURCE_FILES" ]; then
    # Keep only the most recent file
    RECENT_FILE=$(gsutil ls -l gs://${PROJECT_ID}_cloudbuild/source/ | sort -k2 | tail -1 | awk '{print $3}')
    OLD_FILES=$(gsutil ls gs://${PROJECT_ID}_cloudbuild/source/ | grep -v "$(basename $RECENT_FILE)")
    
    if [ ! -z "$OLD_FILES" ]; then
        echo "🗑️  Removing old Cloud Build source files..."
        echo "$OLD_FILES" | xargs -I {} gsutil rm {}
        echo "✅ Removed $(echo "$OLD_FILES" | wc -l) old source files"
    else
        echo "✅ No old Cloud Build source files to remove"
    fi
else
    echo "ℹ️  No Cloud Build source files found"
fi

# Clean up old Cloud Run source files (keep only the most recent)
echo "📦 Cleaning Cloud Run source files..."
RUN_SOURCE_FILES=$(gsutil ls gs://run-sources-${SERVICE_NAME}-${REGION}/services/${SERVICE_NAME}/ 2>/dev/null || echo "")
if [ ! -z "$RUN_SOURCE_FILES" ]; then
    # Keep only the most recent file
    RECENT_FILE=$(gsutil ls -l gs://run-sources-${SERVICE_NAME}-${REGION}/services/${SERVICE_NAME}/ | sort -k2 | tail -1 | awk '{print $3}')
    OLD_FILES=$(gsutil ls gs://run-sources-${SERVICE_NAME}-${REGION}/services/${SERVICE_NAME}/ | grep -v "$(basename $RECENT_FILE)")
    
    if [ ! -z "$OLD_FILES" ]; then
        echo "🗑️  Removing old Cloud Run source files..."
        echo "$OLD_FILES" | xargs -I {} gsutil rm {}
        echo "✅ Removed $(echo "$OLD_FILES" | wc -l) old source files"
    else
        echo "✅ No old Cloud Run source files to remove"
    fi
else
    echo "ℹ️  No Cloud Run source files found"
fi

# Clean up old Docker images (keep only the 3 most recent)
echo "🐳 Cleaning old Docker images..."
IMAGE_TAGS=$(gcloud container images list-tags gcr.io/${PROJECT_ID}/${SERVICE_NAME} --format="value(digest)" --limit=10 2>/dev/null || echo "")
if [ ! -z "$IMAGE_TAGS" ]; then
    # Keep only the 3 most recent images
    TOTAL_IMAGES=$(echo "$IMAGE_TAGS" | wc -l)
    if [ $TOTAL_IMAGES -gt 3 ]; then
        OLD_IMAGES=$(echo "$IMAGE_TAGS" | tail -n +4)
        echo "🗑️  Removing old Docker images..."
        echo "$OLD_IMAGES" | while read digest; do
            gcloud container images delete gcr.io/${PROJECT_ID}/${SERVICE_NAME}@sha256:${digest} --quiet
        done
        echo "✅ Removed $(echo "$OLD_IMAGES" | wc -l) old Docker images"
    else
        echo "✅ No old Docker images to remove (keeping $TOTAL_IMAGES images)"
    fi
else
    echo "ℹ️  No Docker images found"
fi

# Clean up old audio files (keep only files from the last 7 days)
echo "🎵 Cleaning old audio files..."
AUDIO_BUCKET="gs://daily-halacha-audio-files"
if gsutil ls $AUDIO_BUCKET >/dev/null 2>&1; then
    # Get files older than 7 days from both source-audio and tts-audio folders
    SEVEN_DAYS_AGO=$(date -d '7 days ago' +%Y-%m-%d)
    
    # Clean source-audio folder
    OLD_SOURCE_FILES=$(gsutil ls -l $AUDIO_BUCKET/source-audio/*.mp3 2>/dev/null | awk -v cutoff="$SEVEN_DAYS_AGO" '$2 < cutoff {print $3}' || echo "")
    if [ ! -z "$OLD_SOURCE_FILES" ]; then
        echo "🗑️  Removing source audio files older than 7 days..."
        echo "$OLD_SOURCE_FILES" | xargs -I {} gsutil rm {}
        echo "✅ Removed $(echo "$OLD_SOURCE_FILES" | wc -l) old source audio files"
    else
        echo "✅ No old source audio files to remove"
    fi
    
    # Clean english folder
    OLD_ENGLISH_FILES=$(gsutil ls -l $AUDIO_BUCKET/english/*.mp3 2>/dev/null | awk -v cutoff="$SEVEN_DAYS_AGO" '$2 < cutoff {print $3}' || echo "")
    if [ ! -z "$OLD_ENGLISH_FILES" ]; then
        echo "🗑️  Removing English audio files older than 7 days..."
        echo "$OLD_ENGLISH_FILES" | xargs -I {} gsutil rm {}
        echo "✅ Removed $(echo "$OLD_ENGLISH_FILES" | wc -l) old English audio files"
    else
        echo "✅ No old English audio files to remove"
    fi
else
    echo "ℹ️  Audio bucket not found"
fi

echo "✅ Cleanup completed successfully!"
echo ""
echo "📊 Summary of remaining artifacts:"
echo "   - Cloud Build source files: $(gsutil ls gs://${PROJECT_ID}_cloudbuild/source/ 2>/dev/null | wc -l)"
echo "   - Cloud Run source files: $(gsutil ls gs://run-sources-${SERVICE_NAME}-${REGION}/services/${SERVICE_NAME}/ 2>/dev/null | wc -l)"
echo "   - Docker images: $(gcloud container images list-tags gcr.io/${PROJECT_ID}/${SERVICE_NAME} --format='value(digest)' 2>/dev/null | wc -l)"
echo "   - Source audio files: $(gsutil ls gs://daily-halacha-audio-files/source-audio/*.mp3 2>/dev/null | wc -l)"
echo "   - English audio files: $(gsutil ls gs://daily-halacha-audio-files/english/*.mp3 2>/dev/null | wc -l)" 