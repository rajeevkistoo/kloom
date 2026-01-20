'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRecorder, RecorderOptions } from '@/hooks/useRecorder';

interface RecordingControlsProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  defaultOptions?: Partial<RecorderOptions>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function RecordingControls({
  onRecordingComplete,
  defaultOptions,
}: RecordingControlsProps) {
  const [state, actions] = useRecorder();
  const [options, setOptions] = useState<RecorderOptions>({
    screenEnabled: true,
    webcamEnabled: defaultOptions?.webcamEnabled ?? false,
    micEnabled: defaultOptions?.micEnabled ?? true,
    quality: defaultOptions?.quality ?? '1080p',
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(true);
  const webcamPreviewRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef<number>(0);

  // Update duration ref for use in stop handler
  useEffect(() => {
    durationRef.current = state.duration;
  }, [state.duration]);

  // Show webcam preview
  useEffect(() => {
    if (state.webcamStream && webcamPreviewRef.current) {
      webcamPreviewRef.current.srcObject = state.webcamStream;
    }
  }, [state.webcamStream]);

  const startRecordingFlow = useCallback(async () => {
    setShowOptions(false);

    try {
      // Step 1: Get screen/window selection FIRST (this shows the browser picker)
      await actions.startRecording(options);

      // Step 2: Screen was selected, now show countdown
      // Pause the recording briefly while countdown runs
      actions.pauseRecording();

      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setCountdown(0);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCountdown(null);

      // Step 3: Resume recording after countdown
      actions.resumeRecording();
    } catch {
      setCountdown(null);
      setShowOptions(true);
    }
  }, [actions, options]);

  const handleStop = useCallback(async () => {
    const blob = await actions.stopRecording();
    if (blob) {
      onRecordingComplete(blob, durationRef.current);
    }
    setShowOptions(true);
  }, [actions, onRecordingComplete]);

  const handleCancel = useCallback(() => {
    actions.cancelRecording();
    setShowOptions(true);
  }, [actions]);

  // Countdown view (shown while recording is paused for countdown)
  if (countdown !== null && state.isRecording) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-8xl font-bold text-red-500 animate-pulse">
          {countdown === 0 ? 'Go!' : countdown}
        </div>
        <p className="mt-4 text-gray-500">
          {countdown === 0 ? 'Recording!' : 'Get ready...'}
        </p>
        {/* Show webcam preview during countdown */}
        {state.webcamStream && (
          <div className="mt-6">
            <video
              ref={webcamPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-32 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          </div>
        )}
      </div>
    );
  }

  // Recording view (active recording or manually paused - but not during countdown)
  if (state.isRecording) {
    return (
      <>
        {/* Webcam preview - fixed circular overlay bottom-left, 10% of viewport */}
        {state.webcamStream && (
          <div className="fixed bottom-6 left-6 z-50">
            <video
              ref={webcamPreviewRef}
              autoPlay
              muted
              playsInline
              className="rounded-full object-cover border-4 border-white shadow-2xl"
              style={{
                width: '10vw',
                height: '10vw',
                minWidth: '100px',
                minHeight: '100px',
                maxWidth: '200px',
                maxHeight: '200px',
              }}
            />
          </div>
        )}

        <div className="flex flex-col items-center space-y-6">
          {/* Recording indicator */}
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${state.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-2xl font-mono font-bold">
              {formatDuration(state.duration)}
            </span>
            <span className="text-sm text-gray-500">
              {state.isPaused ? 'Paused' : 'Recording'}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            {state.isPaused ? (
              <button
                onClick={actions.resumeRecording}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={actions.pauseRecording}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
              >
                Pause
              </button>
            )}

            <button
              onClick={handleStop}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Stop Recording
            </button>

            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>

          {state.error && (
            <p className="text-red-500 text-sm">{state.error}</p>
          )}
        </div>
      </>
    );
  }

  // Options view
  if (showOptions) {
    return (
      <div className="flex flex-col items-center space-y-6">
        <h2 className="text-xl font-semibold">Recording Options</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
          {/* Screen capture toggle */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
            <span className="flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Screen</span>
            </span>
            <input
              type="checkbox"
              checked={options.screenEnabled}
              onChange={(e) => setOptions((prev) => ({ ...prev, screenEnabled: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
          </label>

          {/* Webcam toggle */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
            <span className="flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Webcam</span>
            </span>
            <input
              type="checkbox"
              checked={options.webcamEnabled}
              onChange={(e) => setOptions((prev) => ({ ...prev, webcamEnabled: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
          </label>

          {/* Microphone toggle */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
            <span className="flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>Microphone</span>
            </span>
            <input
              type="checkbox"
              checked={options.micEnabled}
              onChange={(e) => setOptions((prev) => ({ ...prev, micEnabled: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
          </label>

          {/* Quality selector */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Quality</span>
            </span>
            <select
              value={options.quality}
              onChange={(e) => setOptions((prev) => ({ ...prev, quality: e.target.value as '720p' | '1080p' | '4k' }))}
              className="px-3 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </label>
        </div>

        <button
          onClick={startRecordingFlow}
          disabled={!options.screenEnabled}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-lg transition-colors"
        >
          Start Recording
        </button>

        {!options.screenEnabled && (
          <p className="text-yellow-600 text-sm">Screen capture is required</p>
        )}

        {state.error && (
          <p className="text-red-500 text-sm">{state.error}</p>
        )}
      </div>
    );
  }

  return null;
}
