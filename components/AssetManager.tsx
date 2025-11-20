import React, { useState, useMemo } from 'react';
import type { Character, ObjectAsset, BackgroundAsset } from '../types';
import { fileToBase64, textFileToString, compressImageBase64 } from '../utils/fileUtils';
import { PlusIcon } from './icons/PlusIcon';
import { ImageViewerModal } from './ImageViewerModal';
import { TrashIcon } from './icons/TrashIcon';
import { showConfirmation, showToast } from '../systems/uiSystem';
import { useProject } from '../contexts/ProjectContext';

const Section: React.FC<{ title: string; children: React.ReactNode; onAdd?: () => void; }> = ({ title, children, onAdd }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="mb-3">
      <div 
        className={`flex justify-between items-center p-3 cursor-pointer rounded-lg transition-all ${isOpen ? 'bg-white/5' : 'hover:bg-white/5'}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-2">
            {onAdd && <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="p-1 rounded-full bg-white/5 hover:bg-violet-600 text-gray-400 hover:text-white transition-all">
                <PlusIcon className="w-3.5 h-3.5" />
            </button>}
            <span className={`transform transition-transform text-gray-600 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </div>
      {isOpen && <div className="p-2 animate-fade-in-up">{children}</div>}
    </div>
  );
};

export interface AssetManagerProps {
  onOpenCharacterModal: (character?: Character | { referenceImage: string, description: string }) => void;
}


