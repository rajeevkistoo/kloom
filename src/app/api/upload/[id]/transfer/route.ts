import { NextRequest, NextResponse } from 'next/server';
import { getRecording, updateRecording, getSettings } from '@/lib/firestore';
import { transferFromGcsToDrive, checkGcsFile } from '@/lib/drive';

// Allow long-running transfer operations
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Transfer video from GCS to Google Drive
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  console.log(`[Transfer] Starting transfer for recording: ${id}`);

  try {
    // Get the recording
    const recording = await getRecording(id);
    if (!recording) {
      console.log(`[Transfer] Recording not found: ${id}`);
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Check if we have a GCS path
    if (!recording.gcsPath) {
      console.log(`[Transfer] No GCS path for recording: ${id}`);
      return NextResponse.json(
        { error: 'No upload found for this recording' },
        { status: 400 }
      );
    }

    // Check if file exists in GCS
    const exists = await checkGcsFile(recording.gcsPath);
    if (!exists) {
      console.log(`[Transfer] File not found in GCS: ${recording.gcsPath}`);
      await updateRecording(id, { status: 'error' });
      return NextResponse.json(
        { error: 'Upload file not found. Please try recording again.' },
        { status: 404 }
      );
    }

    const settings = await getSettings();
    if (!settings?.driveFolderId) {
      console.log(`[Transfer] No Drive folder configured`);
      return NextResponse.json(
        { error: 'Google Drive folder not configured' },
        { status: 400 }
      );
    }

    // Update status to uploading
    await updateRecording(id, { status: 'uploading' });
    console.log(`[Transfer] Status set to uploading`);

    // Transfer from GCS to Drive
    const fileName = `${recording.title.replace(/[^a-zA-Z0-9]/g, '_')}_${id}.webm`;
    console.log(`[Transfer] Transferring to Drive as: ${fileName}`);

    const result = await transferFromGcsToDrive(
      recording.gcsPath,
      fileName,
      settings.driveFolderId
    );

    console.log(`[Transfer] Drive upload complete, fileId: ${result.fileId}`);

    // Update recording with Drive file ID and mark as ready
    await updateRecording(id, {
      driveFileId: result.fileId,
      status: 'ready',
      gcsPath: '', // Clear the GCS path since file was deleted
    });

    console.log(`[Transfer] Recording marked as ready`);

    return NextResponse.json({
      success: true,
      driveFileId: result.fileId,
      status: 'ready',
    });
  } catch (error) {
    console.error(`[Transfer] Error for ${id}:`, error);

    // Try to update status to error
    try {
      await updateRecording(id, { status: 'error' });
    } catch {
      // Ignore error update failure
    }

    const errorMessage = error instanceof Error ? error.message : 'Transfer failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
