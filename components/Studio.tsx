
import React, { useState, useEffect, useCallback } from 'react';
import type { Project, Chapter, Settings, AgentFunctionCall, Panel, ChatMessage } from '../types';
import { AssetManager } from './AssetManager';
import { AssistantPanel } from './AssistantPanel';
import { Canvas } from './Canvas';
import { ImageViewerModal } from './ImageViewerModal';
import { Modal } from './Modal';
import { SettingsModal } from './SettingsModal';
import { generateCoverArt, generateManhwaPanel } from '../services/geminiService';
import { saveProjectToStorage } from '../App';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { compressImageBase64 } from '../utils/fileUtils';

const layouts: Record<string, number[][]> = {
  '1': [[1]],
  '2v': [[1], [2]],
  '2h': [[1, 2]],
  '3v': [[1], [2], [3]],
  '3s': [[1], [2, 3]],
  '4g': [[1, 2], [3, 4]],
};

const getDefaultProject = (username: string): Project => ({
    id: `proj-${username}`,
    title: `${username}'s First Manhwa`,
    coverImage: `data:image/svg+xml;charset=UTF-8,%3csvg width='810' height='1440' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 810 1440'%3e%3crect width='810' height='1440' fill='%23282c34'/%3e%3c/svg%3e`,
    coverImagePreview: `data:image/svg+xml;charset=UTF-8,%3csvg width='450' height='600' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 450 600'%3e%3crect width='450' height='600' fill='%23282c34'/%3e%3cg%3e%3ctext x='100' y='318' fill='%23AAAAAA' font-weight='bold' font-family='Arial' font-size='38pt'%3eCover Art%3c/text%3e%3c/g%3e%3c/svg%3e`,
    chapters: [{ id: 'chap-1', title: 'Chapter 1', panels: [] }],
    characters: [],
    styleReferences: [],
    dialogueStyles: [],
    knowledgeBase: [],
    settings: {
        pageWidth: 800,
        panelSpacing: 100,
    },
    agentHistory: [],
    chatHistory: [],
});

// Fix: Define StudioProps interface
interface StudioProps {
    username: string;
    loadProject: () => Project | null;
    setProjectTitle: (title: string) => void;
}