export const AssetManager: React.FC<AssetManagerProps> = ({ onOpenCharacterModal }) => {
    const { project, updateProject } = useProject();
    const { characters, objects, backgrounds, styleReferences, knowledgeBase, dialogueStyles } = project;
    
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    
    const groupedObjects = useMemo(() => {
        const groups: Record<string, ObjectAsset[]> = {};
        objects.forEach(obj => {
            const ownerName = obj.ownerInfo?.name || 'Various';
            if (!groups[ownerName]) {
                groups[ownerName] = [];
            }
            groups[ownerName].push(obj);
        });
        if (groups['Various']) {
            const various = groups['Various'];
            delete groups['Various'];
            groups['Various'] = various;
        }
        return groups;
    }, [objects]);


    const handleAddAsset = async (e: React.ChangeEvent<HTMLInputElement>, type: 'style' | 'dialogue' | 'object' | 'background') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            const compressed = await compressImageBase64(base64);
            
            if (type === 'object') {
                 const newAsset: ObjectAsset = { id: Date.now().toString(), name: file.name, image: compressed, ownerInfo: { type: 'various', name: 'Various' } };
                 updateProject(p => ({ ...p, objects: [...p.objects, newAsset]}));
            } else {
                const newAsset = { id: Date.now().toString(), name: file.name, image: compressed };
                updateProject(p => {
                    if (type === 'style') return { ...p, styleReferences: [...p.styleReferences, newAsset]};
                    if (type === 'dialogue') return { ...p, dialogueStyles: [...p.dialogueStyles, newAsset]};
                    if (type === 'background') return { ...p, backgrounds: [...p.backgrounds, newAsset] };
                    return p;
                });
            }
            e.target.value = ''; // Reset input
        }
    };
    
    const handleAddKnowledgeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === "application/pdf") {
                 showToast("PDF parsing is not fully supported.", "info");
                 updateProject(p => ({...p, knowledgeBase: [...p.knowledgeBase, { id: Date.now().toString(), name: file.name, content: `PDF file: ${file.name}` }]}));
            } else {
                const content = await textFileToString(file);
                updateProject(p => ({...p, knowledgeBase: [...p.knowledgeBase, { id: Date.now().toString(), name: file.name, content }]}));
            }
             e.target.value = ''; // Reset input
        }
    };
    
    const handleDelete = async (type: 'character' | 'style' | 'knowledge' | 'dialogue' | 'object' | 'background', id: string) => {
        const confirmed = await showConfirmation({
            title: `Delete ${type}`,
            message: `Are you sure you want to delete this ${type}? This cannot be undone.`
        });
        if (confirmed) {
            updateProject(p => {
                const newState = { ...p };
                switch (type) {
                    case 'character':
                        newState.characters = p.characters.filter(i => i.id !== id);
                        break;
                    case 'style':
                        newState.styleReferences = p.styleReferences.filter(i => i.id !== id);
                        break;
                    case 'knowledge':
                        newState.knowledgeBase = p.knowledgeBase.filter(i => i.id !== id);
                        break;
                    case 'dialogue':
                        newState.dialogueStyles = p.dialogueStyles.filter(i => i.id !== id);
                        break;
                    case 'object':
                        newState.objects = p.objects.filter(i => i.id !== id);
                        break;
                    case 'background':
                        newState.backgrounds = p.backgrounds.filter(i => i.id !== id);
                        break;
                    default:
                        return p;
                }
                return newState;
            });
        }
    };

    return (
        <div className="h-full overflow-y-auto pr-1 custom-scrollbar pt-2">
            <Section title="Characters" onAdd={() => onOpenCharacterModal()}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {characters.map(char => (
                        <div key={char.id} className="text-center group relative cursor-pointer aspect-[3/4] rounded-lg overflow-hidden border border-white/5 hover:border-violet-500/50 transition-all hover:scale-[1.02]" onClick={() => onOpenCharacterModal(char)}>
                            <img src={char.referenceImage} alt={char.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                            <div className="absolute bottom-0 left-0 right-0 p-2">
                                <p className="text-xs font-semibold truncate text-white drop-shadow-md">{char.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
                 {characters.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No characters yet.</p>}
            </Section>

            <Section title="Style References" onAdd={() => document.getElementById('style-ref-upload')?.click()}>
                <input type="file" id="style-ref-upload" className="hidden" accept="image/*" onChange={(e) => handleAddAsset(e, 'style')} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {styleReferences.map(ref => (
                        <div key={ref.id} className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-green-500/50 transition-all" onClick={() => setViewingImage(ref.image)}>
                            <img src={ref.image} alt={ref.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                             <button onClick={(e) => { e.stopPropagation(); handleDelete('style', ref.id);}} className="absolute top-1 right-1 bg-red-600/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 backdrop-blur-sm">
                                <TrashIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
                {styleReferences.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No styles.</p>}
            </Section>
            
            <Section title="Objects" onAdd={() => document.getElementById('object-upload')?.click()}>
                <input type="file" id="object-upload" className="hidden" accept="image/*" onChange={(e) => handleAddAsset(e, 'object')} />
                 <div className="space-y-2">
                    {Object.entries(groupedObjects).map(([ownerName, ownerObjects]) => (
                        <div key={ownerName} className="bg-white/5 rounded-lg p-2">
                            <h4 className="text-[10px] font-bold text-violet-300 mb-2 uppercase">{ownerName}</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {(ownerObjects as ObjectAsset[]).map(ref => (
                                    <div key={ref.id} className="relative group cursor-pointer aspect-square rounded-md overflow-hidden border border-white/5 hover:border-orange-500/50 transition-all" onClick={() => setViewingImage(ref.image)}>
                                        <img src={ref.image} alt={ref.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete('object', ref.id);}} className="text-red-400 hover:text-red-300">
                                                <TrashIcon className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {objects.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No objects.</p>}
            </Section>

            <Section title="Backgrounds" onAdd={() => document.getElementById('background-upload')?.click()}>
                <input type="file" id="background-upload" className="hidden" accept="image/*" onChange={(e) => handleAddAsset(e, 'background')} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {backgrounds.map(ref => (
                        <div key={ref.id} className="relative group cursor-pointer aspect-video rounded-lg overflow-hidden border border-white/5 hover:border-blue-500/50 transition-all" onClick={() => setViewingImage(ref.image)}>
                            <img src={ref.image} alt={ref.name} className="w-full h-full object-cover" />
                             <button onClick={(e) => { e.stopPropagation(); handleDelete('background', ref.id);}} className="absolute top-1 right-1 bg-red-600/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 backdrop-blur-sm">
                                <TrashIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
                {backgrounds.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No backgrounds.</p>}
            </Section>

             <Section title="Dialogue Styles" onAdd={() => document.getElementById('dialogue-style-upload')?.click()}>
                <input type="file" id="dialogue-style-upload" className="hidden" accept="image/*" onChange={(e) => handleAddAsset(e, 'dialogue')} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {dialogueStyles.map(ref => (
                        <div key={ref.id} className="relative group cursor-pointer aspect-video bg-gray-800 rounded-lg overflow-hidden border border-white/5 hover:border-yellow-500/50 transition-all" onClick={() => setViewingImage(ref.image)}>
                            <img src={ref.image} alt={ref.name} className="w-full h-full object-contain p-1" />
                             <button onClick={(e) => { e.stopPropagation(); handleDelete('dialogue', ref.id);}} className="absolute top-1 right-1 bg-red-600/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 backdrop-blur-sm">
                                <TrashIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
                {dialogueStyles.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No styles.</p>}
            </Section>

            <Section title="Knowledge Base" onAdd={() => document.getElementById('knowledge-upload')?.click()}>
                 <input type="file" id="knowledge-upload" className="hidden" accept=".txt,.pdf" onChange={handleAddKnowledgeFile} />
                <ul className="space-y-1">
                    {knowledgeBase.map(file => (
                        <li key={file.id} className="text-xs text-gray-300 bg-white/5 hover:bg-white/10 transition-colors p-2 rounded-md flex justify-between items-center group border border-white/5">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-gray-500">📄</span>
                                <span className="truncate">{file.name}</span>
                            </div>
                            <button onClick={() => handleDelete('knowledge', file.id)} className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
                 {knowledgeBase.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No documents.</p>}
            </Section>
            
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