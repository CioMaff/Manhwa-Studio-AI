
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SubPanel } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { RegenerateIcon } from './icons/RegenerateIcon';
import { AnalyzeIcon } from './icons/AnalyzeIcon';
import { MagicWandIcon } from './icons/MagicWandIcon';
import { CharacterFromPanelIcon } from './icons/CharacterFromPanelIcon';
import { ContinuePanelIcon } from './icons/ContinuePanelIcon';

// Simple in-component state to track if a tooltip has been shown in this session
const sessionTooltipsShown = new Set<string>();

export const SubPanelComponent: React.FC<{
    subPanel: SubPanel;
    onGenerateClick: () => void;
    onEditClick: () => void;
    onMagicEditClick: () => void;
    onUploadClick: () => void;
    onDownloadClick: () => void;
    onDeleteContent: () => void;
    onDeletePanel?: () => void;
    onRegenerate: () => void;
    onAddBubble: () => void;
    onAnalyze: () => void;
    onCreateCharacter: () => void;
    onExtractAsset: () => void;
    onContinuePanel: () => void;
    status: 'idle' | 'queued' | 'generating';
    isSelected: boolean;
    onSelect: () => void;
    isAgentMode: boolean;
}> = ({ subPanel, onGenerateClick, onEditClick, onMagicEditClick, onDeleteContent, onDeletePanel, onRegenerate, onAnalyze, onCreateCharacter, onContinuePanel, status, isSelected, onSelect, isAgentMode }) => {

    const [activeExplanation, setActiveExplanation] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    // Close context menu on any outside click / scroll / escape.
    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [contextMenu]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const stopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleActionWithInfo = (e: React.MouseEvent, actionKey: string, explanation: string, action: () => void) => {
        e.stopPropagation();
        // Check if user has seen this explanation in local storage or session
        const hasSeen = localStorage.getItem(`nano_tooltip_${actionKey}`);
        
        if (hasSeen) {
            action();
        } else {
            setActiveExplanation(explanation);
            localStorage.setItem(`nano_tooltip_${actionKey}`, 'true');
            // Clear explanation after 3 seconds automatically if they don't click
            setTimeout(() => {
                if (activeExplanation === explanation) setActiveExplanation(null);
            }, 4000);
        }
    };

    // If explanation is active, clicking runs the action and clears explanation
    const handleConfirmExplanation = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        setActiveExplanation(null);
        action();
    }

    const hasContent = !!subPanel.imageUrl;

    const containerClass = `relative w-full h-full overflow-hidden group border-2 transition-all duration-300 ${isAgentMode ? 'cursor-pointer' : ''} ${
        isSelected 
            ? 'border-violet-500 bg-violet-900/20' 
            : hasContent
                ? 'border-transparent bg-black' 
                : 'border-dashed border-white/10 bg-white/5 hover:bg-white/10'
    }`;

    return (
        <div onClick={onSelect} onContextMenu={handleContextMenu} className={containerClass}>
            {/* Content Layer */}
            {subPanel.imageUrl && (
                <img src={subPanel.imageUrl} alt={subPanel.prompt || 'panel'} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${status === 'generating' ? 'opacity-50 scale-105 blur-sm' : ''}`} />
            )}

            {/* Status Overlay */}
            {(!hasContent || status === 'generating' || status === 'queued') && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 z-10 transition-all ${status === 'generating' ? 'bg-black/80 backdrop-blur-sm' : ''}`}>
                     {status === 'generating' && (
                        <div className="flex flex-col items-center gap-4 animate-fade-in-up z-20">
                             <div className="relative">
                                <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-violet-500 border-r-violet-500/50 border-b-violet-500 border-l-transparent shadow-[0_0_30px_rgba(139,92,246,0.6)]"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]"></div>
                                </div>
                             </div>
                             <div className="text-center bg-black/50 px-4 py-2 rounded-full border border-violet-500/30 backdrop-blur-md">
                                 <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-0.5 text-shadow">Nano Pro</p>
                                 <p className="text-[10px] text-violet-300 uppercase tracking-widest animate-pulse font-bold">Generating...</p>
                             </div>
                        </div>
                    )}
                    {status === 'queued' && (
                        <div className="flex flex-col items-center gap-2 animate-pulse z-20">
                            <div className="w-12 h-12 border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center bg-black/40">
                                <span className="text-sm font-bold text-gray-300">Q</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] bg-black/50 px-2 py-1 rounded">EN COLA</p>
                        </div>
                    )}
                    {status === 'idle' && !hasContent && (
                        <div className="flex flex-col items-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                             <button onClick={(e) => { e.stopPropagation(); onGenerateClick(); }} title="Generate Image" className="p-4 bg-zinc-800 border border-white/10 hover:bg-violet-600 hover:border-violet-500 rounded-full text-gray-400 hover:text-white transition-all transform hover:scale-110 shadow-lg group-btn ring-1 ring-black/50">
                                <MagicWandIcon className="w-6 h-6"/>
                            </button>
                            {subPanel.prompt ? (
                                <div className="bg-black/60 p-2 rounded border border-white/5 backdrop-blur-sm max-w-[180px]">
                                    <p className="text-[10px] text-gray-300 text-center line-clamp-3 italic leading-relaxed">"{subPanel.prompt}"</p>
                                </div>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); onEditClick(); }} className="text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-widest font-semibold border border-transparent hover:border-white/10 px-3 py-1 rounded-full transition-all">
                                    + Escribir Prompt
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Selection Indicator */}
            {isAgentMode && isSelected && status === 'idle' && (
                <div className="absolute top-2 right-2 z-20">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
                    </span>
                </div>
            )}
            
            {/* EXPLANATION POPUP OVERLAY */}
            {activeExplanation && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-fade-in text-center cursor-pointer" onClick={() => setActiveExplanation(null)}>
                    <div className="bg-zinc-800 border border-white/20 p-4 rounded-xl shadow-2xl max-w-[90%]">
                        <p className="text-sm font-bold text-white mb-2">💡 ¿Qué hace esto?</p>
                        <p className="text-xs text-gray-300 leading-relaxed">{activeExplanation}</p>
                        <p className="text-[10px] text-gray-500 mt-3 uppercase tracking-wider">Pulsa otra vez para usar</p>
                    </div>
                </div>
            )}

            {/* Professional Toolbar (Director Style) */}
            {hasContent && status !== 'generating' && !activeExplanation && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 shadow-2xl z-30 w-max">
                    
                    <button 
                        onClick={(e) => handleActionWithInfo(e, 'continue', "Crea la SIGUIENTE viñeta manteniendo la consistencia de personajes y estilo.", onContinuePanel)} 
                        className="p-2 rounded-xl bg-white/5 hover:bg-violet-600 text-white transition-all hover:scale-110 border border-transparent hover:border-violet-400"
                        title="Continuar Escena"
                    >
                        <ContinuePanelIcon className="w-4 h-4" />
                    </button>
                    
                    <div className="w-px h-5 bg-white/10"></div>
                    
                    <button 
                        onClick={(e) => handleActionWithInfo(e, 'magic', "Edita partes específicas de la imagen (ej: cambiar color de ojos) sin redibujar todo.", onMagicEditClick)} 
                        className="p-2 rounded-xl hover:bg-white/10 text-purple-300 hover:text-purple-100 transition-all"
                        title="Edición Mágica"
                    >
                        <MagicWandIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={(e) => handleActionWithInfo(e, 'analyze', "Nano Pro analizará la calidad visual y detectará errores anatómicos o de composición.", onAnalyze)} 
                        className="p-2 rounded-xl hover:bg-white/10 text-cyan-300 hover:text-cyan-100 transition-all"
                        title="Analizar Calidad"
                    >
                        <AnalyzeIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={(e) => handleActionWithInfo(e, 'regenerate', "Vuelve a generar la imagen con el mismo prompt. Útil si el resultado no te convence.", onRegenerate)} 
                        className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        title="Regenerar"
                    >
                        <RegenerateIcon className="w-4 h-4" />
                    </button>
                    
                    <button 
                        onClick={(e) => { stopPropagation(e); onEditClick(); }} 
                        className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        title="Editar Prompt"
                    >
                        <EditIcon className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 bg-white/10"></div>

                    <button 
                        onClick={(e) => handleActionWithInfo(e, 'extract', "Crea un nuevo Personaje guardado a partir de esta imagen para usarlo después.", onCreateCharacter)} 
                        className="p-2 rounded-xl hover:bg-white/10 text-green-400 hover:text-green-300 transition-all"
                        title="Extraer Personaje"
                    >
                        <CharacterFromPanelIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={(e) => { stopPropagation(e); onDeleteContent(); }}
                        className="p-2 rounded-xl hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-all"
                        title="Borrar Imagen"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {contextMenu && createPortal(
                <div
                    className="fixed z-[1000] min-w-[180px] rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-2xl py-1.5 text-sm"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {subPanel.imageUrl && (
                        <button
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-gray-200"
                            onClick={() => { setContextMenu(null); onDeleteContent(); }}
                        >
                            <TrashIcon className="w-4 h-4 text-gray-400" />
                            Borrar imagen
                        </button>
                    )}
                    {onDeletePanel && (
                        <button
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-900/30 text-red-400"
                            onClick={() => { setContextMenu(null); onDeletePanel(); }}
                        >
                            <TrashIcon className="w-4 h-4" />
                            Eliminar viñeta
                        </button>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};
