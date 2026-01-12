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
  quality: '720p' | '1080p';
}

export interface RecorderActions {
  startRecording: (options: RecorderOptions) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

const getVideoConstraints = (quality: '720p' | '1080p') => {
  if (quality === '1080p') {
    return { width: 1920, height: 1080 };
  }
  return { width: 1280, height: 720 };
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
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

      const { width, height } = getVideoConstraints(options.quality);
      let screenStream: MediaStream | null = null;
      let webcamStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;

      // Get screen share with system audio
      if (options.screenEnabled) {
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: 30 },
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
        } catch {
          throw new Error('Screen sharing was cancelled or denied');
        }
      }

      // Get webcam
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
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        } catch (err) {
          console.warn('Microphone access denied:', err);
        }
      }

      if (!screenStream) {
        throw new Error('Screen stream is required');
      }

      // Create canvas for compositing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      canvasRef.current = canvas;

      // Create video elements for streams
      const screenVideo = document.createElement('video');
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      await screenVideo.play();
      screenVideoRef.current = screenVideo;

      let webcamVideo: HTMLVideoElement | null = null;
      if (webcamStream) {
        webcamVideo = document.createElement('video');
        webcamVideo.srcObject = webcamStream;
        webcamVideo.muted = true;
        await webcamVideo.play();
        webcamVideoRef.current = webcamVideo;
      }

      // Animation loop to composite screen + webcam
      const drawFrame = () => {
        // Draw screen
        ctx.drawImage(screenVideo, 0, 0, width, height);

        // Draw webcam in bottom-right corner (picture-in-picture)
        if (webcamVideo && webcamStream) {
          const pipWidth = Math.round(width * 0.2); // 20% of screen width
          const pipHeight = Math.round(pipWidth * (3 / 4)); // 4:3 aspect ratio
          const margin = 20;
          const pipX = width - pipWidth - margin;
          const pipY = height - pipHeight - margin;

          // Draw circular webcam with border
          ctx.save();

          // Create circular clip
          const centerX = pipX + pipWidth / 2;
          const centerY = pipY + pipHeight / 2;
          const radius = Math.min(pipWidth, pipHeight) / 2;

          // Draw border/shadow
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();

          // Clip to circle
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.clip();

          // Draw webcam video (centered and cropped to fill circle)
          const videoAspect = webcamVideo.videoWidth / webcamVideo.videoHeight;
          const pipAspect = pipWidth / pipHeight;
          let drawWidth, drawHeight, offsetX, offsetY;

          if (videoAspect > pipAspect) {
            drawHeight = pipHeight;
            drawWidth = pipHeight * videoAspect;
            offsetX = pipX - (drawWidth - pipWidth) / 2;
            offsetY = pipY;
          } else {
            drawWidth = pipWidth;
            drawHeight = pipWidth / videoAspect;
            offsetX = pipX;
            offsetY = pipY - (drawHeight - pipHeight) / 2;
          }

          ctx.drawImage(webcamVideo, offsetX, offsetY, drawWidth, drawHeight);
          ctx.restore();
        }

        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };

      drawFrame();

      // Get canvas stream
      const canvasStream = canvas.captureStream(30);

      // Mix audio tracks using AudioContext
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      // Add system audio from screen share
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenAudioStream = new MediaStream(screenAudioTracks);
        const screenAudioSource = audioContext.createMediaStreamSource(screenAudioStream);
        screenAudioSource.connect(destination);
      }

      // Add microphone audio
      if (micStream) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        // Add a gain node to control mic volume
        const micGain = audioContext.createGain();
        micGain.gain.value = 1.0;
        micSource.connect(micGain);
        micGain.connect(destination);
      }

      // Combine canvas video with mixed audio
      const finalTracks: MediaStreamTrack[] = [
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ];

      const combinedStream = new MediaStream(finalTracks);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: options.quality === '1080p' ? 5000000 : 2500000,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle screen share stop (user clicks "Stop sharing")
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

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

        // Stop animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Stop all tracks
        if (state.screenStream) {
          state.screenStream.getTracks().forEach(track => track.stop());
        }
        if (state.webcamStream) {
          state.webcamStream.getTracks().forEach(track => track.stop());
        }

        // Clean up video elements
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = null;
          screenVideoRef.current = null;
        }
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = null;
          webcamVideoRef.current = null;
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

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(track => track.stop());
    }
    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach(track => track.stop());
    }

    // Clean up video elements
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
      webcamVideoRef.current = null;
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
