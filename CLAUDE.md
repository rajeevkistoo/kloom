# CLAUDE.md - Kloom Project Guide

## Project Overview

**Kloom** is a screen recording application with Google Drive integration. Users can record their screen (with optional webcam and microphone), and recordings are automatically uploaded to Google Drive for cloud storage and sharing.

## Tech Stack

- **Framework**: Next.js 16.1.1 with App Router
- **Language**: TypeScript 5
- **UI**: React 19.2.3, Tailwind CSS 4
- **Database**: Google Cloud Firestore
- **Storage**: Google Drive API
- **Runtime**: Node.js (designed for Google Cloud Run)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (needs customization)
│   ├── globals.css             # Tailwind styles
│   └── api/
│       ├── recordings/         # CRUD for recordings
│       │   ├── route.ts        # GET (list) / POST (create)
│       │   └── [id]/route.ts   # GET / PATCH / DELETE
│       ├── upload/             # File upload handling
│       │   ├── route.ts        # POST (init) / PUT (upload)
│       │   └── [id]/route.ts   # PUT / GET (status)
│       └── settings/route.ts   # GET / POST settings
├── components/
│   ├── Dashboard.tsx           # Recording list with search/edit/delete
│   ├── RecordingControls.tsx   # Recording UI with countdown/controls
│   ├── UploadProgress.tsx      # Upload status tracker
│   └── SettingsForm.tsx        # Settings configuration form
├── hooks/
│   └── useRecorder.ts          # Screen/webcam/audio recording logic
└── lib/
    ├── firestore.ts            # Firestore CRUD operations
    └── drive.ts                # Google Drive upload/share functions
```

## Key Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Data Models

### Recording
```typescript
{
  id: string;                    // 8-char unique ID
  title: string;
  driveFileId: string;
  driveFolderId: string;
  duration: number;              // seconds
  status: 'processing' | 'uploading' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  fileSize: number;              // bytes
}
```

### Settings
```typescript
{
  driveFolderId: string;
  defaultQuality: '720p' | '1080p';
  defaultMicEnabled: boolean;
  defaultWebcamEnabled: boolean;
}
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recordings` | GET | List all recordings |
| `/api/recordings` | POST | Create recording entry |
| `/api/recordings/[id]` | GET | Get recording (optionally increment view count) |
| `/api/recordings/[id]` | PATCH | Update recording (rename) |
| `/api/recordings/[id]` | DELETE | Delete from Firestore and Drive |
| `/api/upload` | POST | Initialize upload |
| `/api/upload` | PUT | Upload file |
| `/api/upload/[id]` | GET | Check upload status |
| `/api/settings` | GET/POST | Get or save settings |

## Key Patterns

1. **Client Components**: Mark with `'use client'` directive
2. **Styling**: Tailwind utility classes with `dark:` for dark mode
3. **State**: React hooks (useState, useCallback, useRef, useEffect)
4. **API**: RESTful endpoints returning JSON
5. **Uploads**: Two-phase (create entry → background upload)
6. **Sharing**: Public URLs at `/v/{recordingId}`

## Browser APIs Used

- `navigator.mediaDevices.getDisplayMedia()` - Screen capture
- `navigator.mediaDevices.getUserMedia()` - Webcam/Microphone
- `MediaRecorder` - Video encoding (VP9/WebM)
- `navigator.clipboard.writeText()` - Copy to clipboard

## Environment

- **Project ID**: `kloom-484017` (default, via `GOOGLE_CLOUD_PROJECT`)
- **Auth**: Google Cloud default service account
- **Required Permissions**: Firestore R/W, Drive API access

## Current Status

- Core recording, upload, and sharing features are implemented
- Home page (`page.tsx`) still has default Next.js template
- Components ready to be integrated into main page

## Development Notes

- Video quality options: 720p (1280x720) or 1080p (1920x1080)
- Upload status polling: 2-second intervals
- Files shared as "anyone with link can view"
- Recordings stored in user-configured Drive folder