export const Studio: React.FC<StudioProps> = ({ username, loadProject, setProjectTitle }) => {
    const [project, setProject] = useState<Project>(() => loadProject() || getDefaultProject(username));
    const [activeChapterId, setActiveChapterId] = useState(() => project.chapters[0]?.id || null);
    const [isCoverModalOpen, setCoverModalOpen] = useState(false);
    const [coverPrompt, setCoverPrompt] = useState('');
    const [selectedCoverCharIds, setSelectedCoverCharIds] = useState<string[]>([]);
    const [selectedCoverStyleIds, setSelectedCoverStyleIds] = useState<string[]>([]);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isCoverViewerOpen, setCoverViewerOpen] = useState(false);
    const [isCoverLoading, setIsCoverLoading] = useState(false);
    
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([]);
    const [agentGeneratingState, setAgentGeneratingState] = useState<{ active: boolean; prompt: string; insertAfterId: string | null }>({ active: false, prompt: '', insertAfterId: null });

    useEffect(() => {
        setProjectTitle(project.title);
        const timer = setTimeout(() => {
            setSaveStatus('saving');
            saveProjectToStorage(username, project);
            setTimeout(() => setSaveStatus('saved'), 500);
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 1000);
        return () => clearTimeout(timer);
    }, [project, username, setProjectTitle]);
    
    useEffect(() => {
        if (!activeChapterId && project.chapters.length > 0) setActiveChapterId(project.chapters[0].id);
    }, [activeChapterId, project.chapters]);

    const updateProject = useCallback((updater: (p: Project) => Project) => setProject(updater), []);
    
    const activeChapter = project.chapters.find(c => c.id === activeChapterId);
    
    const handleAddChapter = () => {
        const newChapter: Chapter = { id: `chap-${Date.now()}`, title: `Chapter ${project.chapters.length + 1}`, panels: [] };
        updateProject(p => ({ ...p, chapters: [...p.chapters, newChapter] }));
        setActiveChapterId(newChapter.id);
    };

    const handleDeleteChapter = (chapterId: string) => {
        if (project.chapters.length <= 1) return alert("You must have at least one chapter.");
        if (window.confirm("Delete this chapter? This cannot be undone.")) {
            updateProject(p => {
                const newChapters = p.chapters.filter(c => c.id !== chapterId);
                if (activeChapterId === chapterId) setActiveChapterId(newChapters[0]?.id || null);
                return { ...p, chapters: newChapters };
            });
        }
    };
    
    const handleRenameChapter = (chapterId: string) => {
        const newTitle = prompt("Enter new chapter title:", project.chapters.find(c=>c.id === chapterId)?.title);
        if (newTitle?.trim()) updateProject(p => ({ ...p, chapters: p.chapters.map(c => c.id === chapterId ? { ...c, title: newTitle.trim() } : c) }));
    };
    
    const handleGenerateCover = async () => {
        if (!coverPrompt) return alert("Please enter a prompt.");
        setIsCoverLoading(true);
        resetCoverModal();
        try {
            const selectedCharacters = project.characters.filter(c => selectedCoverCharIds.includes(c.id));
            const selectedStyles = project.styleReferences.filter(s => selectedCoverStyleIds.includes(s.id));
            const { full, preview } = await generateCoverArt(coverPrompt, selectedCharacters, selectedStyles);
            const [compressedFull, compressedPreview] = await Promise.all([compressImageBase64(full), compressImageBase64(preview)]);
            updateProject(p => ({ ...p, coverImage: compressedFull, coverImagePreview: compressedPreview }));
        } catch (error) {
            console.error("Failed to generate cover art:", error);
            alert("Could not generate cover art.");
        } finally {
            setIsCoverLoading(false);
        }
    };
    
    const handleExecuteAgentAction = async (action: AgentFunctionCall) => {
        if (action.name === 'create_manhwa_panel') {
            const { prompts = [], character_names = [], layout_type = '1' } = action.args;
            const insertAfterId = selectedPanelIds.length > 0 ? selectedPanelIds[selectedPanelIds.length - 1] : null;
            setAgentGeneratingState({ active: true, prompt: prompts.join('; '), insertAfterId });
            try {
                const characters = project.characters.filter(c => character_names.includes(c.name));
                const layoutGrid = layouts[layout_type] || [[1]];
                
                const subPanelPromises = prompts.map((p: string, i: number) => 
                    generateManhwaPanel(p, project.styleReferences, characters, project.knowledgeBase)
                        .then(compressImageBase64)
                );

                const imageUrls = await Promise.all(subPanelPromises);

                const newPanel: Panel = {
                    id: `panel-${Date.now()}`,
                    layout: layoutGrid,
                    dialogueBubbles: [],
                    subPanels: imageUrls.map((url, i) => ({
                        id: `subpanel-${i}-${Date.now()}`,
                        prompt: prompts[i],
                        characterIds: characters.map(c => c.id),
                        imageUrl: url,
                    })),
                };

                updateProject(p => {
                    const chapterToUpdate = p.chapters.find(c => c.id === activeChapterId);
                    if (!chapterToUpdate) return p;

                    const newPanels = [...chapterToUpdate.panels];
                    const insertIndex = insertAfterId ? newPanels.findIndex(pan => pan.id === insertAfterId) + 1 : newPanels.length;
                    newPanels.splice(insertIndex, 0, newPanel);
                    
                    const updatedChapter = { ...chapterToUpdate, panels: newPanels };
                    return { ...p, chapters: p.chapters.map(c => c.id === activeChapterId ? updatedChapter : c) };
                });

            } catch (error) {
                console.error("Agent action failed:", error);
                alert("The agent failed to create the panel.");
            } finally {
                setAgentGeneratingState({ active: false, prompt: '', insertAfterId: null });
            }
        }
    };

    const resetCoverModal = () => {
        setCoverModalOpen(false);
        setCoverPrompt('');
        setSelectedCoverCharIds([]);
        setSelectedCoverStyleIds([]);
    };
    const handleSettingsSave = (newSettings: Settings) => updateProject(p => ({...p, settings: newSettings}));
    const toggleCoverCharSelection = (charId: string) => setSelectedCoverCharIds(prev => prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]);
    const toggleCoverStyleSelection = (styleId: string) => setSelectedCoverStyleIds(prev => prev.includes(styleId) ? prev.filter(id => id !== styleId) : [...prev, styleId]);

    const updateHistory = (mode: 'agent' | 'chat', history: ChatMessage[]) => {
        updateProject(p => ({ ...p, [mode === 'agent' ? 'agentHistory' : 'chatHistory']: history }));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full p-2 sm:p-4 md:p-6">
            <div className="lg:col-span-3 h-full flex flex-col gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="relative mb-4 group cursor-pointer" >
                        {isCoverLoading && <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10 rounded-md"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-400"></div></div>}
                        <img src={project.coverImagePreview} alt="Manhwa Cover Preview" className="w-full aspect-[3/4] object-cover rounded-md" onClick={() => setCoverViewerOpen(true)} />
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setCoverModalOpen(true)}>
                            <p className="text-white font-bold">Generate New Cover</p>
                        </div>
                    </div>
                     <input type="text" value={project.title} onChange={(e) => updateProject(p => ({...p, title: e.target.value}))} className="text-xl font-bold w-full bg-transparent focus:outline-none focus:bg-gray-700/50 rounded-md p-1 -ml-1 mb-2"/>
                     <div className="flex justify-between items-center mb-2">
                         <h3 className="text-lg font-semibold text-gray-200">Chapters</h3>
                         <button onClick={handleAddChapter} className="p-1 rounded-full hover:bg-purple-500/20 text-purple-400"><PlusIcon className="w-5 h-5"/></button>
                    </div>
                    <ul className="max-h-32 overflow-y-auto space-y-1 pr-2">
                        {project.chapters.map(chap => (
                            <li key={chap.id} onClick={() => setActiveChapterId(chap.id)} className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${activeChapterId === chap.id ? 'bg-purple-600/30' : 'hover:bg-gray-700/50'}`}>
                                <span className="truncate">{chap.title}</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleRenameChapter(chap.id);}} className="text-gray-400 hover:text-white"><EditIcon className="w-4 h-4" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chap.id);}} className="text-red-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 h-full flex flex-col border border-gray-700 overflow-hidden">
                    <AssetManager project={project} updateProject={updateProject} />
                </div>
            </div>

            <div className="lg:col-span-6 h-full">
                {activeChapter ? (
                    <Canvas 
                        key={activeChapter.id} 
                        chapter={activeChapter} 
                        setChapter={(updatedChapter) => updateProject(p => ({ ...p, chapters: p.chapters.map(c => c.id === activeChapter.id ? updatedChapter : c)}))} 
                        project={project} 
                        isAgentMode={isAgentMode} 
                        selectedPanelIds={selectedPanelIds} 
                        setSelectedPanelIds={setSelectedPanelIds}
                        agentGeneratingState={agentGeneratingState}
                    />
                ) : (
                    <div className="bg-gray-800/50 rounded-lg h-full flex items-center justify-center border border-gray-700 text-gray-400"><p>No chapter selected.</p></div>
                )}
            </div>

            <div className="lg:col-span-3 h-full flex flex-col gap-4">
                <div className="bg-gray-800/50 rounded-lg border border-gray-700 h-full">
                     <AssistantPanel project={project} isAgentMode={isAgentMode} setIsAgentMode={setIsAgentMode} selectedPanelIds={selectedPanelIds} onExecuteAction={handleExecuteAgentAction} updateHistory={updateHistory} />
                </div>
                <div className="flex-shrink-0 flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                     <div className="flex items-center gap-2">
                        <button onClick={() => setSettingsModalOpen(true)} className="p-2 rounded-md hover:bg-gray-700 text-gray-400"><SettingsIcon /></button>
                        <span className={`text-xs text-gray-500 transition-opacity ${saveStatus !== 'idle' ? 'opacity-100' : 'opacity-0'}`}>{saveStatus === 'saving' ? 'Saving...' : 'Saved'}</span>
                    </div>
                </div>
            </div>

            <Modal isOpen={isCoverModalOpen} onClose={resetCoverModal} title="Generate Cover Art">
                <div className="space-y-4">
                    <textarea placeholder="Describe the cover art..." value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md" rows={4}></textarea>
                    {project.characters.length > 0 && (<div><p className="text-sm font-semibold mb-2">Include Characters:</p><div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">{project.characters.map(char => (<button key={char.id} onClick={() => toggleCoverCharSelection(char.id)} className={`flex items-center gap-2 px-3 py-1 text-sm rounded-full ${selectedCoverCharIds.includes(char.id) ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><img src={char.referenceImage} alt={char.name} className="w-5 h-5 rounded-full object-cover"/>{char.name}</button>))}</div></div>)}
                    {project.styleReferences.length > 0 && (<div><p className="text-sm font-semibold mb-2 mt-2">Reference Style:</p><div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">{project.styleReferences.map(style => (<button key={style.id} onClick={() => toggleCoverStyleSelection(style.id)} className={`px-3 py-1 text-sm rounded-full ${selectedCoverStyleIds.includes(style.id) ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{style.name}</button>))}</div></div>)}
                    <button onClick={handleGenerateCover} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-2 rounded-md">Generate</button>
                </div>
            </Modal>
            
            <ImageViewerModal isOpen={isCoverViewerOpen} onClose={() => setCoverViewerOpen(false)} imageUrl={project.coverImage} />
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} currentSettings={project.settings} onSave={handleSettingsSave} />
        </div>
    );
};
