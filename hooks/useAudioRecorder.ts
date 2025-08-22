
import { useState, useRef, useCallback } from 'react';
import { fixWebmDuration } from '../utils/webmFixer';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeRef = useRef<number>(0);

  // Refs for streams and Web Audio API for robust mixing
  const micStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Ref to prevent race conditions from rapid pause/resume clicks
  const isTogglingPauseRef = useRef(false);

  const stopAllStreams = useCallback(() => {
    // Stop all media tracks
    micStreamRef.current?.getTracks().forEach(track => track.stop());
    displayStreamRef.current?.getTracks().forEach(track => track.stop());
    micStreamRef.current = null;
    displayStreamRef.current = null;

    // Safely close the AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }, []);
  
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
    // onstop event handler will handle the rest of the cleanup
  }, []);

  const startRecording = useCallback(async (recordMic: boolean, recordSystem: boolean, noiseReduction: boolean) => {
    if (isRecording) return;

    let acquiredMicStream: MediaStream | null = null;
    let acquiredDisplayStream: MediaStream | null = null;

    try {
      const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: noiseReduction,
        echoCancellation: noiseReduction,
        autoGainControl: true,
      };

      // Step 1: Acquire all requested streams. If any request fails (e.g., permission denied),
      // the entire operation will be caught and aborted with a specific error.
      if (recordMic) {
        acquiredMicStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      }
      
      if (recordSystem) {
        const displayMediaOptions: DisplayMediaStreamOptions = {
          video: true,
          audio: true,
          // @ts-ignore - This is a non-standard but widely-supported option in Chromium browsers
          systemAudio: 'include',
        };
        acquiredDisplayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      }
      
      micStreamRef.current = acquiredMicStream;
      displayStreamRef.current = acquiredDisplayStream;

      // Step 2: Validate that we have at least one audio track to record.
      const micAudioTracks = acquiredMicStream?.getAudioTracks() ?? [];
      const systemAudioTracks = acquiredDisplayStream?.getAudioTracks() ?? [];
      const allAudioTracks = [...micAudioTracks, ...systemAudioTracks];

      if (allAudioTracks.length === 0) {
        // If system audio was the *only* source requested, and it failed, provide a specific error.
        if (recordSystem && !recordMic) {
            throw new Error("System audio not shared. To include it, please check the 'Share tab audio' or 'Share system audio' option in your browser's screen sharing prompt.");
        }
        // For all other cases of failure (mic denied, or both sources failed), provide a general error.
        throw new Error("No audio source available. Please grant permission for at least one audio source to start recording.");
      }
      
      // Step 3: Combine audio tracks and configure the recorder.
      let audioStream: MediaStream;
      const videoTracks = acquiredDisplayStream?.getVideoTracks() ?? [];

      if (acquiredMicStream && acquiredDisplayStream && micAudioTracks.length > 0 && systemAudioTracks.length > 0) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const destination = audioContext.createMediaStreamDestination();
        const micSource = audioContext.createMediaStreamSource(acquiredMicStream);
        micSource.connect(destination);
        const displayAudioSource = audioContext.createMediaStreamSource(acquiredDisplayStream);
        displayAudioSource.connect(destination);
        
        const mixedAudioTracks = destination.stream.getAudioTracks();
        audioStream = new MediaStream(mixedAudioTracks);
      } else {
        audioStream = new MediaStream(allAudioTracks);
      }
      
      // The video track is only used to detect when screen sharing stops.
      // We don't want to record it.
      if (videoTracks.length > 0) {
        videoTracks[0].onended = () => {
            if (mediaRecorderRef.current?.state !== 'inactive') {
              stopRecording();
            }
        };
      }
      
      const mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`Your browser does not support recording in the required format (${mimeType}).`);
      }
      
      const audioBitrate = noiseReduction ? 192000 : 128000;
      const recorder = new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: audioBitrate });
      mediaRecorderRef.current = recorder;
    
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if(event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const fixedBlob = await fixWebmDuration(rawBlob, recordingTimeRef.current * 1000);
          setAudioBlob(fixedBlob);
        }
        setIsRecording(false);
        setIsPaused(false);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        stopAllStreams();
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prevTime) => {
          const newTime = prevTime + 1;
          recordingTimeRef.current = newTime;
          return newTime;
        });
      }, 1000);

    } catch (err) {
        console.error("Failed to start recording:", err);
        // Clean up any streams that were acquired before the error.
        acquiredMicStream?.getTracks().forEach(track => track.stop());
        acquiredDisplayStream?.getTracks().forEach(track => track.stop());
        
        micStreamRef.current = null;
        displayStreamRef.current = null;
        
        // Re-throw so the UI component can display the specific error.
        throw err;
    }
  }, [isRecording, stopRecording, stopAllStreams]);

  const togglePause = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current || isTogglingPauseRef.current) {
      return;
    }

    isTogglingPauseRef.current = true;

    if (mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prevTime) => {
            const newTime = prevTime + 1;
            recordingTimeRef.current = newTime;
            return newTime;
        });
      }, 1000);
    } else if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    
    setTimeout(() => {
      isTogglingPauseRef.current = false;
    }, 200);

  }, [isRecording]);


  const resetRecorder = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    setAudioBlob(null);
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    } else {
        stopAllStreams();
    }
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
    }
  }, [stopAllStreams]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    togglePause,
    resetRecorder,
  };
};
