
import React, { useState } from 'react';
import type { Project, Character } from '../types';
import { fileToBase64, textFileToString, compressImageBase64 } from '../utils/fileUtils';
import { generateCharacterImage } from '../services/geminiService';
import { PlusIcon } from './icons/PlusIcon';
import { Modal } from './Modal';
import { Loader } from './Loader';
import { CharacterEditorModal } from './CharacterEditorModal';
import { ImageViewerModal } from './ImageViewerModal';
import { TrashIcon } from './icons/TrashIcon';

interface AssetManagerProps {
  project: Project;
  updateProject: (updater: (prev: Project) => Project) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode; onAdd?: () => void; }> = ({ title, children, onAdd }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 mb-4">
      <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
        <div className="flex items-center gap-2">
            {onAdd && <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="p-1 rounded-full hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 transition-all">
                <PlusIcon className="w-5 h-5" />
            </button>}
            <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </div>
      {isOpen && <div className="p-3 border-t border-gray-700">{children}</div>}
    </div>
  );
};


export const AssetManager: React.FC<AssetManagerProps> = ({ project, updateProject }) => {
    const { characters, styleReferences, knowledgeBase, dialogueStyles } = project;
    
    const [isCharModalOpen, setCharModalOpen] = useState(false);
    const [newCharName, setNewCharName] = useState('');
    const [newCharDesc, setNewCharDesc] = useState('');
    const [newCharImgBase64, setNewCharImgBase64] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const handleAddStyleRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            const compressed = await compressImageBase64(base64);
            updateProject(p => ({ ...p, styleReferences: [...p.styleReferences, { id: Date.now().toString(), name: file.name, image: compressed }]}));
            e.target.value = ''; // Reset input
        }
    };

     const handleAddDialogueStyle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            const compressed = await compressImageBase64(base64);
            updateProject(p => ({ ...p, dialogueStyles: [...p.dialogueStyles, { id: Date.now().toString(), name: file.name, image: compressed }]}));
            e.target.value = ''; // Reset input
        }
    };
    
    const handleAddKnowledgeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === "application/pdf") {
                 alert("PDF parsing is not fully supported. The file name will be used as context for now.");
                 updateProject(p => ({...p, knowledgeBase: [...p.knowledgeBase, { id: Date.now().toString(), name: file.name, content: `PDF file: ${file.name}` }]}));
            } else {
                const content = await textFileToString(file);
                updateProject(p => ({...p, knowledgeBase: [...p.knowledgeBase, { id: Date.now().toString(), name: file.name, content }]}));
            }
             e.target.value = ''; // Reset input
        }
    };
    
    const handleDelete = (type: 'character' | 'style' | 'knowledge' | 'dialogue', id: string) => {
        if(window.confirm(`Are you sure you want to delete this ${type}?`)) {
            if (type === 'character') updateProject(p => ({ ...p, characters: p.characters.filter(i => i.id !== id) }));
            if (type === 'style') updateProject(p => ({ ...p, styleReferences: p.styleReferences.filter(i => i.id !== id) }));
            if (type === 'knowledge') updateProject(p => ({ ...p, knowledgeBase: p.knowledgeBase.filter(i => i.id !== id) }));
            if (type === 'dialogue') updateProject(p => ({ ...p, dialogueStyles: p.dialogueStyles.filter(i => i.id !== id) }));
        }
    };
    
    const handleCharacterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setNewCharImgBase64(base64);
        }
    };

    const handleCreateCharacter = (useDirectImage: boolean) => {
        if (!newCharName.trim() || !newCharImgBase64) {
            alert("Please provide a name and a reference image.");
            return;
        }
        
        if (useDirectImage) {
            compressImageBase64(newCharImgBase64).then(compressed => {
                updateProject(p => ({ ...p, characters: [...p.characters, { id: Date.now().toString(), name: newCharName, description: newCharDesc, referenceImage: compressed }] }));
                resetCharModal();
            });
        } else {
            setIsLoading(true);
            setLoadingMessage("Generating 360° Character Sheet...");
            generateCharacterImage(newCharDesc, newCharImgBase64)
                .then(compressImageBase64)
                .then(compressedImage => {
                    updateProject(p => ({ ...p, characters: [...p.characters, { id: Date.now().toString(), name: newCharName, description: newCharDesc, referenceImage: compressedImage }] }));
                    resetCharModal();
                })
                .catch(error => {
                    console.error("Failed to create character:", error);
                    alert(`Failed to generate character sheet. Error: ${(error as Error).message || 'Unknown error'}`);
                })
                .finally(() => setIsLoading(false));
        }
    };
    
    const handleSaveEditedCharacter = (editedChar: Character) => {
        updateProject(p => ({ ...p, characters: p.characters.map(c => c.id === editedChar.id ? editedChar : c) }));
        setEditingCharacter(null);
    };

    const resetCharModal = () => {
        setCharModalOpen(false);
        setNewCharName('');
        setNewCharDesc('');
        setNewCharImgBase64(null);
    };

    return (
        <div className="h-full overflow-y-auto pr-2">
            {isLoading && <Loader message={loadingMessage} />}
            <Section title="Characters" onAdd={() => setCharModalOpen(true)}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {characters.map(char => (
                        <div key={char.id} className="text-center group relative cursor-pointer aspect-square" onClick={() => setEditingCharacter(char)}>
                            <img src={char.referenceImage} alt={char.name} className="rounded-md w-full h-full object-cover" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                                <p className="text-sm truncate text-white">{char.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
                 {characters.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Add your first character.</p>}
            </Section>

            <Section title="Style References" onAdd={() => document.getElementById('style-ref-upload')?.click()}>
                <input type="file" id="style-ref-upload" className="hidden" accept="image/*" onChange={handleAddStyleRef} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {styleReferences.map(ref => (
                        <div key={ref.id} className="relative group cursor-pointer" onClick={() => setViewingImage(ref.image)}>
                            <img src={ref.image} alt={ref.name} className="rounded-md aspect-square object-cover" />
                             <button onClick={(e) => { e.stopPropagation(); handleDelete('style', ref.id);}} className="absolute top-1 right-1 bg-red-600/70 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                                <TrashIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
                {styleReferences.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Add style references.</p>}
            </Section>

             <Section title="Dialogue Styles" onAdd={() => document.getElementById('dialogue-style-upload')?.click()}>
                <input type="file" id="dialogue-style-upload" className="hidden" accept="image/*" onChange={handleAddDialogueStyle} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {dialogueStyles.map(ref => (
                        <div key={ref.id} className="relative group cursor-pointer" onClick={() => setViewingImage(ref.image)}>
                            <img src={ref.image} alt={ref.name} className="rounded-md aspect-square object-cover" />
                             <button onClick={(e) => { e.stopPropagation(); handleDelete('dialogue', ref.id);}} className="absolute top-1 right-1 bg-red-600/70 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                                <TrashIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
                {dialogueStyles.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Add dialogue style references.</p>}
            </Section>

            <Section title="Knowledge Base" onAdd={() => document.getElementById('knowledge-upload')?.click()}>
                 <input type="file" id="knowledge-upload" className="hidden" accept=".txt,.pdf" onChange={handleAddKnowledgeFile} />
                <ul className="space-y-1">
                    {knowledgeBase.map(file => (
                        <li key={file.id} className="text-sm text-gray-300 bg-gray-700/50 p-2 rounded-md flex justify-between items-center">
                            <span className="truncate pr-2">{file.name}</span>
                            <button onClick={() => handleDelete('knowledge', file.id)} className="text-red-400 hover:text-red-300 flex-shrink-0">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
                 {knowledgeBase.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Upload .txt or .pdf story files.</p>}
            </Section>

            <Modal isOpen={isCharModalOpen} onClose={resetCharModal} title="Add New Character">
                <div className="space-y-4">
                    <input type="text" placeholder="Character Name" value={newCharName} onChange={e => setNewCharName(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <textarea placeholder="Character Description" value={newCharDesc} onChange={e => setNewCharDesc(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500" rows={3}></textarea>
                    
                    {!newCharImgBase64 && <input type="file" accept="image/*" onChange={handleCharacterImageUpload} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700" />}
                    
                    {newCharImgBase64 && (
                        <div className="text-center space-y-3">
                            <p className="text-sm text-gray-300">Reference image loaded:</p>
                            <img src={newCharImgBase64} alt="Character Reference" className="max-h-40 mx-auto rounded-md" />
                            <p className="text-sm text-gray-400">How do you want to use this image?</p>
                            <div className="flex gap-4">
                               <button onClick={() => handleCreateCharacter(true)} className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500 transition-colors">
                                    Use Directly
                                </button>
                                <button onClick={() => handleCreateCharacter(false)} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-2 px-4 rounded-md hover:opacity-90 transition-opacity">
                                    Generate 360° Sheet
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
            
            {editingCharacter && (
                <CharacterEditorModal 
                    isOpen={!!editingCharacter}
                    onClose={() => setEditingCharacter(null)}
                    character={editingCharacter}
                    onSave={handleSaveEditedCharacter}
                    onDelete={(id) => {
                        handleDelete('character', id);
                        setEditingCharacter(null);
                    }}
                />
            )}
            
            {viewingImage && (
                <ImageViewerModal 
                    isOpen={!!viewingImage}
                    onClose={() => setViewingImage(null)}
                    imageUrl={viewingImage}
                />
            )}
        </div>
    );
};