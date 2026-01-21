'use client';

import { useState, useEffect, useCallback } from 'react';

interface RecordingAnalytics {
  recordingId: string;
  totalViews: number;
  uniqueViewers: number;
  avgWatchTime: number;
  avgCompletionRate: number;
  totalWatchTime: number;
  dropOffPoints: { time: number; count: number }[];
}

interface ViewerSession {
  sessionId: string;
  viewerId: string;
  startedAt: string;
  endedAt?: string;
  watchedSeconds: number;
  completionRate: number;
  maxPosition: number;
}

interface RecordingInfo {
  id: string;
  title: string;
  duration: number;
  viewCount: number;
  createdAt: string;
}

interface AnalyticsProps {
  recordingId: string;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Analytics({ recordingId, onClose }: AnalyticsProps) {
  const [analytics, setAnalytics] = useState<RecordingAnalytics | null>(null);
  const [sessions, setSessions] = useState<ViewerSession[]>([]);
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/${recordingId}?sessions=true&limit=50`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setAnalytics(data.analytics);
        setSessions(data.sessions || []);
        setRecording(data.recording);
      }
    } catch (err) {
      setError('Failed to load analytics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [recordingId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-4xl w-full mx-4">
          <p className="text-red-500 text-center">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto block"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Analytics</h2>
            {recording && (
              <p className="text-sm text-gray-500 mt-1">{recording.title}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {analytics && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Views</p>
                <p className="text-2xl font-bold mt-1">{analytics.totalViews}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Unique Viewers</p>
                <p className="text-2xl font-bold mt-1">{analytics.uniqueViewers}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Watch Time</p>
                <p className="text-2xl font-bold mt-1">{formatDuration(analytics.avgWatchTime)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Completion</p>
                <p className="text-2xl font-bold mt-1">{analytics.avgCompletionRate}%</p>
              </div>
            </div>

            {/* Drop-off Chart */}
            {analytics.dropOffPoints.length > 0 && recording && (
              <div className="mb-8">
                <h3 className="font-semibold mb-4">Viewer Drop-off</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                  <div className="relative h-32">
                    {/* Simple bar chart for drop-off points */}
                    <div className="flex items-end justify-between h-full space-x-1">
                      {analytics.dropOffPoints.map((point, index) => {
                        const maxCount = Math.max(...analytics.dropOffPoints.map(p => p.count));
                        const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
                        const percentage = recording.duration > 0
                          ? Math.round((point.time / recording.duration) * 100)
                          : 0;

                        return (
                          <div
                            key={index}
                            className="flex-1 flex flex-col items-center"
                            title={`${point.count} viewers dropped at ${formatDuration(point.time)} (${percentage}%)`}
                          >
                            <div
                              className="w-full bg-red-400 dark:bg-red-500 rounded-t"
                              style={{ height: `${height}%`, minHeight: point.count > 0 ? '4px' : '0' }}
                            />
                            <span className="text-xs text-gray-500 mt-1 truncate">
                              {formatDuration(point.time)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Shows where viewers stopped watching
                  </p>
                </div>
              </div>
            )}

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-4">Recent Viewers ({sessions.length})</h3>
                <div className="space-y-2">
                  {sessions.slice(0, 10).map((session) => (
                    <div
                      key={session.sessionId}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Viewer {session.viewerId.slice(-6)}</p>
                          <p className="text-xs text-gray-500">{formatDate(session.startedAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDuration(session.watchedSeconds)}</p>
                        <p className="text-xs text-gray-500">{session.completionRate}% watched</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {analytics.totalViews === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-500">No views yet</p>
                <p className="text-sm text-gray-400 mt-1">Share your video to start tracking analytics</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
