
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Chapter, AgentFunctionCall, Panel, ChatMessage, SubPanel, Character, ScenePlanPage, StyleReference, ObjectAsset, SceneType, BackgroundAsset, CharacterInPanel } from '../types';
import { AssetManager, type AssetManagerProps } from './AssetManager';
import { AssistantPanel } from './AssistantPanel';
import { Canvas } from './Canvas';
import { ImageViewerModal } from './ImageViewerModal';
import { Modal } from './Modal';
import { SettingsModal } from './SettingsModal';
import { generateCoverArt, editPanelImage, analyzePanelForCharacters, extractAssetFromImage } from '../services/geminiService';
import { saveProjectToStorage } from '../utils/storage';
import { showToast, showConfirmation } from '../systems/uiSystem';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { compressImageBase64, downloadBase64Image } from '../utils/fileUtils';
import { useProject } from '../contexts/ProjectContext';
import { WhatsNewModal } from './WhatsNewModal';
import { CharacterEditorModal } from './CharacterEditorModal';
import { Loader } from './Loader';
import { layouts } from './layouts';
import { NanoReport } from './NanoReport';
import { ExtractAssetModal } from './ExtractAssetModal';
import { CharacterSelectionModal } from './CharacterSelectionModal';
import { ImageGeneratorModal } from './ImageGeneratorModal';
import { ImageAnalyzerModal } from './ImageAnalyzerModal';
import { LiveAssistant } from './LiveAssistant';
import { ImageIcon } from './icons/ImageIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { AssistantIcon } from './icons/AssistantIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { generateId } from '../utils/ids';
import { DebugConsole } from './DebugConsole'; // Import DebugConsole

const APP_VERSION = '2.2.9';

interface StudioProps {
    username: string;
    setProjectTitle: (title: string) => void;
    onExit: () => void; 
}

