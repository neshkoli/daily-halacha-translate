# Google Cloud WhatsApp Bot Architecture

## Core Architecture

```
WhatsApp Business API → Cloud Load Balancer → Cloud Run → Cloud Functions → WhatsApp API
                                               ↓
                                         Cloud Firestore
                                               ↓
                                         Cloud Logging/Monitoring
```

## Recommended Services

### 1. **Cloud Run** (Primary Webhook Endpoint)
- **Purpose**: Receive WhatsApp webhooks and handle authentication
- **Benefits**: 
  - Auto-scaling from 0 to N instances
  - Pay per request
  - HTTPS endpoints out of the box
  - Easy deployment from container images

### 2. **Cloud Functions** (Bot Logic Processing)
- **Purpose**: Process messages and generate responses
- **Benefits**:
  - Event-driven execution
  - Multiple language support (Node.js, Python, Go, Java)
  - Automatic scaling
  - Integrated with other GCP services

### 3. **Cloud Firestore** (Data Storage)
- **Purpose**: Store user sessions, conversation history, bot state
- **Benefits**:
  - NoSQL document database
  - Real-time updates
  - Automatic scaling
  - Strong consistency

### 4. **Secret Manager** (Configuration)
- **Purpose**: Store WhatsApp tokens, API keys securely
- **Benefits**:
  - Encrypted storage
  - Version management
  - IAM integration

## Detailed Architecture Flow

### Step 1: Webhook Reception (Cloud Run)
```python
# main.py - Cloud Run service
from flask import Flask, request, jsonify
import functions_framework
from google.cloud import functions_v1

app = Flask(__name__)

@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    if request.method == 'GET':
        # WhatsApp webhook verification
        return verify_webhook(request)
    
    elif request.method == 'POST':
        # Process incoming message
        webhook_data = request.get_json()
        
        # Trigger Cloud Function asynchronously
        trigger_bot_function(webhook_data)
        
        return jsonify({"status": "received"}), 200

def trigger_bot_function(data):
    # Trigger Cloud Function via HTTP or Pub/Sub
    pass
```

### Step 2: Message Processing (Cloud Functions)
```python
# Cloud Function - Bot Logic
import functions_framework
from google.cloud import firestore
from google.cloud import secretmanager
import requests

@functions_framework.http
def process_message(request):
    data = request.get_json()
    
    # Extract message details
    message = extract_message(data)
    user_id = extract_user_id(data)
    
    # Get user context from Firestore
    db = firestore.Client()
    user_doc = db.collection('users').document(user_id).get()
    
    # Process message and generate response
    response_text = generate_response(message, user_doc)
    
    # Send response via WhatsApp API
    send_whatsapp_message(user_id, response_text)
    
    # Update user state in Firestore
    update_user_state(user_id, message, response_text)
    
    return {"status": "processed"}
```

## Infrastructure Deployment

### Option 1: Terraform (Recommended)
```hcl
# terraform/main.tf
resource "google_cloud_run_service" "webhook_service" {
  name     = "whatsapp-webhook"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/whatsapp-webhook:latest"
        
        env {
          name = "FUNCTION_URL"
          value = google_cloudfunctions_function.bot_processor.https_trigger_url
        }
      }
    }
  }
}

resource "google_cloudfunctions_function" "bot_processor" {
  name        = "whatsapp-bot-processor"
  runtime     = "python39"
  
  source_archive_bucket = google_storage_bucket.function_bucket.name
  source_archive_object = google_storage_bucket_object.function_zip.name
  
  entry_point = "process_message"
  trigger {
    http_trigger {}
  }
}

resource "google_firestore_database" "bot_database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}
```

### Option 2: Google Cloud CLI Deployment
```bash
# Deploy Cloud Run
gcloud run deploy whatsapp-webhook \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FUNCTION_URL=$FUNCTION_URL

# Deploy Cloud Function
gcloud functions deploy process-message \
  --runtime python39 \
  --trigger-http \
  --entry-point process_message \
  --allow-unauthenticated

# Enable Firestore
gcloud firestore databases create --region=us-central1
```

### Option 3: Cloud Build (CI/CD)
```yaml
# cloudbuild.yaml
steps:
  # Build Cloud Run container
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/whatsapp-webhook', '.']
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/whatsapp-webhook']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'whatsapp-webhook'
      - '--image'
      - 'gcr.io/$PROJECT_ID/whatsapp-webhook'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'
  
  # Deploy Cloud Function
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'functions'
      - 'deploy'
      - 'process-message'
      - '--source'
      - './functions'
      - '--entry-point'
      - 'process_message'
      - '--runtime'
      - 'python39'
      - '--trigger-http'
```

## Project Structure
```
whatsapp-bot-gcp/
├── webhook/                 # Cloud Run service
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── functions/               # Cloud Functions
│   ├── main.py
│   └── requirements.txt
├── terraform/               # Infrastructure as Code
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── cloudbuild.yaml         # CI/CD configuration
└── README.md
```

## Security Considerations

1. **IAM Roles**: Assign minimal required permissions
2. **VPC**: Use private networking where possible
3. **Secret Manager**: Store all sensitive data
4. **SSL/TLS**: All endpoints use HTTPS
5. **Webhook Verification**: Validate Meta webhook signatures

## Cost Optimization

- **Cloud Run**: Pay per request, scales to zero
- **Cloud Functions**: 2 million free invocations/month
- **Firestore**: 1GB free storage + 20K free reads/day
- **Load Balancer**: Only if needed for high traffic

## Monitoring & Logging

- **Cloud Logging**: Automatic logging for all services
- **Cloud Monitoring**: Set up alerts for errors
- **Error Reporting**: Automatic error aggregation
- **Cloud Trace**: Request tracing across services

This architecture provides a scalable, cost-effective solution that can handle varying loads and integrates well with Google Cloud's ecosystem.