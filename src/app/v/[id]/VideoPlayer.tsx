'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// Generate a unique viewer ID (stored in localStorage)
function getViewerId(): string {
  if (typeof window === 'undefined') return '';

  let viewerId = localStorage.getItem('kloom_viewer_id');
  if (!viewerId) {
    viewerId = 'v_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('kloom_viewer_id', viewerId);
  }
  return viewerId;
}

// Generate a unique session ID for this viewing
function generateSessionId(): string {
  return 's_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

interface Recording {
  id: string;
  title: string;
  driveFileId: string;
  duration: number;
  status: 'processing' | 'uploading' | 'ready' | 'error';
  createdAt: Date;
  viewCount: number;
}

interface VideoPlayerProps {
  recording: Recording;
  videoUrl: string | null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VideoPlayer({ recording, videoUrl }: VideoPlayerProps) {
  const [status, setStatus] = useState(recording.status);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(videoUrl);
  const [copied, setCopied] = useState(false);

  // Analytics state
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionIdRef = useRef<string>('');
  const viewerIdRef = useRef<string>('');
  const lastProgressRef = useRef<number>(0);

  // Initialize analytics IDs
  useEffect(() => {
    viewerIdRef.current = getViewerId();
    sessionIdRef.current = generateSessionId();
  }, []);

  // Track analytics event
  const trackEvent = useCallback(async (
    eventType: string,
    currentTime?: number,
    duration?: number
  ) => {
    if (!viewerIdRef.current || !sessionIdRef.current) return;

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: recording.id,
          eventType,
          viewerId: viewerIdRef.current,
          sessionId: sessionIdRef.current,
          currentTime: currentTime || 0,
          duration: duration || recording.duration,
        }),
      });
    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  }, [recording.id, recording.duration]);

  // Set up video event listeners for analytics
  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== 'ready') return;

    const handlePlay = () => {
      trackEvent('video_started', video.currentTime, video.duration);
    };

    const handlePause = () => {
      if (!video.ended) {
        trackEvent('video_paused', video.currentTime, video.duration);
      }
    };

    const handleEnded = () => {
      trackEvent('video_ended', video.duration, video.duration);
    };

    const handleSeeked = () => {
      trackEvent('video_seeked', video.currentTime, video.duration);
    };

    const handleTimeUpdate = () => {
      // Send progress event every 5 seconds of playback
      const currentSecond = Math.floor(video.currentTime);
      if (currentSecond > 0 && currentSecond % 5 === 0 && currentSecond !== lastProgressRef.current) {
        lastProgressRef.current = currentSecond;
        trackEvent('video_progress', video.currentTime, video.duration);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [status, trackEvent]);

  // Poll for status if video is still processing/uploading
  useEffect(() => {
    if (status === 'ready' || status === 'error') {
      return;
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/recordings/${recording.id}`);
        const data = await response.json();

        if (data.recording) {
          setStatus(data.recording.status);
          if (data.recording.status === 'ready' && data.recording.driveFileId) {
            setCurrentVideoUrl(`https://drive.google.com/file/d/${data.recording.driveFileId}/preview`);
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [recording.id, status]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const downloadVideo = useCallback(() => {
    if (recording.driveFileId) {
      window.open(`https://drive.google.com/uc?export=download&id=${recording.driveFileId}`, '_blank');
    }
  }, [recording.driveFileId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
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
          </div>
        </div>
      </header>

      {/* Video player */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Video container */}
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          {status === 'ready' && recording.driveFileId ? (
            <video
              ref={videoRef}
              src={`/api/stream/${recording.id}`}
              className="w-full h-full"
              controls
              autoPlay={false}
              playsInline
            />
          ) : status === 'error' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xl font-medium text-red-400">Video upload failed</p>
                <p className="text-gray-500 mt-2">There was an error processing this recording.</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4">
                  <svg className="animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-xl font-medium">
                  {status === 'processing' ? 'Processing video...' : 'Uploading video...'}
                </p>
                <p className="text-gray-500 mt-2">
                  This video is still being prepared. It will be available shortly.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Video info */}
        <div className="mt-6 space-y-4">
          <h1 className="text-2xl font-bold">{recording.title}</h1>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-gray-400">
              <span>{formatDate(recording.createdAt)}</span>
              <span>{formatDuration(recording.duration)}</span>
              <span>{recording.viewCount + 1} view{recording.viewCount !== 0 ? 's' : ''}</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={copyLink}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>

              {status === 'ready' && recording.driveFileId && (
                <button
                  onClick={downloadVideo}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Download
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
