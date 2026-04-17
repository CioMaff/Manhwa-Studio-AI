
import React, { useState } from 'react';
import { Modal } from './Modal';
import { layouts as layoutData } from './layouts';
import type { SubPanel, Character } from '../types';
import { showToast } from '../systems/uiSystem';
import { useProject } from '../contexts/ProjectContext';
import { describeImage } from '../services/geminiService';

interface ContinuePanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceSubPanel: SubPanel;
  onConfirm: (layout: number[][], prompt: string, maintainConsistency: boolean, characterIds: string[]) => void;
}

const LayoutOption: React.FC<{ id: string; name: string; grid: number[][]; isSelected: boolean; onSelect: () => void }> = ({ id, name, grid, isSelected, onSelect }) => {
    // Safety Check: Ensure grid is valid array with content
    if (!grid || !Array.isArray(grid) || grid.length === 0) return null;
    const cols = grid[0]?.length || 1;
    
    return (
        <button 
            onClick={onSelect} 
            className={`flex flex-col items-center justify-center p-2 border-2 rounded-md transition-all h-full ${isSelected ? 'border-purple-500 bg-purple-900/30' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}
        >
            <div className="w-full aspect-[3/4] bg-gray-700 p-1 gap-0.5 grid" style={{ gridTemplateRows: `repeat(${grid.length}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from(new Set(grid.flat())).map(pid => (
                    <div key={pid} className="bg-gray-500 rounded-sm w-full h-full" style={{ gridArea: (() => {
                        let rs=99,re=0,cs=99,ce=0;
                        grid.forEach((r, ri) => r.forEach((c, ci) => { if(c===pid){ rs=Math.min(rs, ri+1); re=Math.max(re, ri+2); cs=Math.min(cs, ci+1); ce=Math.max(ce, ci+2); }}));
                        return `${rs}/${cs}/${re}/${ce}`;
                    })()}}></div>
                ))}
            </div>
            <span className="text-[9px] mt-1 text-gray-300 text-center leading-tight">{name}</span>
        </button>
    )
}

const layoutOptions = [
    { id: '1', name: 'Single' },
    // '1-tall' removed, replaced with vertical standard '1' if needed, but keeping existing options that exist in layouts.ts
    { id: '2v', name: '2 Vert' },
    { id: '2h', name: '2 Horiz' },
    { id: 'slash-diag', name: 'Slash' },
    { id: 'reaction-inset', name: 'Inset' },
    { id: '3v', name: '3 Vert' },
    { id: 'complex-5', name: 'Complex' },
];

export const ContinuePanelModal: React.FC<ContinuePanelModalProps> = ({ isOpen, onClose, sourceSubPanel, onConfirm }) => {
    const { project } = useProject();
    const [prompt, setPrompt] = useState('');
    const [selectedLayoutKey, setSelectedLayoutKey] = useState('1');
    const [maintainConsistency, setMaintainConsistency] = useState(true);
    const [selectedCharIds, setSelectedCharIds] = useState<string[]>(sourceSubPanel.characterIds || []);
    const [isThinking, setIsThinking] = useState(false);

    const handleConfirm = () => {
        if (!prompt.trim()) {
            showToast("Please describe what happens next.", "error");
            return;
        }
        onConfirm(layoutData[selectedLayoutKey], prompt, maintainConsistency, selectedCharIds);
    };

    const handleSuggestNext = async () => {
        if (!sourceSubPanel.imageUrl) return;
        setIsThinking(true);
        try {
            const suggestion = await describeImage(sourceSubPanel.imageUrl, "Act as a Manhwa Director. Analyze this panel. What should logically happen in the VERY NEXT panel to advance the action or dialogue? Keep it brief and punchy (max 1 sentence). Write only the scene description.");
            setPrompt(suggestion);
        } catch (e) {
            console.error(e);
            showToast("Could not suggest next scene.", 'error');
        } finally {
            setIsThinking(false);
        }
    }

    const toggleCharacter = (id: string) => {
        setSelectedCharIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Continuar Historia (Director Mode)" maxWidth="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Source Context */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">Panel Anterior (Origen)</h3>
                    <div className="rounded-lg overflow-hidden border-2 border-purple-500/50 bg-gray-900">
                        {sourceSubPanel.imageUrl ? (
                            <img src={sourceSubPanel.imageUrl} alt="Source" className="w-full h-auto object-contain max-h-[300px]" />
                        ) : (
                            <div className="h-48 flex items-center justify-center text-gray-500">No image available</div>
                        )}
                    </div>
                    <div className="bg-gray-800 p-3 rounded-md text-xs text-gray-400">
                        <p className="font-semibold mb-1">Prompt Original:</p>
                        <p className="italic">"{sourceSubPanel.prompt}"</p>
                    </div>
                </div>

                {/* Right Column: Next Steps */}
                <div className="space-y-4 h-full flex flex-col">
                    <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Siguiente Escena</h3>
                    
                    {/* Layout Picker Mini */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Layout de la siguiente viñeta</label>
                        <div className="grid grid-cols-4 gap-2">
                            {layoutOptions.map(opt => (
                                <LayoutOption 
                                    key={opt.id} 
                                    id={opt.id} 
                                    name={opt.name} 
                                    grid={layoutData[opt.id]} 
                                    isSelected={selectedLayoutKey === opt.id} 
                                    onSelect={() => setSelectedLayoutKey(opt.id)} 
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-medium text-gray-400">¿Qué sucede ahora?</label>
                            <button onClick={handleSuggestNext} disabled={isThinking} className="text-[10px] flex items-center gap-1 text-cyan-400 hover:text-cyan-300 bg-cyan-900/30 px-2 py-1 rounded hover:bg-cyan-900/50 transition-colors">
                                {isThinking ? 'Thinking...' : '✨ Auto-Suggest'}
                            </button>
                        </div>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe la acción siguiente. Ej: 'El personaje saca su espada y se prepara para atacar.'"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none h-24 text-sm resize-none"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Personajes en escena</label>
                        <div className="flex flex-wrap gap-2">
                            {project.characters.map(char => (
                                <button 
                                    key={char.id}
                                    onClick={() => toggleCharacter(char.id)}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs border transition-all ${selectedCharIds.includes(char.id) ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 opacity-50 hover:opacity-100'}`}
                                >
                                    <img src={char.referenceImage} className="w-4 h-4 rounded-full object-cover" />
                                    {char.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-md border border-gray-700 mt-auto">
                        <input 
                            type="checkbox" 
                            id="consistency" 
                            checked={maintainConsistency} 
                            onChange={(e) => setMaintainConsistency(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-gray-700 border-gray-500"
                        />
                        <label htmlFor="consistency" className="text-sm text-gray-300 cursor-pointer select-none">
                            <strong>Strict Consistency:</strong> Usar panel anterior como referencia visual.
                        </label>
                    </div>

                    <button 
                        onClick={handleConfirm}
                        className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold py-3 rounded-md shadow-lg transform transition-all active:scale-95"
                    >
                        Generar Siguiente Viñeta
                    </button>
                </div>
            </div>
        </Modal>
    );
};
