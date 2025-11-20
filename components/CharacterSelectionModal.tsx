import React from 'react';
import { Modal } from './Modal';
import type { CharacterInPanel } from '../types';

interface CharacterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: string;
  characters: CharacterInPanel[];
  onSelect: (character: CharacterInPanel) => void;
}

export const CharacterSelectionModal: React.FC<CharacterSelectionModalProps> = ({ isOpen, onClose, sourceImage, characters, onSelect }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Character to Create" maxWidth="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Nano detected multiple new characters in this panel. Please choose which one you'd like to create a character sheet for.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="rounded-md overflow-hidden border border-gray-700">
            <img src={sourceImage} alt="Panel Reference" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-3">
            {characters.map((char, index) => (
              <button
                key={index}
                onClick={() => onSelect(char)}
                className="w-full text-left p-4 bg-gray-700 rounded-md hover:bg-purple-800/50 border border-gray-600 hover:border-purple-600 transition-all"
              >
                <h4 className="font-bold text-purple-300">{char.name_suggestion}</h4>
                <p className="text-xs text-gray-300 mt-1 line-clamp-2">{char.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};