
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
    
    let micStream: MediaStream | null = null;
    let displayStream: MediaStream | null = null;
    
    const audioConstraints: MediaTrackConstraints = {
      noiseSuppression: noiseReduction,
      echoCancellation: noiseReduction,
      autoGainControl: true,
    };

    try {
      // Step 1: Acquire streams based on user selection
      if (recordMic) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        micStreamRef.current = micStream;
      }
      
      if (recordSystem) {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true, // Request audio along with video
        });
        displayStreamRef.current = displayStream;
      }

      // Step 2: Validate the acquired streams and provide specific error feedback.
      const micAudioAvailable = micStream?.getAudioTracks().length > 0;
      const systemAudioAvailable = displayStream?.getAudioTracks().length > 0;

      if (recordSystem && !systemAudioAvailable) {
        // User intended to record system audio but didn't grant permission in the prompt.
        // This is a critical failure of user intent.
        const helpfulHint = "System audio not shared. To include it, please check the 'Share tab audio' or 'Share system audio' option in your browser's screen sharing prompt.";
        
        if (micAudioAvailable) {
          // A microphone is available, but we stop to avoid a confusing "partial" recording
          // that's missing the requested system audio.
          throw new Error(`${helpfulHint} The recording has been cancelled to ensure all desired audio is captured. Please try again.`);
        } else {
          // No system audio was shared, and no microphone is available either.
          throw new Error(`${helpfulHint} Since no audio source is available, the recording cannot start.`);
        }
      }

      // If we're here, either system audio was not requested, or it was successful.
      // Now, we just need to ensure at least one audio source is active.
      if (!micAudioAvailable && !systemAudioAvailable) {
        throw new Error("No audio source is available. Please enable microphone access or select an option with audio to record.");
      }


      // At this point, displayStream (if it exists) is guaranteed to have an audio track.
      // Set up onended handler for a valid displayStream.
      if(displayStreamRef.current){
         const videoTrack = displayStreamRef.current.getVideoTracks()[0];
         if (videoTrack) {
           videoTrack.onended = () => {
             if (mediaRecorderRef.current?.state !== 'inactive') {
               stopRecording();
             }
           };
         }
      }


      // Step 3: Combine streams into a single final stream for the MediaRecorder
      let finalStream: MediaStream;
      if (micAudioAvailable && systemAudioAvailable) {
        // Mix both microphone and system audio
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();

        const micSource = audioContext.createMediaStreamSource(micStream!);
        micSource.connect(destination);
        
        const displaySource = audioContext.createMediaStreamSource(displayStream!);
        displaySource.connect(destination);

        finalStream = destination.stream;
      } else if (micAudioAvailable) {
        // Only microphone audio is available
        finalStream = micStream!;
      } else {
        // Only system audio is available
        // Create a new stream with only the audio tracks from the display media
        finalStream = new MediaStream(displayStream!.getAudioTracks());
      }
      
      // Step 4: Configure and start MediaRecorder
      const audioBitrate = noiseReduction ? 192000 : 128000;
      const recorder = new MediaRecorder(finalStream, { mimeType: 'audio/webm', audioBitsPerSecond: audioBitrate });
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
        stopAllStreams(); // Full cleanup after stopping
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
        // This catch block is crucial. It ensures that if any part of the `try` block fails,
        // we clean up all acquired streams before re-throwing the error.
        stopAllStreams();
        // Also clean up the temporary displayStream if it wasn't assigned to the ref
        if (displayStream && displayStreamRef.current !== displayStream) {
            displayStream.getTracks().forEach(track => track.stop());
        }
        throw err; // Re-throw the error so the UI component can handle it
    }
  }, [isRecording, stopAllStreams, stopRecording]);

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
    
    // Unlock after a short delay to allow the recorder's state to settle.
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
