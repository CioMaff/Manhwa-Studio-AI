

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { TrashIcon } from './icons/TrashIcon';
import type { Character } from '../types';
import { showConfirmation, showToast } from '../systems/uiSystem';
import { CharacterSheetGenerator } from './CharacterSheetGenerator';
import { fileToBase64, compressImageBase64 } from '../utils/fileUtils';

interface CharacterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character | Omit<Character, 'id' | 'name'> & { name?: string };
  onSave: (character: Character | Omit<Character, 'id'>) => void;
  onDelete: (id: string) => void;
}

const FormField: React.FC<{
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    placeholder?: string;
    isTextarea?: boolean;
    rows?: number;
}> = ({ label, value, onChange, placeholder, isTextarea = false, rows = 2 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    {isTextarea ? (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-2 bg-gray-900 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
        rows={rows}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-2 bg-gray-900 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
    )}
  </div>
);

export const CharacterEditorModal: React.FC<CharacterEditorModalProps> = ({ isOpen, onClose, character, onSave, onDelete }) => {
  const [editedChar, setEditedChar] = useState(character);
  const isCreating = !('id' in character);
  // Always start in the form view to allow image upload before generation.
  const [view, setView] = useState<'form' | 'sheet_generator'>('form');
  const hiddenUploadRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedChar(character);
    // This ensures the modal always opens to the form view.
    setView('form');
  }, [character, isOpen]);

  const handleFieldChange = (field: keyof Character, value: string) => {
    setEditedChar(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!editedChar.name?.trim()) {
        showToast("Character name is required.", 'error');
        return;
    }
    const characterToSave = { ...editedChar, name: editedChar.name };
    // FIX: Add type assertion to satisfy the onSave prop signature. The guard clause above ensures this is safe.
    onSave(characterToSave as Character | Omit<Character, 'id'>);
  };
  
  const handleDelete = async () => {
      if (isCreating || !('id' in editedChar)) return;
      const confirmed = await showConfirmation({
          title: 'Delete Character',
          message: `Are you sure you want to permanently delete ${editedChar.name}? This cannot be undone.`
      });
      if (confirmed) {
        onDelete(editedChar.id);
        onClose();
      }
  }

  const handleSheetFinalized = (sheetImage: string) => {
      const updatedChar = { ...editedChar, referenceImage: sheetImage };
      setEditedChar(updatedChar);
      setView('form');
      showToast("Character Sheet finalized!", "success");
      // If we were creating a new character, save it now that we have the sheet
      if (isCreating && updatedChar.name) {
          // FIX: Add type assertion to satisfy the onSave prop signature. The check for name ensures this is safe.
          onSave(updatedChar as Omit<Character, 'id'>);
          showToast("New character created and saved!", "info");
      }
  }
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const base64 = await fileToBase64(file);
          const compressed = await compressImageBase64(base64);
          handleFieldChange('referenceImage', compressed);
          e.target.value = ''; // Reset input
      }
  };

  if (!character) return null;
  const title = isCreating ? "Create New Character" : `Edit ${editedChar.name}`;
  const isPlaceholderImage = editedChar.referenceImage.startsWith('data:image/svg+xml');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-6xl">
       <input type="file" ref={hiddenUploadRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
      {view === 'form' ? (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4 lg:col-span-1">
                <div className="w-full aspect-[3/4] rounded-lg bg-gray-900 overflow-hidden">
                    <img src={editedChar.referenceImage} alt={editedChar.name} className="w-full h-full object-contain" />
                </div>
                <FormField label="Name" value={editedChar.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                 <div className="space-y-2 pt-2">
                    <button onClick={() => hiddenUploadRef.current?.click()} className="w-full text-center py-2 px-4 rounded-md bg-gray-600 hover:bg-gray-500 transition-colors">
                        Upload Reference Image
                    </button>
                    <button 
                        onClick={() => {
                            if (isPlaceholderImage) {
                                showToast("Please upload a reference image before generating a sheet.", "info");
                                return;
                            }
                            setView('sheet_generator');
                        }}
                        className="w-full text-center py-2 px-4 rounded-md bg-purple-600 hover:bg-purple-700 transition-colors disabled:bg-gray-500/50 disabled:cursor-not-allowed"
                        title={isPlaceholderImage ? "Upload a base image to enable the AI Sheet Generator." : "Generate a full character sheet using AI"}
                        disabled={isPlaceholderImage}
                    >
                        Generate Sheet with AI
                    </button>
                    {isPlaceholderImage && <p className="text-xs text-center text-gray-500 pt-1">Upload a base image to enable the AI Sheet Generator.</p>}
                </div>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 lg:col-span-2">
                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2">Main Description</h3>
                <FormField 
                    label="Detailed Description for AI" 
                    value={editedChar.description} 
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    isTextarea={true}
                    rows={5}
                    placeholder="High-level summary of the character's role, personality, and key visual traits."
                />

                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2 mt-6">Physical Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Apparent Age" value={editedChar.apparentAge || ''} onChange={(e) => handleFieldChange('apparentAge', e.target.value)} />
                    <FormField label="Height & Complexion" value={editedChar.heightAndComplexion || ''} onChange={(e) => handleFieldChange('heightAndComplexion', e.target.value)} />
                    <FormField label="Face" value={editedChar.face || ''} onChange={(e) => handleFieldChange('face', e.target.value)} />
                    <FormField label="Eyes" value={editedChar.eyes || ''} onChange={(e) => handleFieldChange('eyes', e.target.value)} />
                    <FormField label="Hair" value={editedChar.hair || ''} onChange={(e) => handleFieldChange('hair', e.target.value)} />
                    <FormField label="Skin" value={editedChar.skin || ''} onChange={(e) => handleFieldChange('skin', e.target.value)} />
                </div>
                <FormField label="Unique Features" value={editedChar.uniqueFeatures || ''} onChange={(e) => handleFieldChange('uniqueFeatures', e.target.value)} isTextarea={true} />
                
                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2 mt-6">Clothing & Style</h3>
                <FormField label="Base Outfit" value={editedChar.baseOutfit || ''} onChange={(e) => handleFieldChange('baseOutfit', e.target.value)} isTextarea={true}/>
                <FormField label="Accessories" value={editedChar.accessories || ''} onChange={(e) => handleFieldChange('accessories', e.target.value)} />
                <FormField label="Outfit Variations" value={editedChar.outfitVariations || ''} onChange={(e) => handleFieldChange('outfitVariations', e.target.value)} placeholder="e.g., Casual, Combat, Formal" />
                <FormField label="Art Style Note" value={editedChar.artStyle || ''} onChange={(e) => handleFieldChange('artStyle', e.target.value)} isTextarea={true} placeholder="e.g., Always render in a gritty, sketchy style." />
                
                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2 mt-6">Behavior</h3>
                <FormField label="Body Language / Typical Poses" value={editedChar.bodyLanguage || ''} onChange={(e) => handleFieldChange('bodyLanguage', e.target.value)} isTextarea={true}/>
                <FormField label="Facial Expressions" value={editedChar.facialExpressions || ''} onChange={(e) => handleFieldChange('facialExpressions', e.target.value)} placeholder="e.g., Stoic, often smirks, rarely shows surprise"/>
            </div>
        </div>
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-700">
          <button
            onClick={handleDelete}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-900/50 rounded-md hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="w-4 h-4" /> Delete
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
              {isCreating ? 'Create Character' : 'Save Changes'}
            </button>
          </div>
        </div>
        </>
      ) : (
        <CharacterSheetGenerator 
            baseImage={editedChar.referenceImage}
            onFinalize={handleSheetFinalized}
            onCancel={() => setView('form')}
        />
      )}
    </Modal>
  );
};
