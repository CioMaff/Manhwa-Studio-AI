
import React, { useState } from 'react';
import { Modal } from './Modal';
import { editPanelImage } from '../services/geminiService';
import { showToast } from '../systems/uiSystem';

interface MagicEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  subPanelImage: string;
  onSave: (newImage: string) => void;
}

export const MagicEditModal: React.FC<MagicEditModalProps> = ({ isOpen, onClose, subPanelImage, onSave }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = async () => {
    if (!prompt.trim()) {
      showToast("Describe el cambio que quieres realizar.", 'error');
      return;
    }
    setIsLoading(true);
    try {
      // We pass the prompt to the service which handles the image-to-image transformation
      const newImage = await editPanelImage(subPanelImage, prompt);
      onSave(newImage);
      showToast("¡Edición mágica completada!", 'success');
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Error al editar la imagen.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edición Mágica (Magic Edit)" maxWidth="max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[60vh]">
        {/* Preview Section */}
        <div className="relative rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center">
            <img src={subPanelImage} alt="Original" className="max-w-full max-h-full object-contain" />
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-mono text-white/70">Original</div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col gap-4">
            <div className="bg-violet-900/20 border border-violet-500/30 p-4 rounded-lg">
                <h4 className="text-violet-300 font-bold text-sm mb-2 flex items-center gap-2">
                    <span className="text-lg">✨</span> Instrucciones para la IA
                </h4>
                <p className="text-gray-400 text-xs mb-4">
                    Describe <b>SOLO</b> lo que quieres cambiar. La IA intentará mantener el resto de la composición intacta.
                </p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ej: 'Cambia el color de ojos a rojo brillante', 'Añade lluvia intensa', 'Haz que sonría maliciosamente'..."
                    className="w-full h-32 bg-gray-900 border border-gray-700 rounded-md p-3 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none"
                />
            </div>

            <div className="mt-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-4 bg-gray-800 rounded-lg">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500 mb-2"></div>
                        <p className="text-xs text-violet-300 animate-pulse">Aplicando magia...</p>
                    </div>
                ) : (
                    <button
                        onClick={handleEdit}
                        disabled={!prompt.trim()}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <span>🪄</span> Aplicar Cambios
                    </button>
                )}
            </div>
        </div>
      </div>
    </Modal>
  );
};
