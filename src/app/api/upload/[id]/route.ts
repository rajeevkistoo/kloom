import { NextRequest, NextResponse } from 'next/server';
import { getRecording, updateRecording, getSettings } from '@/lib/firestore';
import { uploadToDriveResumable } from '@/lib/drive';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Upload video file for a specific recording
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify the recording exists
    const recording = await getRecording(id);
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
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
    await updateRecording(id, { status: 'uploading' });

    // Get the video data
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Drive
    const fileName = `${recording.title.replace(/[^a-zA-Z0-9]/g, '_')}_${id}.webm`;
    const result = await uploadToDriveResumable(
      buffer,
      fileName,
      'video/webm',
      settings.driveFolderId
    );

    // Update recording with Drive file ID and mark as ready
    await updateRecording(id, {
      driveFileId: result.fileId,
      status: 'ready',
      fileSize: buffer.length,
    });

    return NextResponse.json({
      success: true,
      driveFileId: result.fileId,
      status: 'ready',
    });
  } catch (error) {
    console.error('Error uploading video:', error);

    // Try to update status to error
    try {
      const { id } = await params;
      await updateRecording(id, { status: 'error' });
    } catch {
      // Ignore error update failure
    }

    return NextResponse.json(
      { error: 'Upload failed' },
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
