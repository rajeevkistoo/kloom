import { NextRequest, NextResponse } from 'next/server';
import { getRecording, updateRecording, deleteRecording, incrementViewCount } from '@/lib/firestore';
import { deleteFromDrive } from '@/lib/drive';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a specific recording
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

    // Check if this is a view request (increment view count)
    const url = new URL(request.url);
    if (url.searchParams.get('view') === 'true') {
      await incrementViewCount(id);
    }

    return NextResponse.json({ recording });
  } catch (error) {
    console.error('Error getting recording:', error);
    return NextResponse.json(
      { error: 'Failed to get recording' },
      { status: 500 }
    );
  }
}

// PATCH - Update a recording (e.g., rename)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const recording = await getRecording(id);
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Only allow updating certain fields
    const allowedUpdates = ['title'] as const;
    const updates: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    await updateRecording(id, updates);

    const updatedRecording = await getRecording(id);
    return NextResponse.json({ recording: updatedRecording });
  } catch (error) {
    console.error('Error updating recording:', error);
    return NextResponse.json(
      { error: 'Failed to update recording' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a recording
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const recording = await getRecording(id);
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Delete from Google Drive if file exists
    if (recording.driveFileId) {
      try {
        await deleteFromDrive(recording.driveFileId);
      } catch (driveError) {
        console.error('Error deleting from Drive:', driveError);
        // Continue with Firestore deletion even if Drive deletion fails
      }
    }

    // Delete from Firestore
    await deleteRecording(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recording:', error);
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 }
    );
  }
}
