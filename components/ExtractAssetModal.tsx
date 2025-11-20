import React, { useState } from 'react';
import { Modal } from './Modal';

interface ExtractAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  subPanelImage: string;
  onExtract: (baseImage: string, prompt: string) => void;
}

export const ExtractAssetModal: React.FC<ExtractAssetModalProps> = ({ isOpen, onClose, subPanelImage, onExtract }) => {
  const [prompt, setPrompt] = useState('');

  const handleExtract = () => {
    if (prompt.trim()) {
      onExtract(subPanelImage, prompt);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manually Extract Asset" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Describe el objeto o personaje que quieres extraer de esta imagen. La IA lo creará como un nuevo asset de consistencia.
        </p>
        <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md overflow-hidden">
                <img src={subPanelImage} alt="Panel Reference" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-4">
                 <textarea
                    placeholder="Ej: 'la espada oxidada del goblin' o 'el personaje del goblin'"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 h-32"
                />
                <button
                    onClick={handleExtract}
                    disabled={!prompt.trim()}
                    className="w-full bg-yellow-600 text-white font-bold py-2 rounded-md hover:bg-yellow-700 disabled:bg-gray-500"
                >
                    Extract Asset
                </button>
            </div>
        </div>
      </div>
    </Modal>
  );
};