import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createRecording, listRecordings, getSettings } from '@/lib/firestore';
import { uploadToDriveResumable } from '@/lib/drive';

// GET - List all recordings
export async function GET() {
  try {
    const recordings = await listRecordings();
    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('Error listing recordings:', error);
    return NextResponse.json(
      { error: 'Failed to list recordings' },
      { status: 500 }
    );
  }
}

// POST - Create a new recording (upload video)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const title = (formData.get('title') as string) || 'Untitled Recording';
    const duration = parseInt(formData.get('duration') as string) || 0;

    if (!file) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    // Get settings for folder ID
    const settings = await getSettings();
    if (!settings?.driveFolderId) {
      return NextResponse.json(
        { error: 'Google Drive folder not configured. Please set up in Settings.' },
        { status: 400 }
      );
    }

    // Generate unique ID for the recording
    const id = uuidv4().slice(0, 8);

    // Create initial recording entry with 'processing' status
    const recording = await createRecording({
      id,
      title,
      driveFileId: '',
      driveFolderId: settings.driveFolderId,
      duration,
      status: 'processing',
      fileSize: file.size,
    });

    // Return immediately with the recording ID so user can share the link
    // The upload will continue in the background
    const response = NextResponse.json({
      recording,
      shareUrl: `/v/${id}`,
    });

    // Start background upload (we'll handle this differently in production)
    // For now, we'll do a synchronous upload but return early
    uploadInBackground(id, file, title, settings.driveFolderId);

    return response;
  } catch (error) {
    console.error('Error creating recording:', error);
    return NextResponse.json(
      { error: 'Failed to create recording' },
      { status: 500 }
    );
  }
}

async function uploadInBackground(
  recordingId: string,
  file: File,
  title: string,
  folderId: string
) {
  const { updateRecording } = await import('@/lib/firestore');

  try {
    // Update status to uploading
    await updateRecording(recordingId, { status: 'uploading' });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Drive
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${recordingId}.webm`;
    const result = await uploadToDriveResumable(
      buffer,
      fileName,
      'video/webm',
      folderId
    );

    // Update recording with Drive file ID and mark as ready
    await updateRecording(recordingId, {
      driveFileId: result.fileId,
      status: 'ready',
    });

    console.log(`Recording ${recordingId} uploaded successfully`);
  } catch (error) {
    console.error(`Error uploading recording ${recordingId}:`, error);
    await updateRecording(recordingId, { status: 'error' });
  }
}
