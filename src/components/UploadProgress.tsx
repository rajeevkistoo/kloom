'use client';

import { useState, useEffect, useCallback } from 'react';

interface UploadProgressProps {
  recordingId: string;
  shareUrl: string;
  onComplete?: () => void;
  onRecordAnother?: () => void;
}

type UploadStatus = 'processing' | 'uploading' | 'ready' | 'error';

export default function UploadProgress({
  recordingId,
  shareUrl,
  onComplete,
  onRecordAnother,
}: UploadProgressProps) {
  const [status, setStatus] = useState<UploadStatus>('processing');
  const [copied, setCopied] = useState(false);

  // Poll for status updates
  useEffect(() => {
    if (status === 'ready' || status === 'error') {
      return;
    }

    let pollCount = 0;
    const maxPolls = 300; // 10 minutes max (2s intervals)

    const checkStatus = async () => {
      pollCount++;
      try {
        const response = await fetch(`/api/upload/${recordingId}`);
        const data = await response.json();

        console.log(`[UploadProgress] Poll ${pollCount}: status=${data.status}`);

        if (data.status) {
          setStatus(data.status);

          if (data.status === 'ready') {
            onComplete?.();
          }
        }

        // If still processing after many polls, something went wrong
        if (pollCount >= maxPolls && data.status !== 'ready') {
          console.error('[UploadProgress] Upload timed out');
          setStatus('error');
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    // Check immediately on mount
    checkStatus();

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [recordingId, status, onComplete]);

  const copyLink = useCallback(async () => {
    const fullUrl = `${window.location.origin}${shareUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'processing':
        return {
          icon: (
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ),
          text: 'Processing video...',
          color: 'text-blue-500',
        };
      case 'uploading':
        return {
          icon: (
            <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          ),
          text: 'Uploading to Google Drive...',
          color: 'text-yellow-500',
        };
      case 'ready':
        return {
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          text: 'Upload complete!',
          color: 'text-green-500',
        };
      case 'error':
        return {
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          text: 'Upload failed',
          color: 'text-red-500',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="flex flex-col items-center space-y-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
      {/* Status indicator */}
      <div className={`flex items-center space-x-3 ${statusDisplay.color}`}>
        {statusDisplay.icon}
        <span className="font-medium">{statusDisplay.text}</span>
      </div>

      {/* Share link section */}
      <div className="w-full max-w-md">
        <p className="text-sm text-gray-500 mb-2 text-center">
          {status === 'ready'
            ? 'Your video is ready to share!'
            : 'Share this link now - the video will be available once upload completes'}
        </p>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}${shareUrl}`}
            className="flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm"
          />
          <button
            onClick={copyLink}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Progress bar for uploading state */}
      {(status === 'processing' || status === 'uploading') && (
        <div className="w-full max-w-md">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === 'uploading' ? 'bg-yellow-500 w-2/3' : 'bg-blue-500 w-1/3'
              }`}
              style={{
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center space-x-4">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          Open Link
        </a>
        <button
          onClick={onRecordAnother}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Record Another
        </button>
      </div>
    </div>
  );
}
