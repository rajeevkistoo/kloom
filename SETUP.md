# Kloom Setup Guide

## Prerequisites

1. Google Cloud Project: `kloom-484017`
2. Enable the following APIs in Google Cloud Console:
   - Cloud Run API
   - Cloud Build API
   - Firestore API
   - Google Drive API

## Setup Steps

### 1. Enable Required APIs

```bash
gcloud config set project kloom-484017

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  drive.googleapis.com
```

### 2. Create Firestore Database

```bash
gcloud firestore databases create --location=us-central1
```

### 3. Set Up Service Account Permissions

The Cloud Run service account needs Drive API access. Get your service account email:

```bash
# Default compute service account format:
# 896112229376-compute@developer.gserviceaccount.com
```

### 4. Create Google Drive Folder

1. Go to Google Drive
2. Create a new folder for recordings (e.g., "Kloom Recordings")
3. Right-click the folder → Share
4. Share with your service account email: `896112229376-compute@developer.gserviceaccount.com`
5. Give it "Editor" access
6. Copy the folder ID from the URL (the part after `/folders/`)

### 5. Deploy to Cloud Run

```bash
# From the kloom directory
gcloud builds submit --config cloudbuild.yaml
```

Or deploy manually:

```bash
# Build and push
gcloud builds submit --tag gcr.io/kloom-484017/kloom

# Deploy
gcloud run deploy kloom \
  --image gcr.io/kloom-484017/kloom \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=kloom-484017"
```

### 6. Configure the App

1. Open your Cloud Run URL (e.g., `https://kloom-xxx-uc.a.run.app`)
2. Go to Settings
3. Paste your Google Drive folder ID or URL
4. Save settings

## Usage

1. Click "New Recording"
2. Select screen, webcam, and microphone options
3. Click "Start Recording"
4. When done, click "Stop Recording"
5. Copy the share link immediately
6. Video uploads in background - link works once upload completes

## Troubleshooting

### "Google Drive folder not configured"
- Go to Settings and add your Drive folder ID

### "Cannot access the specified Google Drive folder"
- Make sure you shared the folder with the service account email
- Verify the folder ID is correct

### Recording doesn't start
- Make sure you're using HTTPS (required for screen capture)
- Allow screen sharing and microphone permissions in your browser
