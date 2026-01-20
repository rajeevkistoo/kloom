'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  error: string | null;
}

export interface RecorderOptions {
  screenEnabled: boolean;
  webcamEnabled: boolean;
  micEnabled: boolean;
  quality: '720p' | '1080p' | '4k';
}

export interface RecorderActions {
  startRecording: (options: RecorderOptions) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

const getVideoConstraints = (quality: '720p' | '1080p' | '4k') => {
  if (quality === '4k') {
    return { width: { ideal: 3840 }, height: { ideal: 2160 } };
  }
  if (quality === '1080p') {
    return { width: { ideal: 1920 }, height: { ideal: 1080 } };
  }
  return { width: { ideal: 1280 }, height: { ideal: 720 } };
};

export function useRecorder(): [RecorderState, RecorderActions] {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    screenStream: null,
    webcamStream: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (state.screenStream) {
        state.screenStream.getTracks().forEach(track => track.stop());
      }
      if (state.webcamStream) {
        state.webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.screenStream, state.webcamStream]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedDurationRef.current * 1000;
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setState(prev => ({ ...prev, duration: elapsed }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (options: RecorderOptions) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      chunksRef.current = [];
      pausedDurationRef.current = 0;

      const constraints = getVideoConstraints(options.quality);
      let screenStream: MediaStream | null = null;
      let webcamStream: MediaStream | null = null;
      let audioStream: MediaStream | null = null;

      // Get screen share
      if (options.screenEnabled) {
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              ...constraints,
              frameRate: { ideal: 30 },
            },
            audio: true, // System audio if available
          });
        } catch {
          throw new Error('Screen sharing was cancelled or denied');
        }
      }

      // Get webcam (for preview only - not merged into recording yet)
      if (options.webcamEnabled) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320 },
              height: { ideal: 240 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          });
        } catch (err) {
          console.warn('Webcam access denied:', err);
        }
      }

      // Get microphone
      if (options.micEnabled) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100,
            },
            video: false,
          });
        } catch (err) {
          console.warn('Microphone access denied:', err);
        }
      }

      // Combine streams
      const tracks: MediaStreamTrack[] = [];

      if (screenStream) {
        tracks.push(...screenStream.getVideoTracks());
        // Add system audio if available
        const screenAudioTracks = screenStream.getAudioTracks();
        if (screenAudioTracks.length > 0) {
          tracks.push(...screenAudioTracks);
        }
      }

      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }

      if (tracks.length === 0) {
        throw new Error('No media tracks available');
      }

      const combinedStream = new MediaStream(tracks);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: options.quality === '4k' ? 15000000 : options.quality === '1080p' ? 5000000 : 2500000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle screen share stop (user clicks "Stop sharing")
      if (screenStream) {
        screenStream.getVideoTracks()[0].onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            // Auto-stop recording when screen share ends
            mediaRecorderRef.current.stop();
          }
        };
      }

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        screenStream,
        webcamStream,
        error: null,
      });

      startTimer();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw err;
    }
  }, [startTimer]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];

        // Stop all tracks
        if (state.screenStream) {
          state.screenStream.getTracks().forEach(track => track.stop());
        }
        if (state.webcamStream) {
          state.webcamStream.getTracks().forEach(track => track.stop());
        }

        stopTimer();

        setState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          screenStream: null,
          webcamStream: null,
          error: null,
        });

        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [state.screenStream, state.webcamStream, stopTimer]);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      pausedDurationRef.current = state.duration;
      stopTimer();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.duration, stopTimer]);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      startTimer();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [startTimer]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    chunksRef.current = [];

    // Stop all tracks
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(track => track.stop());
    }
    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach(track => track.stop());
    }

    stopTimer();

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      screenStream: null,
      webcamStream: null,
      error: null,
    });
  }, [state.screenStream, state.webcamStream, stopTimer]);

  return [
    state,
    {
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      cancelRecording,
    },
  ];
}
