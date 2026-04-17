
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

  const handleFieldChange = (field: keyof Character, value: any) => {
    setEditedChar(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!editedChar.name?.trim()) {
        showToast("Character name is required.", 'error');
        return;
    }
    // Strict Mandatory Check
    if (!editedChar.gender) {
        showToast("¡Alto! 🛑 Debes seleccionar si es HOMBRE o MUJER.", 'error');
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
      if (isCreating && updatedChar.name && updatedChar.gender) {
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
          // If gender isn't set yet, show a toast reminding them
          if (!editedChar.gender) {
              showToast("Imagen cargada. Ahora selecciona el GÉNERO.", 'info');
          }
          e.target.value = ''; // Reset input
      }
  };

  if (!character) return null;
  const title = isCreating ? "Crear Nuevo Personaje" : `Editar ${editedChar.name}`;
  const isPlaceholderImage = editedChar.referenceImage.startsWith('data:image/svg+xml');
  const isGenderMissing = !editedChar.gender;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-6xl">
       <input type="file" ref={hiddenUploadRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
      {view === 'form' ? (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4 lg:col-span-1">
                <div className="w-full aspect-[3/4] rounded-lg bg-gray-900 overflow-hidden relative group border border-white/10">
                    <img src={editedChar.referenceImage} alt={editedChar.name} className="w-full h-full object-contain" />
                    <button onClick={() => hiddenUploadRef.current?.click()} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-bold cursor-pointer backdrop-blur-sm">
                        Subir Imagen
                    </button>
                </div>
                
                <div className={`p-4 rounded-lg border-2 transition-all ${isGenderMissing ? 'bg-red-900/10 border-red-500/50 animate-pulse' : 'bg-gray-800/50 border-green-500/30'}`}>
                    <label className={`block text-xs font-bold mb-3 uppercase tracking-wider ${isGenderMissing ? 'text-red-400' : 'text-gray-400'}`}>
                        Género (Obligatorio) {isGenderMissing && '*'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => handleFieldChange('gender', 'male')}
                            className={`py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${editedChar.gender === 'male' ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105' : 'bg-gray-700/50 border-transparent text-gray-400 hover:bg-gray-700'}`}
                        >
                            <span>♂</span> Hombre
                        </button>
                        <button 
                            onClick={() => handleFieldChange('gender', 'female')}
                            className={`py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${editedChar.gender === 'female' ? 'bg-pink-600 border-pink-400 text-white shadow-[0_0_15px_rgba(219,39,119,0.5)] scale-105' : 'bg-gray-700/50 border-transparent text-gray-400 hover:bg-gray-700'}`}
                        >
                            <span>♀</span> Mujer
                        </button>
                    </div>
                </div>

                <FormField label="Nombre" value={editedChar.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                
                 <div className="space-y-2 pt-2">
                    <button 
                        onClick={() => {
                            if (isPlaceholderImage) {
                                showToast("Sube una imagen de referencia primero.", "info");
                                return;
                            }
                            setView('sheet_generator');
                        }}
                        className="w-full text-center py-2 px-4 rounded-md bg-purple-600 hover:bg-purple-700 transition-colors disabled:bg-gray-500/50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white"
                        disabled={isPlaceholderImage}
                    >
                        Generar Hoja de Personaje IA
                    </button>
                </div>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 lg:col-span-2 custom-scrollbar">
                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2">Descripción Principal</h3>
                <FormField 
                    label="Descripción Detallada (Prompt IA)" 
                    value={editedChar.description} 
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    isTextarea={true}
                    rows={5}
                    placeholder="Describe el rol, personalidad y rasgos visuales clave."
                />

                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2 mt-6">Detalles Físicos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Edad Aparente" value={editedChar.apparentAge || ''} onChange={(e) => handleFieldChange('apparentAge', e.target.value)} />
                    <FormField label="Altura y Complexión" value={editedChar.heightAndComplexion || ''} onChange={(e) => handleFieldChange('heightAndComplexion', e.target.value)} />
                    <FormField label="Rostro" value={editedChar.face || ''} onChange={(e) => handleFieldChange('face', e.target.value)} />
                    <FormField label="Ojos" value={editedChar.eyes || ''} onChange={(e) => handleFieldChange('eyes', e.target.value)} />
                    <FormField label="Cabello" value={editedChar.hair || ''} onChange={(e) => handleFieldChange('hair', e.target.value)} />
                    <FormField label="Piel" value={editedChar.skin || ''} onChange={(e) => handleFieldChange('skin', e.target.value)} />
                </div>
                <FormField label="Rasgos Únicos (Cicatrices, etc)" value={editedChar.uniqueFeatures || ''} onChange={(e) => handleFieldChange('uniqueFeatures', e.target.value)} isTextarea={true} />
                
                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2 mt-6">Ropa y Estilo</h3>
                <FormField label="Atuendo Base (Obligatorio)" value={editedChar.baseOutfit || ''} onChange={(e) => handleFieldChange('baseOutfit', e.target.value)} isTextarea={true} placeholder="La IA forzará este atuendo en todas las viñetas."/>
                <FormField label="Accesorios" value={editedChar.accessories || ''} onChange={(e) => handleFieldChange('accessories', e.target.value)} />
                
                <h3 className="text-lg font-semibold text-purple-300 border-b border-gray-600 pb-2 mt-6">Comportamiento</h3>
                <FormField label="Lenguaje Corporal" value={editedChar.bodyLanguage || ''} onChange={(e) => handleFieldChange('bodyLanguage', e.target.value)} isTextarea={true}/>
                <FormField label="Expresiones Faciales" value={editedChar.facialExpressions || ''} onChange={(e) => handleFieldChange('facialExpressions', e.target.value)} placeholder="Ej: Estoico, sonríe a menudo..."/>
            </div>
        </div>
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-700">
          <button
            onClick={handleDelete}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-900/50 rounded-md hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="w-4 h-4" /> Borrar
          </button>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isGenderMissing}
              className={`px-6 py-2 text-sm font-bold text-white rounded-md shadow-lg transform transition-all ${isGenderMissing ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:-translate-y-0.5'}`}
            >
              {isCreating ? 'Crear Personaje' : 'Guardar Cambios'}
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
