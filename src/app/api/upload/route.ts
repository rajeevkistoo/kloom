import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createRecording, updateRecording, getSettings } from '@/lib/firestore';
import { uploadToDriveResumable } from '@/lib/drive';

// This endpoint handles chunked uploads for larger videos
// It creates a recording entry immediately and returns a share link
// while the actual upload happens in the background

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle the initial recording creation
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { title, duration, fileSize } = body;

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
        title: title || 'Untitled Recording',
        driveFileId: '',
        driveFolderId: settings.driveFolderId,
        duration: duration || 0,
        status: 'processing',
        fileSize: fileSize || 0,
      });

      return NextResponse.json({
        recording,
        shareUrl: `/v/${id}`,
        uploadUrl: `/api/upload/${id}`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in upload endpoint:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// Handle the actual file upload for a specific recording
export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const recordingId = url.searchParams.get('id');

    if (!recordingId) {
      return NextResponse.json(
        { error: 'Recording ID required' },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!settings?.driveFolderId) {
      return NextResponse.json(
        { error: 'Google Drive folder not configured' },
        { status: 400 }
      );
    }

    // Update status to uploading
    await updateRecording(recordingId, { status: 'uploading' });

    // Get the video data
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Drive
    const fileName = `recording_${recordingId}.webm`;
    const result = await uploadToDriveResumable(
      buffer,
      fileName,
      'video/webm',
      settings.driveFolderId
    );

    // Update recording with Drive file ID and mark as ready
    await updateRecording(recordingId, {
      driveFileId: result.fileId,
      status: 'ready',
    });

    return NextResponse.json({
      success: true,
      driveFileId: result.fileId,
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
