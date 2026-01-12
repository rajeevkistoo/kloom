'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import RecordingControls from '@/components/RecordingControls';
import UploadProgress from '@/components/UploadProgress';
import Dashboard from '@/components/Dashboard';

type View = 'dashboard' | 'record' | 'upload';

interface UploadState {
  recordingId: string;
  shareUrl: string;
}

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  const handleRecordingComplete = useCallback(async (blob: Blob, duration: number) => {
    try {
      // First, create the recording entry
      const createResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Recording ${new Date().toLocaleString()}`,
          duration,
          fileSize: blob.size,
        }),
      });

      const createData = await createResponse.json();

      if (createData.error) {
        alert(createData.error);
        setView('dashboard');
        return;
      }

      // Set upload state immediately so user can share the link
      setUploadState({
        recordingId: createData.recording.id,
        shareUrl: createData.shareUrl,
      });
      setView('upload');

      // Upload the video in the background
      await fetch(`/api/upload/${createData.recording.id}`, {
        method: 'PUT',
        body: blob,
      });
    } catch (error) {
      console.error('Error uploading recording:', error);
      alert('Failed to upload recording');
      setView('dashboard');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold">Kloom</span>
            </Link>

            <nav className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setView('dashboard');
                  setUploadState(null);
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  view === 'dashboard'
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Dashboard
              </button>
              <Link
                href="/settings"
                className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Settings
              </Link>
              {view !== 'record' && view !== 'upload' && (
                <button
                  onClick={() => setView('record')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  New Recording
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'dashboard' && <Dashboard />}

        {view === 'record' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">New Recording</h1>
              <button
                onClick={() => setView('dashboard')}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border dark:border-gray-700">
              <RecordingControls onRecordingComplete={handleRecordingComplete} />
            </div>
          </div>
        )}

        {view === 'upload' && uploadState && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Recording Complete</h1>
            <UploadProgress
              recordingId={uploadState.recordingId}
              shareUrl={uploadState.shareUrl}
              onComplete={() => {
                // Optionally refresh dashboard
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
