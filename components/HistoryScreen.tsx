
import React from 'react';
import { HistoryItem } from '../types';
import { TrashIcon, EyeIcon, ArrowLeftIcon, HistoryIcon } from './icons';

interface HistoryScreenProps {
  history: HistoryItem[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ history, onView, onDelete, onBack }) => {

  return (
    <div className="w-full text-left animate-fade-in">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <HistoryIcon className="w-8 h-8 text-cyan-400" />
                Recording History
            </h2>
            <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
                aria-label="Back to new recording"
            >
                <ArrowLeftIcon className="w-5 h-5" />
                New Note
            </button>
        </div>
        
        {history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
                <p className="text-lg">You have no saved recordings.</p>
                <p className="text-gray-500 mt-2">Create a new note, and it will appear here.</p>
            </div>
        ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                {history.map(item => (
                    <div 
                        key={item.id} 
                        onClick={() => onView(item.id)}
                        className="flex items-center justify-between p-4 bg-gray-800/70 hover:bg-gray-700/90 border border-gray-700 rounded-lg cursor-pointer transition-all duration-200 group"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-100 truncate group-hover:text-cyan-400 transition-colors">{item.title}</p>
                            <p className="text-sm text-gray-400">
                                {new Date(item.createdAt).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); onView(item.id); }}
                                className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                                aria-label={`View note: ${item.title}`}
                            >
                                <EyeIcon className="w-6 h-6" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // prevent triggering onView
                                    onDelete(item.id);
                                }}
                                className="p-2 text-red-500 hover:text-red-400 transition-colors"
                                aria-label={`Delete note: ${item.title}`}
                            >
                                <TrashIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};