export const Studio: React.FC<StudioProps> = ({ username, setProjectTitle, onExit }) => {
    const { project, updateProject } = useProject();
    const [activeChapterId, setActiveChapterId] = useState(() => project.chapters?.[0]?.id || null);
    const [isCoverModalOpen, setCoverModalOpen] = useState(false);
    const [coverPrompt, setCoverPrompt] = useState('');
    const [selectedCoverCharIds, setSelectedCoverCharIds] = useState<string[]>([]);
    const [selectedCoverStyleIds, setSelectedCoverStyleIds] = useState<string[]>([]);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isCoverViewerOpen, setCoverViewerOpen] = useState(false);
    const [isCoverLoading, setIsCoverLoading] = useState(false);
    
    const [activeRightTab, setActiveRightTab] = useState<'assets' | 'assistant'>('assets');
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [selectedSubPanelIds, setSelectedSubPanelIds] = useState<string[]>([]);
    const [hasUnreadAgentMessages, setHasUnreadAgentMessages] = useState(false);
    
    const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
    const [editingCharacter, setEditingCharacter] = useState<Character | (Omit<Character, 'id' | 'name'> & { name?: string }) | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
    const [extractingAsset, setExtractingAsset] = useState<{ subPanel: SubPanel } | null>(null);
    const [characterSelection, setCharacterSelection] = useState<{ subPanel: SubPanel, characters: CharacterInPanel[] } | null>(null);

    const [isImageGeneratorOpen, setImageGeneratorOpen] = useState(false);
    const [isImageAnalyzerOpen, setImageAnalyzerOpen] = useState(false);
    const [showLiveAssistant, setShowLiveAssistant] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
    const coverArtRef = useRef<HTMLButtonElement>(null);
    const latestProjectRef = useRef(project);

    useEffect(() => {
        latestProjectRef.current = project;
    }, [project]);

    useEffect(() => {
        localStorage.setItem('gemini-manhwa-version', APP_VERSION);
    }, []);

    useEffect(() => {
        if (project) {
            setSaveStatus('saving');
            const saveDebounce = setTimeout(() => {
                saveProjectToStorage(username, project).then(() => {
                    setSaveStatus('saved');
                });
            }, 1500);
            return () => clearTimeout(saveDebounce);
        }
    }, [project, username]);

    // Flush on unmount — guarantees pending debounced edits are persisted when the
    // user navigates away via React state change (e.g. back to landing).
    useEffect(() => {
        return () => {
            const p = latestProjectRef.current;
            if (p) {
                saveProjectToStorage(username, p);
            }
        };
    }, [username]);

    // Flush on tab close / refresh.
    useEffect(() => {
        const flush = () => {
            const p = latestProjectRef.current;
            if (p) saveProjectToStorage(username, p);
        };
        window.addEventListener('beforeunload', flush);
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('beforeunload', flush);
            window.removeEventListener('pagehide', flush);
        };
    }, [username]);
    
    useEffect(() => {
        const handleAgentMessage = (e: Event) => {
             const detail = (e as CustomEvent).detail;
             const msgText = typeof detail === 'string' ? detail : detail.text;
             const msgImage = typeof detail === 'object' ? detail.image : undefined;

             if (activeRightTab !== 'assistant') {
                 setHasUnreadAgentMessages(true);
             }
             updateHistory('agent', [...project.agentHistory, {
                 id: `msg-${Date.now()}`,
                 role: 'model',
                 text: msgText,
                 images: msgImage ? [msgImage] : undefined
             }]);
        };
        window.addEventListener('agent-message', handleAgentMessage);
        return () => window.removeEventListener('agent-message', handleAgentMessage);
    }, [activeRightTab, project.agentHistory]);

    useEffect(() => {
        if (activeRightTab === 'assistant') setHasUnreadAgentMessages(false);
    }, [activeRightTab]);

    const handleExit = async () => {
        setSaveStatus('saving');
        await saveProjectToStorage(username, project);
        setSaveStatus('saved');
        onExit();
    };

    const activeChapter = project.chapters.find(c => c.id === activeChapterId);

    const setActiveChapter = useCallback((update: Chapter | ((prev: Chapter) => Chapter)) => {
        updateProject(p => {
            const currentChapter = p.chapters.find(c => c.id === activeChapterId);
            if (!currentChapter) return p;
            
            const newChapter = typeof update === 'function' ? update(currentChapter) : update;
            
            return { ...p, chapters: p.chapters.map(c => c.id === newChapter.id ? newChapter : c) };
        });
    }, [updateProject, activeChapterId]);

    const updateHistory = useCallback((mode: 'agent' | 'chat', history: ChatMessage[]) => {
        updateProject(p => {
            if (mode === 'agent') return { ...p, agentHistory: history };
            return { ...p, chatHistory: history };
        });
    }, [updateProject]);

    const handleGenerateCover = useCallback(async () => {
        if (!coverPrompt) return showToast("Por favor ingresa un prompt.", 'error');
        setIsCoverLoading(true);
        setCoverModalOpen(false);
        try {
            const characters = project.characters.filter(c => selectedCoverCharIds.includes(c.id));
            const styles = project.styleReferences.filter(s => selectedCoverStyleIds.includes(s.id));

            const fullImage = await generateCoverArt(coverPrompt, characters, styles);
            const previewImage = await compressImageBase64(fullImage, 600, 0.8);

            const updatedProject = { ...project, coverImage: fullImage, coverImagePreview: previewImage };
            updateProject(() => updatedProject);
            await saveProjectToStorage(username, updatedProject);
            
            showToast("¡Portada generada y guardada!", 'success');
        } catch (e) {
            console.error(e);
            showToast("Error generando portada.", 'error');
        } finally {
            setIsCoverLoading(false);
        }
    }, [coverPrompt, project, selectedCoverCharIds, selectedCoverStyleIds, updateProject, username]);

    const handleAddChapter = useCallback(() => {
        const newChapterId = generateId('chap');
        updateProject(p => ({ ...p, chapters: [...p.chapters, { id: newChapterId, title: `Capítulo ${p.chapters.length + 1}`, panels: [] }] }));
        setActiveChapterId(newChapterId);
    }, [updateProject]);

    const handleDeleteChapter = useCallback(async (chapterId: string) => {
        if (project.chapters.length <= 1) return showToast("No puedes borrar el último capítulo.", 'error');
        if (await showConfirmation({ title: "Borrar Capítulo", message: "¿Estás seguro?" })) {
            updateProject(p => {
                const newChapters = p.chapters.filter(c => c.id !== chapterId);
                if (activeChapterId === chapterId) setActiveChapterId(newChapters[0]?.id);
                return { ...p, chapters: newChapters };
            });
        }
    }, [project.chapters.length, updateProject, activeChapterId]);
    
    const handleSaveChapterTitle = useCallback((chapterId: string, newTitle: string) => {
        if(newTitle.trim()) {
            updateProject(p => ({ ...p, chapters: p.chapters.map(c => c.id === chapterId ? {...c, title: newTitle.trim()} : c)}));
        }
        setEditingChapterId(null);
    }, [updateProject]);
    
    const handleSaveCharacter = useCallback((charData: Character | Omit<Character, 'id'>) => {
        if ('id' in charData) {
            updateProject(p => ({ ...p, characters: p.characters.map(c => c.id === charData.id ? charData : c) }));
            showToast("Personaje actualizado!", "success");
        } else {
            const newChar: Character = { ...charData, id: generateId('char') };
            updateProject(p => ({ ...p, characters: [...p.characters, newChar] }));
            showToast("Personaje creado!", "success");
        }
        setEditingCharacter(null);
    }, [updateProject]);

    const handleDeleteCharacter = useCallback((id: string) => {
        updateProject(p => ({ ...p, characters: p.characters.filter(c => c.id !== id) }));
        showToast("Personaje borrado.", "info");
        setEditingCharacter(null);
    }, [updateProject]);

    const handleExecutePlan = useCallback(async (
        plan: ScenePlanPage[], characters: Character[], styles: StyleReference[], objects: ObjectAsset[], backgrounds: BackgroundAsset[], sceneType: SceneType
    ) => {
        if (!activeChapter) return;
        const totalPanels = plan.reduce((acc, p) => acc + p.sub_panels.length, 0);
        showToast(`Planificando ${totalPanels} viñetas...`, 'info');

        let newPanels: Panel[] = [];
        for (const page of plan) {
            // FALLBACK LOGIC FOR UNKNOWN LAYOUTS TO PREVENT SQUARES
            let layoutKey = page.layout;
            if (!layouts[layoutKey]) {
                console.warn(`Layout '${layoutKey}' not found, falling back to '1'.`);
                layoutKey = '1'; // Safe default (Vertical Standard)
            }

            const panel: Panel = {
                id: generateId('panel'),
                layout: layouts[layoutKey] || [[1]],
                dialogueBubbles: [],
                subPanels: page.sub_panels.map((sp, spIdx) => ({
                    id: generateId('subpanel'),
                    prompt: sp.action_description,
                    imageUrl: null, 
                    characterIds: characters.map(c => c.id),
                    styleReferenceIds: styles.map(s => s.id),
                    backgroundIds: backgrounds.map(b => b.id),
                    shotType: sp.shot_type,
                    cameraAngle: sp.camera_angle,
                })),
            };
            newPanels.push(panel);
        }
        setActiveChapter((prev: Chapter) => ({ ...prev, panels: [...prev.panels, ...newPanels] }));
    }, [activeChapter, setActiveChapter]);

    const handleManualExtractAsset = async (baseImage: string, prompt: string) => {
        setIsLoading(true); setExtractingAsset(null);
        try {
            const assetType = prompt.toLowerCase().includes('character') ? 'character' : 'object';
            const assetImage = await extractAssetFromImage(baseImage, prompt, assetType, project.styleReferences);
            const compressed = await compressImageBase64(assetImage);

            if (assetType === 'character') {
                 handleOpenCharacterModal({ name: prompt, description: `Extracted: ${prompt}`, referenceImage: compressed });
            } else {
                updateProject(p => ({...p, objects: [...p.objects, { id: generateId('obj'), name: prompt, image: compressed, ownerInfo: { type: 'various', name: 'Various' } }]}));
                showToast(`Objeto extraído: '${prompt}'!`, 'success');
            }
        } catch (e) { console.error(e); showToast(`Error al extraer '${prompt}'.`, 'error'); } finally { setIsLoading(false); }
    };

    const handleCreateCharacterFromPanel = useCallback(async (subPanel: SubPanel) => {
        if (!subPanel.imageUrl) return;
        setIsLoading(true);
        try {
            const analysis = await analyzePanelForCharacters(subPanel.imageUrl, project.characters);
            if (analysis.new_characters.length === 0) showToast("No se detectaron personajes nuevos.", 'info');
            else if (analysis.new_characters.length === 1) {
                const newCharInfo = analysis.new_characters[0];
                const charImage = await extractAssetFromImage(subPanel.imageUrl, newCharInfo.description, 'character', project.styleReferences);
                handleOpenCharacterModal({ name: newCharInfo.name_suggestion, description: newCharInfo.description, referenceImage: await compressImageBase64(charImage) });
            } else setCharacterSelection({ subPanel, characters: analysis.new_characters });
        } catch(e) { console.error(e); showToast("Error creando personaje.", 'error'); } finally { setIsLoading(false); }
    }, [project.characters, project.styleReferences]);

     const handleCharacterSelection = async (character: CharacterInPanel) => {
        if (!characterSelection) return;
        const { subPanel } = characterSelection;
        setCharacterSelection(null); setIsLoading(true);
        try {
            const charImage = await extractAssetFromImage(subPanel.imageUrl!, character.description, 'character', project.styleReferences);
            handleOpenCharacterModal({ name: character.name_suggestion, description: character.description, referenceImage: await compressImageBase64(charImage) });
        } catch(e) { console.error(e); showToast("Error al extraer personaje.", 'error'); } finally { setIsLoading(false); }
    };
    
    const handleContinuePanel = useCallback((subPanel: SubPanel) => {
        // This prop logic inside Studio.tsx is not needed because Canvas.tsx handles state.
        // But we keep it for prop consistency. Canvas actually invokes `setContinuingSubPanel` locally.
        // However, if triggered from elsewhere, this ensures compatibility.
    }, []);

    const handleOpenCharacterModal: AssetManagerProps['onOpenCharacterModal'] = useCallback((character) => {
        setEditingCharacter(character ? (character as Character | Omit<Character, 'id' | 'name'>) : { name: 'Nuevo Personaje', description: '', referenceImage: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgNDAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTgxODFiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM1MjUyNWIiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2cHQiPlVwbG9hZDwvdGV4dD48L3N2Zz4=' });
    }, []);

    const executeAgentAction = useCallback(async (action: AgentFunctionCall) => {
        if (!activeChapter) return;
        showToast(`Ejecutando: ${action.name}`, 'info');
    }, [activeChapter]);

    if (!project || !activeChapter) return <div>Cargando...</div>;

    return (
        <div className="flex h-full bg-[#09090b] text-gray-200 font-sans">
            {isLoading && <Loader message="Procesando..." />}
            
            {/* LEFT SIDEBAR */}
            <aside className="w-[280px] flex-shrink-0 bg-[#09090b]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col z-20 relative">
                 <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                     <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2">
                            <button onClick={handleExit} className="text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all group">
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:-translate-x-0.5 transition-transform"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                            </button>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400/80">Modo Estudio</span>
                         </div>
                         <div className="flex items-center gap-1">
                             <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                             <span className="text-[9px] text-gray-500 font-mono uppercase">{saveStatus === 'saved' ? 'GUARDADO' : 'GUARDANDO...'}</span>
                         </div>
                     </div>
                     <input type="text" onBlur={(e) => updateProject(p => ({...p, title: e.target.value || 'Sin Título'}))} defaultValue={project.title} className="bg-transparent text-xl font-bold w-full focus:outline-none focus:ring-2 focus:ring-violet-500/50 rounded-lg px-2 py-1 -ml-2 text-white placeholder-gray-600 transition-all" />
                 </div>

                 {/* Cover Art Preview */}
                 <div className="p-5">
                     <div className="relative group w-full aspect-[9/16] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/50">
                        <button ref={coverArtRef} onClick={() => setCoverViewerOpen(true)} className="w-full h-full transition-transform duration-700 group-hover:scale-105">
                            {isCoverLoading ? <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div></div> : <img src={project.coverImagePreview || project.coverImage} alt={project.title} className="w-full h-full object-cover" />}
                        </button>
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 gap-3 backdrop-blur-sm">
                            <button onClick={() => setCoverModalOpen(true)} className="px-4 py-2 text-xs font-bold text-white bg-violet-600 rounded-full hover:bg-violet-500 shadow-lg flex items-center gap-2 transform transition hover:scale-105"><EditIcon className="w-3 h-3" /> Editar Portada</button>
                            <button onClick={() => downloadBase64Image(project.coverImage, `${project.title}-cover.jpg`)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors backdrop-blur-md"><DownloadIcon className="w-4 h-4" /></button>
                        </div>
                     </div>
                 </div>

                <div className="flex-grow overflow-y-auto px-3 space-y-1 py-2">
                    <div className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center"><span>Capítulos</span><button onClick={() => setSettingsModalOpen(true)} className="hover:text-white transition-colors opacity-50 hover:opacity-100"><SettingsIcon className="w-3.5 h-3.5"/></button></div>
                    {project.chapters.map(chap => (
                        <div key={chap.id} className={`flex items-center p-2.5 rounded-xl cursor-pointer transition-all duration-200 group relative overflow-hidden ${chap.id === activeChapterId ? 'bg-gradient-to-r from-violet-500/20 to-indigo-500/10 text-white border border-violet-500/20' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'}`}>
                            {chap.id === activeChapterId && <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-full my-2 ml-0.5"></div>}
                            
                            {editingChapterId === chap.id ? (
                                <input 
                                    autoFocus
                                    defaultValue={chap.title}
                                    onBlur={(e) => handleSaveChapterTitle(chap.id, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveChapterTitle(chap.id, e.currentTarget.value)}
                                    className="flex-grow bg-black/50 text-sm rounded px-2 py-1 border border-violet-500 focus:outline-none"
                                />
                            ) : (
                                <span onClick={() => setActiveChapterId(chap.id)} className="flex-grow text-sm truncate font-medium pl-2">{chap.title}</span>
                            )}

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingChapterId(chap.id)} className="p-1.5 hover:bg-white/10 rounded-md"><EditIcon className="w-3 h-3"/></button>
                                <button onClick={() => handleDeleteChapter(chap.id)} className="p-1.5 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 rounded-md"><TrashIcon className="w-3 h-3"/></button>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="p-4 border-t border-white/5">
                    <button onClick={handleAddChapter} className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-zinc-800 to-zinc-700 border border-white/5 rounded-xl hover:from-zinc-700 hover:to-zinc-600 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"><PlusIcon className="w-4 h-4"/> Nuevo Capítulo</button>
                </div>
            </aside>

            {/* CENTER CANVAS */}
            <main className="flex-1 relative bg-zinc-950 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] pointer-events-none mix-blend-overlay"></div>
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-violet-900/10 to-transparent pointer-events-none"></div>
                <Canvas 
                    chapter={activeChapter} setChapter={setActiveChapter} isAgentMode={isAgentMode}
                    selectedSubPanelIds={selectedSubPanelIds} setSelectedSubPanelIds={setSelectedSubPanelIds}
                    onExecutePlan={handleExecutePlan} onCreateCharacterFromPanel={handleCreateCharacterFromPanel}
                    onExtractAsset={(subPanel) => setExtractingAsset({ subPanel })} onContinuePanel={handleContinuePanel}
                />
                <DebugConsole /> 
            </main>

            {/* RIGHT SIDEBAR */}
            <aside className="w-[400px] flex-shrink-0 bg-[#09090b]/80 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20 relative shadow-2xl">
                <div className="flex items-center border-b border-white/5 bg-black/20 flex-shrink-0">
                    <button onClick={() => setActiveRightTab('assets')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all relative ${activeRightTab === 'assets' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Assets{activeRightTab === 'assets' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>}</button>
                    <button onClick={() => setActiveRightTab('assistant')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all relative ${activeRightTab === 'assistant' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                        Asistente IA 
                        {hasUnreadAgentMessages && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse"></span>}
                        {activeRightTab === 'assistant' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>}
                    </button>
                </div>
                <div className="flex-1 relative overflow-hidden">
                    <div className={`absolute inset-0 flex flex-col transition-all duration-300 ${activeRightTab === 'assets' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-10 z-0 pointer-events-none'}`}>
                        <AssetManager onOpenCharacterModal={handleOpenCharacterModal}/>
                    </div>
                    <div className={`absolute inset-0 flex flex-col transition-all duration-300 ${activeRightTab === 'assistant' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-10 z-0 pointer-events-none'}`}>
                         <AssistantPanel isAgentMode={isAgentMode} setIsAgentMode={setIsAgentMode} selectedSubPanelIds={selectedSubPanelIds} setSelectedSubPanelIds={setSelectedSubPanelIds} onExecuteAction={executeAgentAction} updateHistory={updateHistory} />
                    </div>
                </div>
            </aside>
            
             <div className="fixed bottom-8 right-[420px] flex flex-col gap-4 z-40">
                <button onClick={() => setShowLiveAssistant(true)} className="w-12 h-12 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xl rounded-full shadow-lg border border-white/10 text-gray-400 hover:text-white hover:bg-violet-600 transition-all hover:scale-110"><AssistantIcon className="w-6 h-6"/></button>
                <button onClick={() => setImageAnalyzerOpen(true)} className="w-12 h-12 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xl rounded-full shadow-lg border border-white/10 text-gray-400 hover:text-white hover:bg-pink-600 transition-all hover:scale-110"><PhotoIcon className="w-5 h-5"/></button>
                <button onClick={() => setImageGeneratorOpen(true)} className="w-12 h-12 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xl rounded-full shadow-lg border border-white/10 text-gray-400 hover:text-white hover:bg-cyan-600 transition-all hover:scale-110"><ImageIcon className="w-5 h-5"/></button>
            </div>

            <Modal isOpen={isCoverModalOpen} onClose={() => setCoverModalOpen(false)} title="Generar Arte de Portada">
                 <div className="space-y-4">
                    <textarea placeholder="Describe la escena de portada y el Título..." value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} className="w-full p-3 bg-zinc-950 border border-white/10 rounded-xl focus:border-violet-500/50 outline-none text-sm" rows={3}/>
                    <div><p className="text-xs font-bold text-gray-500 uppercase mb-2">Personajes</p><div className="flex flex-wrap gap-2">{project.characters.map(char => (<button key={char.id} onClick={() => setSelectedCoverCharIds(p => p.includes(char.id) ? p.filter(i => i !== char.id) : [...p, char.id])} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${selectedCoverCharIds.includes(char.id) ? 'bg-violet-500/20 border-violet-500 text-violet-200' : 'bg-zinc-800 border-white/5 text-gray-400'}`}>{char.name}</button>))}</div></div>
                    <div><p className="text-xs font-bold text-gray-500 uppercase mb-2">Estilo</p><div className="flex flex-wrap gap-2">{project.styleReferences.map(style => (<button key={style.id} onClick={() => setSelectedCoverStyleIds(p => p.includes(style.id) ? p.filter(i => i !== style.id) : [...p, style.id])} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${selectedCoverStyleIds.includes(style.id) ? 'bg-violet-500/20 border-violet-500 text-violet-200' : 'bg-zinc-800 border-white/5 text-gray-400'}`}>{style.name}</button>))}</div></div>
                    <button onClick={handleGenerateCover} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-all mt-4">Generar Portada con Título</button>
                 </div>
            </Modal>
            <ImageViewerModal isOpen={isCoverViewerOpen} onClose={() => setCoverViewerOpen(false)} imageUrl={project.coverImage} />
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} currentSettings={project.settings} onSave={(s) => updateProject(p => ({ ...p, settings: s }))} />
            <WhatsNewModal isOpen={isWhatsNewOpen} onClose={() => setIsWhatsNewOpen(false)} />
             {editingCharacter && <CharacterEditorModal isOpen={!!editingCharacter} onClose={() => setEditingCharacter(null)} character={editingCharacter} onSave={handleSaveCharacter} onDelete={handleDeleteCharacter} />}
             {extractingAsset && <ExtractAssetModal isOpen={!!extractingAsset} onClose={() => setExtractingAsset(null)} subPanelImage={extractingAsset.subPanel.imageUrl!} onExtract={handleManualExtractAsset} />}
            {characterSelection && <CharacterSelectionModal isOpen={!!characterSelection} onClose={() => setCharacterSelection(null)} sourceImage={characterSelection.subPanel.imageUrl!} characters={characterSelection.characters} onSelect={handleCharacterSelection} />}
            <ImageGeneratorModal isOpen={isImageGeneratorOpen} onClose={() => setImageGeneratorOpen(false)} />
            <ImageAnalyzerModal isOpen={isImageAnalyzerOpen} onClose={() => setImageAnalyzerOpen(false)} />
            {showLiveAssistant && <LiveAssistant isOpen={showLiveAssistant} onClose={() => setShowLiveAssistant(false)} />}
        </div>
    );
};
