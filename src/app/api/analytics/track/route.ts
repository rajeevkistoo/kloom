import { NextRequest, NextResponse } from 'next/server';
import {
  trackAnalyticsEvent,
  getOrCreateViewerSession,
  updateViewerSession,
  getRecording,
  AnalyticsEventType,
} from '@/lib/firestore';

export const dynamic = 'force-dynamic';

// POST - Track an analytics event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      recordingId,
      eventType,
      viewerId,
      sessionId,
      currentTime,
      duration,
    } = body;

    // Validate required fields
    if (!recordingId || !eventType || !viewerId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes: AnalyticsEventType[] = [
      'video_started',
      'video_progress',
      'video_paused',
      'video_resumed',
      'video_seeked',
      'video_ended',
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Verify recording exists
    const recording = await getRecording(recordingId);
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Get user agent and referrer from headers
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;

    // Track the event
    await trackAnalyticsEvent({
      recordingId,
      eventType,
      viewerId,
      sessionId,
      currentTime: currentTime || 0,
      duration: duration || recording.duration,
      userAgent,
      referrer,
    });

    // Get or create viewer session
    const session = await getOrCreateViewerSession(sessionId, recordingId, viewerId);

    // Update session based on event type
    const updates: Record<string, unknown> = {
      events: session.events + 1,
    };

    if (currentTime !== undefined) {
      // Update max position if current position is further
      if (currentTime > session.maxPosition) {
        updates.maxPosition = currentTime;
      }

      // Calculate completion rate
      const videoDuration = duration || recording.duration;
      if (videoDuration > 0) {
        const newMaxPosition = Math.max(session.maxPosition, currentTime);
        updates.completionRate = Math.min(100, Math.round((newMaxPosition / videoDuration) * 100));
      }

      // Estimate watched seconds (rough approximation)
      // This is updated incrementally as progress events come in
      if (eventType === 'video_progress') {
        // Assume progress events are sent every 5 seconds
        updates.watchedSeconds = Math.min(
          session.watchedSeconds + 5,
          duration || recording.duration
        );
      }
    }

    // Mark session as ended
    if (eventType === 'video_ended') {
      updates.endedAt = new Date();
      updates.completionRate = 100;
    }

    await updateViewerSession(sessionId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}
