
import React from 'react';
import { MicIcon, StopIcon } from './icons';

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, onClick }) => {
  const baseClasses =
    'relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 shadow-lg';
  const recordingClasses = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400';
  const idleClasses = 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400';

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isRecording ? recordingClasses : idleClasses}`}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
      )}
      {isRecording ? (
        <StopIcon className="w-10 h-10" />
      ) : (
        <MicIcon className="w-10 h-10" />
      )}
    </button>
  );
};