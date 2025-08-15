
import React from 'react';

interface LoaderProps {
  message?: string;
}

export const Loader: React.FC<LoaderProps> = ({ message = 'Processing...' }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-xl text-gray-300">{message}</p>
    </div>
  );
};
