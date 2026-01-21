import { NextRequest, NextResponse } from 'next/server';
import {
  getRecordingAnalytics,
  getViewerSessions,
  getRecording,
} from '@/lib/firestore';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get analytics for a recording
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify recording exists
    const recording = await getRecording(id);
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Check if detailed sessions are requested
    const url = new URL(request.url);
    const includeSessions = url.searchParams.get('sessions') === 'true';
    const sessionLimit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Get analytics summary
    const analytics = await getRecordingAnalytics(id);

    // Optionally include detailed sessions
    let sessions;
    if (includeSessions) {
      sessions = await getViewerSessions(id, sessionLimit);
    }

    return NextResponse.json({
      analytics,
      sessions,
      recording: {
        id: recording.id,
        title: recording.title,
        duration: recording.duration,
        viewCount: recording.viewCount,
        createdAt: recording.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
