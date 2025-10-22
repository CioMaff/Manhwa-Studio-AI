
import React, { useState, useMemo, useRef } from 'react';
import type { Chapter, Panel, Project, SubPanel } from '../types';
import { generateManhwaPanel } from '../services/geminiService';
import { Modal } from './Modal';
import { PanelLayoutPickerModal } from './PanelLayoutPickerModal';
import { fileToBase64, compressImageBase64 } from '../utils/fileUtils';
import html2canvas from 'html2canvas';

// Icons
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { EditIcon } from './icons/EditIcon';
import { RegenerateIcon } from './icons/RegenerateIcon';
import { TextBubbleIcon } from './icons/TextBubbleIcon';
import { AgentGeneratingPanel } from './AgentGeneratingPanel';

interface CanvasProps {
    chapter: Chapter;
    setChapter: (chapter: Chapter) => void;
    project: Project;
    isAgentMode: boolean;
    selectedPanelIds: string[];
    setSelectedPanelIds: (ids: string[]) => void;
    agentGeneratingState: { active: boolean, prompt: string, insertAfterId: string | null };
}

const SubPanelComponent: React.FC<{
    subPanel: SubPanel;
    onEditClick: () => void;
    onUploadClick: () => void;
    onDeleteContent: () => void;
    onRegenerate: () => void;
    onAddBubble: () => void;
    isLoading: boolean;
}> = ({ subPanel, onEditClick, onUploadClick, onDeleteContent, onRegenerate, onAddBubble, isLoading }) => {
    return (
        <div className="relative w-full h-full bg-gray-700/50 rounded-md overflow-hidden border-2 border-transparent group">
             {isLoading && (
                <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center z-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-400"></div>
                    <p className="text-xs mt-2">Generating...</p>
                </div>
            )}
            {subPanel.imageUrl ? (
                <>
                    <img src={subPanel.imageUrl} alt={subPanel.prompt || 'manhwa panel'} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={onEditClick} title="Edit/Generate" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><EditIcon className="w-4 h-4" /></button>
                        <button onClick={onRegenerate} title="Regenerate" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><RegenerateIcon className="w-4 h-4" /></button>
                        <button onClick={onAddBubble} title="Add Dialogue" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><TextBubbleIcon className="w-4 h-4" /></button>
                        <button onClick={onDeleteContent} title="Delete Content" className="p-2 bg-red-600/80 rounded-full hover:bg-red-500"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 hover:text-white transition-all">
                    <div className="text-center">
                       <button onClick={onEditClick} className="p-3 rounded-full hover:bg-purple-500/20 mb-2">
                            <PlusIcon className="w-12 h-12" />
                       </button>
                       <button onClick={onUploadClick} className="p-3 rounded-full hover:bg-purple-500/20">
                            <UploadIcon className="w-8 h-8"/>
                       </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Canvas: React.FC<CanvasProps> = ({ chapter, setChapter, project, isAgentMode, selectedPanelIds, setSelectedPanelIds, agentGeneratingState }) => {
    const { panels, title } = chapter;
    const { settings } = project;

    const [isLayoutPickerOpen, setLayoutPickerOpen] = useState(false);
    const [isGenerateModalOpen, setGenerateModalOpen] = useState(false);
    const [currentTarget, setCurrentTarget] = useState<{ panelId: string, subPanelId: string } | null>(null);
    
    const [prompt, setPrompt] = useState('');
    const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [isExporting, setIsExporting] = useState(false);
    
    const hiddenUploadRef = useRef<HTMLInputElement>(null);
    const canvasExportRef = useRef<HTMLDivElement>(null);

    const updatePanels = (updater: (prev: Panel[]) => Panel[]) => {
        setChapter({ ...chapter, panels: updater(panels) });
    };

    const handleAddLayout = (layout: number[][]) => {
        const newPanel: Panel = {
            id: `panel-${Date.now()}`,
            layout,
            dialogueBubbles: [],
            subPanels: layout.flat().filter((v, i, a) => a.indexOf(v) === i).map(id => ({
                id: `subpanel-${id}-${Date.now()}`,
                prompt: '',
                characterIds: [],
                imageUrl: null
            })),
        };
        updatePanels(prev => [...prev, newPanel]);
        setLayoutPickerOpen(false);
    };

    const handleDeletePanel = (panelId: string) => {
        if(window.confirm('Delete this entire panel layout?')) {
            updatePanels(prev => prev.filter(p => p.id !== panelId));
        }
    };
    
    const openGenerateModal = (panelId: string, subPanelId: string) => {
        const panel = panels.find(p => p.id === panelId);
        const subPanel = panel?.subPanels.find(sp => sp.id === subPanelId);
        if (subPanel) {
            setPrompt(subPanel.prompt);
            setSelectedCharIds(subPanel.characterIds);
            setCurrentTarget({ panelId, subPanelId });
            setGenerateModalOpen(true);
        }
    };

    const handleGenerate = async (isRegeneration = false) => {
        if (!currentTarget || !prompt) return;
        
        const { panelId, subPanelId } = currentTarget;
        const targetId = `${panelId}-${subPanelId}`;

        setLoadingStates(prev => ({ ...prev, [targetId]: true }));
        if(!isRegeneration) setGenerateModalOpen(false);
        
        try {
            const selectedCharacters = project.characters.filter(c => selectedCharIds.includes(c.id));
            const imageUrl = await generateManhwaPanel(prompt, project.styleReferences, selectedCharacters, project.knowledgeBase);
            const compressedUrl = await compressImageBase64(imageUrl);
            
            updatePanels(prev => prev.map(p => {
                if (p.id === panelId) {
                    return { ...p, subPanels: p.subPanels.map(sp => sp.id === subPanelId ? { ...sp, imageUrl: compressedUrl, prompt, characterIds: selectedCharIds } : sp ) };
                }
                return p;
            }));
        } catch (error) {
            console.error("Failed to generate panel:", error);
            alert("Failed to generate panel. See console for details.");
        } finally {
            setLoadingStates(prev => ({ ...prev, [targetId]: false }));
            if(!isRegeneration) {
                setPrompt('');
                setSelectedCharIds([]);
            }
        }
    };
    
    const handleRegenerate = async (panelId: string, subPanelId: string) => {
         const panel = panels.find(p => p.id === panelId);
         const subPanel = panel?.subPanels.find(sp => sp.id === subPanelId);
         if (subPanel && subPanel.prompt) {
             setCurrentTarget({ panelId, subPanelId });
             setPrompt(subPanel.prompt);
             setSelectedCharIds(subPanel.characterIds);
             await handleGenerate(true);
         } else {
             alert("No prompt found to regenerate.");
         }
    };
    
    const handleDeleteContent = (panelId: string, subPanelId: string) => {
        updatePanels(prev => prev.map(p => {
            if (p.id === panelId) {
                return { ...p, subPanels: p.subPanels.map(sp => sp.id === subPanelId ? { ...sp, imageUrl: null, prompt: '', characterIds: [] } : sp ) };
            }
            return p;
        }));
    };

    const handleUploadClick = (panelId: string, subPanelId: string) => {
        setCurrentTarget({panelId, subPanelId});
        hiddenUploadRef.current?.click();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && currentTarget) {
            const { panelId, subPanelId } = currentTarget;
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            const compressedUrl = await compressImageBase64(base64);

            updatePanels(prev => prev.map(p => {
                if (p.id === panelId) {
                    return { ...p, subPanels: p.subPanels.map(sp => sp.id === subPanelId ? { ...sp, imageUrl: compressedUrl, prompt: `Uploaded: ${file.name}`, characterIds: [] } : sp ) };
                }
                return p;
            }));
            e.target.value = '';
            setCurrentTarget(null);
        }
    };
    
    const handleExport = () => {
        const element = canvasExportRef.current;
        if (!element) return;
        setIsExporting(true);
        html2canvas(element, {
            backgroundColor: '#111827', // bg-gray-900
            scale: 2,
        }).then((canvas) => {
            const link = document.createElement('a');
            link.download = `${project.title} - ${chapter.title}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).finally(() => setIsExporting(false));
    };

    const toggleCharacterSelection = (charId: string) => setSelectedCharIds(prev => prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]);
    const togglePanelSelectionForAgent = (panelId: string) => { if (isAgentMode) setSelectedPanelIds(selectedPanelIds.includes(panelId) ? selectedPanelIds.filter(id => id !== panelId) : [...selectedPanelIds, panelId]); };
    
    const gridTemplates = useMemo(() => {
        const templates: Record<string, React.CSSProperties> = {};
        panels.forEach(p => {
            templates[p.id] = { display: 'grid', gridTemplateRows: `repeat(${p.layout.length}, 1fr)`, gridTemplateColumns: `repeat(${p.layout[0].length}, 1fr)`, gap: '8px' };
        });
        return templates;
    }, [panels]);

    const getGridArea = (layout: number[][], subPanelIndex: number): React.CSSProperties => {
        const panelId = subPanelIndex + 1;
        let rS = -1, rE = -1, cS = -1, cE = -1;
        for (let r=0; r<layout.length; r++) for (let c=0; c<layout[0].length; c++) if (layout[r][c] === panelId) { if (rS===-1) rS=r+1; if (cS===-1||c<cS) cS=c+1; rE=r+2; if(c+2>cE) cE=c+2; }
        return { gridArea: `${rS} / ${cS} / ${rE} / ${cE}` };
    };

    return (
        <div className="bg-gray-800/50 rounded-lg h-full flex flex-col border border-gray-700">
            <input type="file" ref={hiddenUploadRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                <h2 className="text-xl font-bold truncate pr-4">{title}</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setLayoutPickerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 font-semibold text-sm"> <PlusIcon className="w-4 h-4" /> Add Layout </button>
                    <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-700 font-semibold text-sm disabled:bg-gray-500"> {isExporting ? 'Exporting...' : <><DownloadIcon className="w-4 h-4" /> Export</>} </button>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4">
                <div ref={canvasExportRef} className="mx-auto" style={{ width: `${settings.pageWidth}px`}}>
                    {panels.map((p) => {
                        const isSelected = isAgentMode && selectedPanelIds.includes(p.id);
                        const showAgentGenerator = agentGeneratingState.active && agentGeneratingState.insertAfterId === p.id;
                        return (
                        <React.Fragment key={p.id}>
                        <div className={`relative group mb-4 p-2 rounded-lg border-2 ${isAgentMode ? 'cursor-pointer' : ''} ${isSelected ? 'border-purple-500 bg-purple-900/20' : 'border-transparent'}`} style={{ marginBottom: `${settings.panelSpacing}px` }} onClick={() => togglePanelSelectionForAgent(p.id)}>
                            <div style={gridTemplates[p.id]} className="aspect-[3/4]">
                                {p.subPanels.map((sp, index) => (
                                    <div key={sp.id} style={getGridArea(p.layout, index)}>
                                        <SubPanelComponent 
                                           subPanel={sp} 
                                           onEditClick={() => openGenerateModal(p.id, sp.id)} 
                                           onUploadClick={() => handleUploadClick(p.id, sp.id)} 
                                           onDeleteContent={() => handleDeleteContent(p.id, sp.id)}
                                           onRegenerate={() => handleRegenerate(p.id, sp.id)}
                                           onAddBubble={() => alert('Dialogue bubbles coming soon!')}
                                           isLoading={loadingStates[`${p.id}-${sp.id}`] || false}/>
                                    </div>
                                ))}
                            </div>
                             <button onClick={(e) => { e.stopPropagation(); handleDeletePanel(p.id); }} className="absolute -top-3 -right-3 bg-red-600 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 z-10"> <TrashIcon className="w-5 h-5"/> </button>
                        </div>
                        {showAgentGenerator && <AgentGeneratingPanel prompt={agentGeneratingState.prompt} />}
                        </React.Fragment>
                    )})}
                    
                    {agentGeneratingState.active && agentGeneratingState.insertAfterId === null && <AgentGeneratingPanel prompt={agentGeneratingState.prompt} />}

                    {panels.length === 0 && !agentGeneratingState.active && <p className="text-center text-gray-500 py-20">Add a panel layout to get started!</p>}
                </div>
            </div>

            <PanelLayoutPickerModal isOpen={isLayoutPickerOpen} onClose={() => setLayoutPickerOpen(false)} onSelect={handleAddLayout} />
            <Modal isOpen={isGenerateModalOpen} onClose={() => setGenerateModalOpen(false)} title="Generate Panel">
                 <div className="space-y-4">
                    {project.characters.length > 0 && (<div className="flex flex-wrap gap-2 items-center"><p className="text-sm font-semibold mr-2">Characters:</p>{project.characters.map(char => (<button key={char.id} onClick={() => toggleCharacterSelection(char.id)} className={`px-3 py-1 text-sm rounded-full ${selectedCharIds.includes(char.id) ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{char.name}</button>))}</div>)}
                   <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={"Describe the panel..."} className="w-full p-3 bg-gray-700 rounded-md" rows={3}/>
                    <button onClick={() => handleGenerate(false)} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-2 rounded-md">Generate</button>
                 </div>
            </Modal>
        </div>
    );
};