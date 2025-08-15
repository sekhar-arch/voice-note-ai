
import React from 'react';
import { MicIcon, ScreenDesktopIcon, SparklesIcon } from './icons';

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

const SourceToggle: React.FC<ToggleProps> = ({ id, label, description, icon, enabled, onChange, disabled = false }) => (
  <div className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${enabled ? 'bg-blue-900/50 border-blue-500' : 'bg-gray-800/60 border-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded-md ${enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
        {icon}
      </div>
      <div>
        <label htmlFor={id} className={`font-semibold text-gray-100 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{label}</label>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
    <button
      type="button"
      id={id}
      className={`${enabled ? 'bg-blue-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${disabled ? 'cursor-not-allowed' : ''}`}
      role="switch"
      aria-checked={enabled}
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
    >
      <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
  </div>
);


interface WelcomeScreenProps {
  onStartRecording: () => void;
  isRequesting: boolean;
  noiseReduction: boolean;
  onNoiseReductionChange: (enabled: boolean) => void;
  recordMic: boolean;
  onRecordMicChange: (enabled: boolean) => void;
  recordSystem: boolean;
  onRecordSystemChange: (enabled: boolean) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onStartRecording,
  isRequesting,
  noiseReduction, onNoiseReductionChange,
  recordMic, onRecordMicChange,
  recordSystem, onRecordSystemChange
}) => {
  const canStart = recordMic || recordSystem;

  return (
    <div className="text-center flex flex-col items-center animate-fade-in w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold text-gray-100 mb-2">Configure Your Recording</h2>
      <p className="text-gray-400 mb-8">
        Select your audio sources, then press Start.
      </p>

      <div className="w-full space-y-4">
        <SourceToggle
          id="record-mic-toggle"
          label="Record Microphone"
          description="Capture your voice."
          icon={<MicIcon className="w-6 h-6" />}
          enabled={recordMic}
          onChange={onRecordMicChange}
          disabled={isRequesting}
        />
        <SourceToggle
          id="record-system-toggle"
          label="Record Screen Audio"
          description="Capture audio from a tab or your system."
          icon={<ScreenDesktopIcon className="w-6 h-6" />}
          enabled={recordSystem}
          onChange={onRecordSystemChange}
          disabled={isRequesting}
        />
        <SourceToggle
          id="noise-reduction-toggle"
          label="Noise Reduction"
          description="For clearer, high-quality audio."
          icon={<SparklesIcon className="w-6 h-6" />}
          enabled={noiseReduction}
          onChange={onNoiseReductionChange}
          disabled={isRequesting || !recordMic}
        />
      </div>

      <div className="mt-8 w-full">
        <button
          onClick={onStartRecording}
          disabled={!canStart || isRequesting}
          className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all duration-200 shadow-lg text-lg focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
          aria-label="Start recording with selected sources"
        >
          {isRequesting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                Requesting Access...
              </>
            ) : (
              <>
                <div className={`w-3 h-3 rounded-full bg-red-500 ${!canStart ? 'opacity-0' : 'animate-pulse'}`}></div>
                Start Recording
              </>
            )
          }
        </button>
        {!canStart && !isRequesting && (
          <p className="text-red-400 text-sm mt-2">Please select at least one audio source.</p>
        )}
      </div>
    </div>
  );
};
