
import React from 'react';
import { MicIcon } from './icons';

interface HeaderProps {
    onNavClick: () => void;
    navLabel: string;
    NavIcon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export const Header: React.FC<HeaderProps> = ({ onNavClick, navLabel, NavIcon }) => {
  return (
    <header className="text-center w-full relative">
      <div className="flex items-center justify-center gap-4 mb-2">
        <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-400/30">
          <MicIcon className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-gray-400 text-transparent bg-clip-text">
          Voice Notes AI
        </h1>
      </div>
      <p className="text-lg text-gray-400 max-w-2xl mx-auto">
        Turn your spoken words into structured summaries, objectives, and key points automatically.
      </p>
      <button
        onClick={onNavClick}
        className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
        aria-label={navLabel}
      >
        <NavIcon className="w-5 h-5" />
        {navLabel}
      </button>
    </header>
  );
};
