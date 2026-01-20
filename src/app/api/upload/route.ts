import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createRecording, getSettings } from '@/lib/firestore';
import { generateSignedUploadUrl } from '@/lib/drive';

// This endpoint creates a recording entry and returns a signed URL
// for direct client upload to GCS (bypassing Cloud Run's 32MB limit)

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

      // Generate signed URL for direct GCS upload
      const { uploadUrl, gcsPath } = await generateSignedUploadUrl(id);

      // Create initial recording entry with 'processing' status
      const recording = await createRecording({
        id,
        title: title || 'Untitled Recording',
        driveFileId: '',
        driveFolderId: settings.driveFolderId,
        duration: duration || 0,
        status: 'processing',
        fileSize: fileSize || 0,
        gcsPath, // Store the GCS path for later transfer
      });

      console.log(`[Upload] Created recording ${id}, GCS path: ${gcsPath}`);

      return NextResponse.json({
        recording,
        shareUrl: `/v/${id}`,
        uploadUrl, // Signed URL for direct GCS upload
        transferUrl: `/api/upload/${id}/transfer`, // URL to trigger GCS->Drive transfer
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

