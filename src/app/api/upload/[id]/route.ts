import { NextRequest, NextResponse } from 'next/server';
import { getRecording, updateRecording, getSettings } from '@/lib/firestore';
import { uploadToDriveResumable } from '@/lib/drive';

// Next.js App Router route segment config
// Allow large request bodies for video uploads (500MB)
export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Upload video file for a specific recording
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  console.log(`[Upload] Starting upload for recording: ${id}`);

  try {
    // Verify the recording exists
    const recording = await getRecording(id);
    if (!recording) {
      console.log(`[Upload] Recording not found: ${id}`);
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    const settings = await getSettings();
    if (!settings?.driveFolderId) {
      console.log(`[Upload] No Drive folder configured`);
      return NextResponse.json(
        { error: 'Google Drive folder not configured. Please go to Settings and add your Drive folder.' },
        { status: 400 }
      );
    }

    console.log(`[Upload] Folder ID: ${settings.driveFolderId}`);

    // Update status to uploading
    await updateRecording(id, { status: 'uploading' });
    console.log(`[Upload] Status set to uploading`);

    // Get the video data
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[Upload] Received ${buffer.length} bytes`);

    if (buffer.length === 0) {
      console.log(`[Upload] Empty buffer received`);
      await updateRecording(id, { status: 'error' });
      return NextResponse.json(
        { error: 'Empty video file received' },
        { status: 400 }
      );
    }

    // Upload to Drive
    const fileName = `${recording.title.replace(/[^a-zA-Z0-9]/g, '_')}_${id}.webm`;
    console.log(`[Upload] Uploading to Drive as: ${fileName}`);

    const result = await uploadToDriveResumable(
      buffer,
      fileName,
      'video/webm',
      settings.driveFolderId
    );

    console.log(`[Upload] Drive upload complete, fileId: ${result.fileId}`);

    // Update recording with Drive file ID and mark as ready
    await updateRecording(id, {
      driveFileId: result.fileId,
      status: 'ready',
      fileSize: buffer.length,
    });

    console.log(`[Upload] Recording marked as ready`);

    return NextResponse.json({
      success: true,
      driveFileId: result.fileId,
      status: 'ready',
    });
  } catch (error) {
    console.error(`[Upload] Error for ${id}:`, error);

    // Try to update status to error
    try {
      await updateRecording(id, { status: 'error' });
    } catch {
      // Ignore error update failure
    }

    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Check upload status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const recording = await getRecording(id);

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: recording.status,
      driveFileId: recording.driveFileId,
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
