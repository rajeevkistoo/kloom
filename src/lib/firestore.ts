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

const RECORDINGS_COLLECTION = 'recordings';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'user_settings';

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

export { firestore };
