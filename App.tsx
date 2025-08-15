



import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AppState, Notes, HistoryItem } from './types';
import { GEMINI_MODEL_NAME, GEMINI_PROMPT, GEMINI_RESPONSE_SCHEMA } from './constants';
import * as db from './utils/db';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { NotesDisplay } from './components/NotesDisplay';
import { RecordButton } from './components/RecordButton';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { ErrorDisplay } from './components/ErrorDisplay';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { PauseIcon, PlayIcon, GenerateIcon, TrashIcon } from './components/icons';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // remove the "data:audio/webm;base64," part
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
};


export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noiseReduction, setNoiseReduction] = useState<boolean>(true);
  const [recordMic, setRecordMic] = useState(true);
  const [recordSystem, setRecordSystem] = useState(false);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [displayedAudioBlob, setDisplayedAudioBlob] = useState<Blob | null>(null);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    togglePause,
    resetRecorder,
  } = useAudioRecorder();

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      await db.initDB();
      const items = await db.getAllNotesMeta();
      setHistory(items);
    };
    loadHistory();
  }, []);
  

  const generateNotesFromAudio = useCallback(async (audioBase64: string, blob: Blob) => {
    try {
      const audioPart = {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioBase64,
        },
      };

      const response = await ai.models.generateContent({
          model: GEMINI_MODEL_NAME,
          contents: [{ parts: [audioPart, { text: GEMINI_PROMPT }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
      });

      const parsedNotes = JSON.parse(response.text) as Notes;
      setNotes(parsedNotes);
      setAppState(AppState.SUCCESS);
      setError(null);
      
      // Save to DB
      const newRecord: db.NoteRecord = {
        id: `note_${Date.now()}`,
        createdAt: new Date(),
        notes: parsedNotes,
        audioBlob: blob,
      };
      await db.addNote(newRecord);
      // Refresh history list
      const items = await db.getAllNotesMeta();
      setHistory(items);

    } catch (err) {
      console.error(err);
      setError('Failed to generate notes. The AI may have been unable to process the audio. Please try again with a clearer recording.');
      setAppState(AppState.ERROR);
    }
  }, []);

  // When recording stops and we have a blob, move to the review screen.
  useEffect(() => {
    if (!isRecording && audioBlob && appState === AppState.RECORDING) {
      setAppState(AppState.RECORDING_COMPLETE);
      setDisplayedAudioBlob(audioBlob);
    }
  }, [isRecording, audioBlob, appState]);


  const handleStartRecording = useCallback(async () => {
    if (!recordMic && !recordSystem) {
      // Don't treat this as an error, just prevent starting.
      // The UI already shows a message.
      return;
    }
    setError(null);
    setAppState(AppState.REQUESTING_MIC);
    try {
      await startRecording(recordMic, recordSystem, noiseReduction);
      setAppState(AppState.RECORDING);
    } catch (err) {
      console.error("Permission denied or failed to start:", err);
      let message = "An unknown error occurred while trying to start the recording.";
      if (err instanceof Error) {
        // DOMException names provide more specific info
        if ((err as DOMException).name === 'NotAllowedError') {
            message = "Permission to record was denied. Please allow microphone and/or screen recording access in your browser's site settings and try again.";
        } else if (err.message.includes("system audio")) {
            // Custom error from the recorder hook, e.g., for not sharing system audio.
            // We pass the helpful message from the hook directly to the user.
            message = err.message;
        } else {
            message = "Could not start recording. A required device might not be available, or another application could be using it.";
        }
      }
      setError(message);
      setAppState(AppState.ERROR);
    }
  }, [startRecording, noiseReduction, recordMic, recordSystem]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);


  const handlePauseResumeClick = useCallback(() => {
    togglePause();
  }, [togglePause]);

  const handleGenerateNotes = useCallback(async () => {
    if (!displayedAudioBlob) return;
    setAppState(AppState.PROCESSING);
    try {
      const audioBase64 = await blobToBase64(displayedAudioBlob);
      await generateNotesFromAudio(audioBase64, displayedAudioBlob);
    } catch (err) {
      console.error("Error during note generation pipeline", err);
      setError('An internal error occurred while preparing the audio file.');
      setAppState(AppState.ERROR);
    }
  }, [displayedAudioBlob, generateNotesFromAudio]);


  const handleReset = useCallback(() => {
    setAppState(AppState.IDLE);
    setNotes(null);
    setError(null);
    resetRecorder();
    setViewingHistoryId(null);
    setDisplayedAudioBlob(null);
  }, [resetRecorder]);

  const handleShowHistory = useCallback(async () => {
    // Set state immediately for a responsive UI transition.
    setAppState(AppState.HISTORY);
    setNotes(null);
    setError(null);
    setViewingHistoryId(null);
    setDisplayedAudioBlob(null);

    // Then, fetch the latest data to ensure the history view is always fresh.
    try {
      const items = await db.getAllNotesMeta();
      setHistory(items);
    } catch (e) {
      console.error("Failed to load history:", e);
      setError("Could not load history from the database.");
    }
  }, []);

  const handleViewHistoryItem = useCallback(async (id: string) => {
    const record = await db.getNote(id);
    if (record) {
      setNotes(record.notes);
      setDisplayedAudioBlob(record.audioBlob);
      setViewingHistoryId(id);
      setAppState(AppState.SUCCESS);
    }
  }, []);

  const handleDeleteHistoryItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this note permanently?')) {
      try {
        // 1. Delete the note from the database and wait for it to complete.
        await db.deleteNote(id);
  
        // 2. Once confirmed, update the local state. This is more reliable than a re-fetch.
        setHistory(prevHistory => prevHistory.filter(item => item.id !== id));
      } catch (e) {
        console.error("Failed to delete note from database:", e);
        alert("There was an error deleting the note. Please try again.");
      }
    }
  };


  const renderContent = () => {
    switch (appState) {
      case AppState.IDLE:
      case AppState.REQUESTING_MIC:
        return (
          <WelcomeScreen 
            onStartRecording={handleStartRecording}
            isRequesting={appState === AppState.REQUESTING_MIC}
            noiseReduction={noiseReduction}
            onNoiseReductionChange={setNoiseReduction}
            recordMic={recordMic}
            onRecordMicChange={setRecordMic}
            recordSystem={recordSystem}
            onRecordSystemChange={setRecordSystem}
          />
        );
      case AppState.RECORDING:
        return (
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-xl mb-4 text-gray-400 h-7">
              {isPaused ? 'Recording Paused' : 'Recording in progress...'}
            </p>
            <div className="font-mono text-6xl text-cyan-400 mb-6 tracking-wider">
              {new Date(recordingTime * 1000).toISOString().slice(14, 19)}
            </div>
            <div className="flex flex-col items-center gap-4">
              <RecordButton isRecording={true} onClick={handleStopRecording} />
              <button
                onClick={handlePauseResumeClick}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-600/50 hover:bg-gray-600 text-gray-200 hover:text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              >
                {isPaused ? <PlayIcon className="w-5 h-5" /> : <PauseIcon className="w-5 h-5" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          </div>
        );
      case AppState.RECORDING_COMPLETE:
        return (
          <div className="text-center flex flex-col items-center animate-fade-in">
            <h2 className="text-2xl font-semibold text-gray-100 mb-2">Recording Finished</h2>
            <p className="text-gray-400 mb-4">
              Your recording is <span className="font-semibold text-cyan-400">{new Date(recordingTime * 1000).toISOString().slice(14, 19)}</span> long.
            </p>
            <p className="text-gray-400 mb-8 max-w-md">
              Ready to generate your notes? You can also discard this recording and start over.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleGenerateNotes}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-lg text-lg focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"
              >
                <GenerateIcon className="w-6 h-6" />
                Generate Notes
              </button>
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-600/50 hover:bg-gray-600 text-gray-200 hover:text-white font-medium rounded-lg transition-colors duration-200"
                aria-label="Discard recording and start over"
              >
                <TrashIcon className="w-5 h-5" />
                Discard
              </button>
            </div>
          </div>
        );
      case AppState.PROCESSING:
        return <Loader message="Analyzing your audio and generating notes..." />;
      case AppState.SUCCESS:
        return notes ? <NotesDisplay notes={notes} onNewNote={handleReset} onBackToHistory={viewingHistoryId ? handleShowHistory : undefined} audioBlob={displayedAudioBlob} /> : null;
      case AppState.ERROR:
        return <ErrorDisplay message={error} onReset={handleReset} />;
      case AppState.HISTORY:
        return <HistoryScreen history={history} onView={handleViewHistoryItem} onDelete={handleDeleteHistoryItem} onBack={handleReset} />;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-gray-900">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
        <Header onShowHistory={handleShowHistory} isHistoryVisible={appState === AppState.HISTORY} />
        <div className="w-full mt-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl shadow-black/20 p-6 md:p-10 min-h-[400px] flex items-center justify-center">
          {renderContent()}
        </div>
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>Powered by Google Gemini. Built for clarity.</p>
        </footer>
      </div>
    </main>
  );
}