
import React from 'react';
import { WarningIcon, RetryIcon } from './icons';

interface ErrorDisplayProps {
  message: string | null;
  onReset: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onReset }) => {
  return (
    <div className="text-center flex flex-col items-center p-4">
      <WarningIcon className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-red-400 mb-2">An Error Occurred</h2>
      <p className="text-gray-300 max-w-md mb-8">
        {message || 'Something went wrong. Please try again.'}
      </p>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
      >
        <RetryIcon className="w-5 h-5" />
        Try Again
      </button>
    </div>
  );
};
