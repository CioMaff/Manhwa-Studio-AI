import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { TrashIcon } from './icons/TrashIcon';
import type { Character } from '../types';

interface CharacterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onSave: (character: Character) => void;
  onDelete: (id: string) => void;
}

export const CharacterEditorModal: React.FC<CharacterEditorModalProps> = ({ isOpen, onClose, character, onSave, onDelete }) => {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description);

  useEffect(() => {
    if (isOpen) {
      setName(character.name);
      setDescription(character.description);
    }
  }, [isOpen, character]);

  const handleSave = () => {
    onSave({ ...character, name, description });
  };
  
  const handleDelete = () => {
      onDelete(character.id);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${character.name}`}>
      <div className="space-y-4">
        <img src={character.referenceImage} alt={character.name} className="w-full max-h-80 object-contain rounded-lg bg-gray-700" />
        <div>
          <label htmlFor="charName" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
          <input
            id="charName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
          />
        </div>
        <div>
          <label htmlFor="charDesc" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea
            id="charDesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
            rows={3}
          />
        </div>
        <div className="flex justify-between items-center pt-4">
            <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-900/50 rounded-md hover:bg-red-900"
            >
                <TrashIcon className="w-4 h-4"/> Delete Character
            </button>
            <div className="flex gap-4">
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
                    Save Changes
                </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
