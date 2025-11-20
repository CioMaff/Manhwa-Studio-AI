import React, { useState } from 'react';
import { Modal } from './Modal';
import { layouts as layoutData } from './layouts';
import type { SubPanel } from '../types';
import { showToast } from '../systems/uiSystem';

interface ContinuePanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceSubPanel: SubPanel;
  onConfirm: (layout: number[][], prompt: string, maintainConsistency: boolean) => void;
}

const LayoutOption: React.FC<{ id: string; name: string; grid: number[][]; isSelected: boolean; onSelect: () => void }> = ({ id, name, grid, isSelected, onSelect }) => {
    return (
        <button 
            onClick={onSelect} 
            className={`flex flex-col items-center justify-center p-2 border-2 rounded-md transition-all ${isSelected ? 'border-purple-500 bg-purple-900/30' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}
        >
            <div className="w-full aspect-square bg-gray-700 p-1 gap-0.5 grid" style={{ gridTemplateRows: `repeat(${grid.length}, 1fr)`, gridTemplateColumns: `repeat(${grid[0].length}, 1fr)` }}>
                {Array.from(new Set(grid.flat())).map(pid => (
                    <div key={pid} className="bg-gray-500 rounded-sm w-full h-full" style={{ gridArea: (() => {
                        let rs=99,re=0,cs=99,ce=0;
                        grid.forEach((r, ri) => r.forEach((c, ci) => { if(c===pid){ rs=Math.min(rs, ri+1); re=Math.max(re, ri+2); cs=Math.min(cs, ci+1); ce=Math.max(ce, ci+2); }}));
                        return `${rs}/${cs}/${re}/${ce}`;
                    })()}}></div>
                ))}
            </div>
            <span className="text-[10px] mt-1 text-gray-300">{name}</span>
        </button>
    )
}

export const ContinuePanelModal: React.FC<ContinuePanelModalProps> = ({ isOpen, onClose, sourceSubPanel, onConfirm }) => {
    const [prompt, setPrompt] = useState('');
    const [selectedLayoutKey, setSelectedLayoutKey] = useState('1');
    const [maintainConsistency, setMaintainConsistency] = useState(true);

    const handleConfirm = () => {
        if (!prompt.trim()) {
            showToast("Please describe what happens next.", "error");
            return;
        }
        onConfirm(layoutData[selectedLayoutKey], prompt, maintainConsistency);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Continuar Historia (Director Mode)" maxWidth="max-w-4xl">
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
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">Siguiente Escena</h3>
                    
                    {/* Layout Picker Mini */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Layout de la siguiente viñeta</label>
                        <div className="grid grid-cols-4 gap-2">
                            <LayoutOption id="1" name="Single" grid={layoutData['1']} isSelected={selectedLayoutKey === '1'} onSelect={() => setSelectedLayoutKey('1')} />
                            <LayoutOption id="2v" name="2 Vert" grid={layoutData['2v']} isSelected={selectedLayoutKey === '2v'} onSelect={() => setSelectedLayoutKey('2v')} />
                            <LayoutOption id="2h" name="2 Horiz" grid={layoutData['2h']} isSelected={selectedLayoutKey === '2h'} onSelect={() => setSelectedLayoutKey('2h')} />
                            <LayoutOption id="3h" name="3 Strip" grid={layoutData['3h']} isSelected={selectedLayoutKey === '3h'} onSelect={() => setSelectedLayoutKey('3h')} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">¿Qué sucede ahora?</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe la acción siguiente. Ej: 'El personaje saca su espada y se prepara para atacar.'"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none h-24 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-md border border-gray-700">
                        <input 
                            type="checkbox" 
                            id="consistency" 
                            checked={maintainConsistency} 
                            onChange={(e) => setMaintainConsistency(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-gray-700 border-gray-500"
                        />
                        <label htmlFor="consistency" className="text-sm text-gray-300 cursor-pointer select-none">
                            <strong>Strict Consistency:</strong> Usar panel anterior como referencia visual directa.
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