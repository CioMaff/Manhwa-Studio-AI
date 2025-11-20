import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import type { Settings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: Settings;
  onSave: (newSettings: Settings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
  const [settings, setSettings] = useState<Settings>(currentSettings);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings, isOpen]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleChange = (field: keyof Settings, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setSettings(prev => ({ ...prev, [field]: numValue }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Studio Settings">
      <div className="space-y-6">
        <div>
          <label htmlFor="pageWidth" className="block text-sm font-medium text-gray-300 mb-2">
            Page Width ({settings.pageWidth}px)
          </label>
          <input
            id="pageWidth"
            type="range"
            min="600"
            max="1200"
            step="20"
            value={settings.pageWidth}
            onChange={(e) => handleChange('pageWidth', e.target.value)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div>
          <label htmlFor="panelSpacing" className="block text-sm font-medium text-gray-300 mb-2">
            Panel Spacing ({settings.panelSpacing}px)
          </label>
          <input
            id="panelSpacing"
            type="range"
            min="0"
            max="40"
            step="2"
            value={settings.panelSpacing}
            onChange={(e) => handleChange('panelSpacing', e.target.value)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Concurrent Generations ({settings.maxConcurrentGenerations})
            </label>
            <div className="flex items-center gap-2 rounded-lg bg-gray-900/50 p-1">
                {[1, 2, 3].map(num => (
                    <button
                        key={num}
                        onClick={() => setSettings(prev => ({...prev, maxConcurrentGenerations: num}))}
                        className={`w-full text-center py-2 rounded-md transition-colors text-sm ${settings.maxConcurrentGenerations === num ? 'bg-purple-600 text-white' : 'hover:bg-gray-700'}`}
                    >
                        {num} {num === 1 ? '(Max Consistency)' : num === 3 ? '(Max Speed)' : ''}
                    </button>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Controls how many images are generated at the same time. Lower numbers improve consistency.</p>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </Modal>
  );
};