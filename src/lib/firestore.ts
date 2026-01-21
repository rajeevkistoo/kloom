import { Firestore } from '@google-cloud/firestore';

// Initialize Firestore
// In Cloud Run, this will use the default service account
// Locally, you need to set GOOGLE_APPLICATION_CREDENTIALS
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'kloom-484017',
});

export interface Recording {
  id: string;
  title: string;
  driveFileId: string;
  driveFolderId: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  status: 'processing' | 'uploading' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  fileSize: number; // in bytes
  gcsPath?: string; // GCS path for uploads in progress
}

export interface Settings {
  driveFolderId: string;
  defaultQuality: '720p' | '1080p' | '4k';
  defaultMicEnabled: boolean;
  defaultWebcamEnabled: boolean;
}

// Analytics event types
export type AnalyticsEventType =
  | 'video_started'
  | 'video_progress'
  | 'video_paused'
  | 'video_resumed'
  | 'video_seeked'
  | 'video_ended';

export interface AnalyticsEvent {
  id?: string;
  recordingId: string;
  eventType: AnalyticsEventType;
  timestamp: Date;
  viewerId: string; // Anonymous viewer ID (from cookie/fingerprint)
  currentTime: number; // Current playback position in seconds
  duration: number; // Total video duration
  sessionId: string; // Unique session ID for this viewing
  userAgent?: string;
  referrer?: string;
}

export interface ViewerSession {
  sessionId: string;
  recordingId: string;
  viewerId: string;
  startedAt: Date;
  endedAt?: Date;
  watchedSeconds: number; // Total unique seconds watched
  completionRate: number; // 0-100 percentage
  maxPosition: number; // Furthest point reached
  events: number; // Number of events in session
}

export interface RecordingAnalytics {
  recordingId: string;
  totalViews: number;
  uniqueViewers: number;
  avgWatchTime: number; // Average seconds watched
  avgCompletionRate: number; // 0-100 percentage
  totalWatchTime: number; // Total seconds watched across all viewers
  dropOffPoints: { time: number; count: number }[]; // Where viewers stop
}

const RECORDINGS_COLLECTION = 'recordings';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'user_settings';
const ANALYTICS_EVENTS_COLLECTION = 'analytics_events';
const VIEWER_SESSIONS_COLLECTION = 'viewer_sessions';

export async function createRecording(recording: Omit<Recording, 'createdAt' | 'updatedAt' | 'viewCount'>): Promise<Recording> {
  const now = new Date();
  const fullRecording: Recording = {
    ...recording,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
  };

  await firestore.collection(RECORDINGS_COLLECTION).doc(recording.id).set({
    ...fullRecording,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return fullRecording;
}

export async function getRecording(id: string): Promise<Recording | null> {
  const doc = await firestore.collection(RECORDINGS_COLLECTION).doc(id).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  } as Recording;
}

export async function updateRecording(id: string, updates: Partial<Recording>): Promise<void> {
  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.createdAt) {
    updateData.createdAt = updates.createdAt.toISOString();
  }

  await firestore.collection(RECORDINGS_COLLECTION).doc(id).update(updateData);
}

export async function deleteRecording(id: string): Promise<void> {
  await firestore.collection(RECORDINGS_COLLECTION).doc(id).delete();
}

export async function listRecordings(limit = 50): Promise<Recording[]> {
  const snapshot = await firestore
    .collection(RECORDINGS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    } as Recording;
  });
}

export async function incrementViewCount(id: string): Promise<void> {
  const docRef = firestore.collection(RECORDINGS_COLLECTION).doc(id);
  await firestore.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (doc.exists) {
      const currentCount = doc.data()?.viewCount || 0;
      transaction.update(docRef, {
        viewCount: currentCount + 1,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

export async function getSettings(): Promise<Settings | null> {
  const doc = await firestore.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await firestore.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).set(settings);
}

// ============================================
// Analytics Functions
// ============================================

export async function trackAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
  const docRef = firestore.collection(ANALYTICS_EVENTS_COLLECTION).doc();
  await docRef.set({
    ...event,
    id: docRef.id,
    timestamp: new Date().toISOString(),
  });
}

export async function getOrCreateViewerSession(
  sessionId: string,
  recordingId: string,
  viewerId: string
): Promise<ViewerSession> {
  const docRef = firestore.collection(VIEWER_SESSIONS_COLLECTION).doc(sessionId);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data()!;
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    } as ViewerSession;
  }

  const newSession: ViewerSession = {
    sessionId,
    recordingId,
    viewerId,
    startedAt: new Date(),
    watchedSeconds: 0,
    completionRate: 0,
    maxPosition: 0,
    events: 0,
  };

  await docRef.set({
    ...newSession,
    startedAt: newSession.startedAt.toISOString(),
  });

  return newSession;
}

export async function updateViewerSession(
  sessionId: string,
  updates: Partial<ViewerSession>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.startedAt) {
    updateData.startedAt = updates.startedAt.toISOString();
  }
  if (updates.endedAt) {
    updateData.endedAt = updates.endedAt.toISOString();
  }

  await firestore.collection(VIEWER_SESSIONS_COLLECTION).doc(sessionId).update(updateData);
}

export async function getRecordingAnalytics(recordingId: string): Promise<RecordingAnalytics> {
  // Get all sessions for this recording
  const sessionsSnapshot = await firestore
    .collection(VIEWER_SESSIONS_COLLECTION)
    .where('recordingId', '==', recordingId)
    .get();

  const sessions = sessionsSnapshot.docs.map(doc => doc.data() as ViewerSession);

  if (sessions.length === 0) {
    return {
      recordingId,
      totalViews: 0,
      uniqueViewers: 0,
      avgWatchTime: 0,
      avgCompletionRate: 0,
      totalWatchTime: 0,
      dropOffPoints: [],
    };
  }

  // Calculate metrics
  const uniqueViewerIds = new Set(sessions.map(s => s.viewerId));
  const totalWatchTime = sessions.reduce((sum, s) => sum + s.watchedSeconds, 0);
  const avgWatchTime = totalWatchTime / sessions.length;
  const avgCompletionRate = sessions.reduce((sum, s) => sum + s.completionRate, 0) / sessions.length;

  // Calculate drop-off points (where sessions ended)
  const dropOffMap = new Map<number, number>();
  sessions.forEach(session => {
    // Round to nearest 5 seconds for grouping
    const dropOffPoint = Math.floor(session.maxPosition / 5) * 5;
    dropOffMap.set(dropOffPoint, (dropOffMap.get(dropOffPoint) || 0) + 1);
  });

  const dropOffPoints = Array.from(dropOffMap.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time - b.time);

  return {
    recordingId,
    totalViews: sessions.length,
    uniqueViewers: uniqueViewerIds.size,
    avgWatchTime: Math.round(avgWatchTime),
    avgCompletionRate: Math.round(avgCompletionRate),
    totalWatchTime,
    dropOffPoints,
  };
}

export async function getViewerSessions(recordingId: string, limit = 100): Promise<ViewerSession[]> {
  const snapshot = await firestore
    .collection(VIEWER_SESSIONS_COLLECTION)
    .where('recordingId', '==', recordingId)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    } as ViewerSession;
  });
}

export { firestore };
