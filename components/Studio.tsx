import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Chapter, AgentFunctionCall, Panel, ChatMessage, SubPanel, Character, ScenePlanPage, StyleReference, ObjectAsset, SceneType, BackgroundAsset } from '../types';
import { AssetManager, type AssetManagerProps } from './AssetManager';
import { AssistantPanel } from './AssistantPanel';
import { Canvas } from './Canvas';
import { ImageViewerModal } from './ImageViewerModal';
import { Modal } from './Modal';
import { SettingsModal } from './SettingsModal';
import { generateCoverArt, editPanelImage } from '../services/geminiService';
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
import { analyzePanelForCharacters, extractAssetFromImage } from '../services/geminiService';
import type { CharacterInPanel } from '../types';
import { ImageGeneratorModal } from './ImageGeneratorModal';
import { ImageAnalyzerModal } from './ImageAnalyzerModal';
import { LiveAssistant } from './LiveAssistant';
import { ImageIcon } from './icons/ImageIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { AssistantIcon } from './icons/AssistantIcon';
import { DownloadIcon } from './icons/DownloadIcon';

const APP_VERSION = '2.0.0'; 

interface StudioProps {
    username: string;
    setProjectTitle: (title: string) => void;
    onExit: () => void; 
}

export const Studio: React.FC<StudioProps> = ({ username, setProjectTitle, onExit }) => {
    const { project, updateProject } = useProject();
    const [activeChapterId, setActiveChapterId] = useState(() => project.chapters[0]?.id || null);
    const [isCoverModalOpen, setCoverModalOpen] = useState(false);
    const [coverPrompt, setCoverPrompt] = useState('');
    const [selectedCoverCharIds, setSelectedCoverCharIds] = useState<string[]>([]);
    const [selectedCoverStyleIds, setSelectedCoverStyleIds] = useState<string[]>([]);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isCoverViewerOpen, setCoverViewerOpen] = useState(false);
    const [isCoverLoading, setIsCoverLoading] = useState(false);
    
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [selectedSubPanelIds, setSelectedSubPanelIds] = useState<string[]>([]);
    
    const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
    const [editingCharacter, setEditingCharacter] = useState<Character | (Omit<Character, 'id' | 'name'> & { name?: string }) | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
    const [extractingAsset, setExtractingAsset] = useState<{ subPanel: SubPanel } | null>(null);
    const [characterSelection, setCharacterSelection] = useState<{ subPanel: SubPanel, characters: CharacterInPanel[] } | null>(null);

    const [isImageGeneratorOpen, setImageGeneratorOpen] = useState(false);
    const [isImageAnalyzerOpen, setImageAnalyzerOpen] = useState(false);
    const [showLiveAssistant, setShowLiveAssistant] = useState(false);
    const coverArtRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        localStorage.setItem('gemini-manhwa-version', APP_VERSION);
    }, []);

    useEffect(() => {
        if (project) {
            setProjectTitle(project.title);
            const saveDebounce = setTimeout(() => {
                saveProjectToStorage(username, project);
            }, 1500);
            return () => clearTimeout(saveDebounce);
        }
    }, [project, username, setProjectTitle]);

    const activeChapter = project.chapters.find(c => c.id === activeChapterId);

    const setActiveChapter = useCallback((chapter: Chapter) => {
        updateProject(p => ({
            ...p,
            chapters: p.chapters.map(c => c.id === chapter.id ? chapter : c),
        }));
    }, [updateProject]);

    const updateHistory = useCallback((mode: 'agent' | 'chat', history: ChatMessage[]) => {
        updateProject(p => {
            if (mode === 'agent') return { ...p, agentHistory: history };
            return { ...p, chatHistory: history };
        });
    }, [updateProject]);

    const handleGenerateCover = useCallback(async () => {
        if (!coverPrompt) return showToast("Please enter a prompt.", 'error');
        
        setIsCoverLoading(true);
        setCoverModalOpen(false);
        try {
            const characters = project.characters.filter(c => selectedCoverCharIds.includes(c.id));
            const styles = project.styleReferences.filter(s => selectedCoverStyleIds.includes(s.id));

            const fullImage = await generateCoverArt(coverPrompt, characters, styles);
            
            const previewImage = await compressImageBase64(fullImage, 600, 0.8);

            updateProject(p => ({ ...p, coverImage: fullImage, coverImagePreview: previewImage }));
            showToast("Cover art generated successfully!", 'success');
        } catch (e) {
            console.error(e);
            showToast("Failed to generate cover art.", 'error');
        } finally {
            setIsCoverLoading(false);
        }
    }, [coverPrompt, project.characters, project.styleReferences, selectedCoverCharIds, selectedCoverStyleIds, updateProject]);

    const handleAddChapter = useCallback(() => {
        const newChapterId = `chap-${Date.now()}`;
        updateProject(p => {
            const newChapter: Chapter = {
                id: newChapterId,
                title: `Chapter ${p.chapters.length + 1}`,
                panels: [],
            };
            return { ...p, chapters: [...p.chapters, newChapter] };
        });
        setActiveChapterId(newChapterId);
    }, [updateProject]);

    const handleDeleteChapter = useCallback(async (chapterId: string) => {
        if (project.chapters.length <= 1) return showToast("Cannot delete the last chapter.", 'error');
        const confirmed = await showConfirmation({ title: "Delete Chapter", message: "Are you sure?" });
        if (confirmed) {
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
            showToast("Character updated!", "success");
        } else {
            const newChar: Character = { ...charData, id: `char-${Date.now()}` };
            updateProject(p => ({ ...p, characters: [...p.characters, newChar] }));
            showToast("Character created!", "success");
        }
        setEditingCharacter(null);
    }, [updateProject]);

    const handleDeleteCharacter = useCallback((id: string) => {
        updateProject(p => ({ ...p, characters: p.characters.filter(c => c.id !== id) }));
        showToast("Character deleted.", "info");
        setEditingCharacter(null);
    }, [updateProject]);

    const handleExecutePlan = useCallback(async (
        plan: ScenePlanPage[], 
        characters: Character[],
        styles: StyleReference[],
        objects: ObjectAsset[],
        backgrounds: BackgroundAsset[],
        sceneType: SceneType
    ) => {
        if (!activeChapter) return;
        
        const totalPanels = plan.reduce((acc, p) => acc + p.sub_panels.length, 0);
        showToast(`Adding ${totalPanels} panels to the chapter. Generation will begin shortly.`, 'info');

        let newPanels: Panel[] = [];
        for (const page of plan) {
            const layoutKey = page.layout in layouts ? page.layout : '1';
            const panel: Panel = {
                id: `panel-${Date.now()}-${page.page_number}`,
                layout: layouts[layoutKey],
                dialogueBubbles: [],
                subPanels: page.sub_panels.map((sp, spIdx) => ({
                    id: `subpanel-${Date.now()}-${page.page_number}-${spIdx}`,
                    prompt: sp.action_description,
                    imageUrl: null, 
                    characterIds: characters.map(c => c.id),
                    styleReferenceIds: styles.map(s => s.id),
                    backgroundIds: backgrounds.map(b => b.id),
                    dialogueStyleIds: [],
                    shotType: sp.shot_type,
                    cameraAngle: sp.camera_angle,
                })),
            };
            newPanels.push(panel);
        }
        
        const chapterWithNewPanels = { ...activeChapter, panels: [...activeChapter.panels, ...newPanels] };
        setActiveChapter(chapterWithNewPanels);
    }, [activeChapter, setActiveChapter]);

    const handleManualExtractAsset = async (baseImage: string, prompt: string) => {
        setIsLoading(true);
        setExtractingAsset(null);
        try {
            const isCharacter = prompt.toLowerCase().includes('character') || project.characters.some(c => prompt.toLowerCase().includes(c.name.toLowerCase()));
            const assetType = isCharacter ? 'character' : 'object';

            showToast(`Extracting '${prompt}'...`, 'info');
            const assetImage = await extractAssetFromImage(baseImage, prompt, assetType, project.styleReferences);
            const compressedAssetImage = await compressImageBase64(assetImage);

            if (assetType === 'character') {
                 handleOpenCharacterModal({
                    name: prompt,
                    description: `A new character extracted from a panel, described as: ${prompt}`,
                    referenceImage: compressedAssetImage,
                });
                showToast(`New Character '${prompt}' ready for review!`, 'success');
            } else {
                const newObject: ObjectAsset = {
                    id: `obj-${Date.now()}`,
                    name: prompt,
                    image: compressedAssetImage,
                    ownerInfo: { type: 'various', name: 'Various' },
                };
                updateProject(p => ({...p, objects: [...p.objects, newObject]}));
                showToast(`New Object '${prompt}' created!`, 'success');
            }
        } catch (e) {
            console.error("Manual asset extraction failed:", e);
            showToast(`Failed to extract '${prompt}'.`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCharacterFromPanel = useCallback(async (subPanel: SubPanel) => {
        if (!subPanel.imageUrl) return;
        setIsLoading(true);
        try {
            const analysis = await analyzePanelForCharacters(subPanel.imageUrl, project.characters);
            if (analysis.new_characters.length === 0) {
                showToast("No new characters detected.", 'info');
            } else if (analysis.new_characters.length === 1) {
                const newCharInfo = analysis.new_characters[0];
                const charImage = await extractAssetFromImage(subPanel.imageUrl, newCharInfo.description, 'character', project.styleReferences);
                const compressedCharImage = await compressImageBase64(charImage);
                handleOpenCharacterModal({
                    name: newCharInfo.name_suggestion,
                    description: newCharInfo.description,
                    referenceImage: compressedCharImage
                });
            } else {
                setCharacterSelection({ subPanel, characters: analysis.new_characters });
            }
        } catch(e) {
            console.error("Failed to create character from panel:", e);
            showToast("Error creating character.", 'error');
        } finally {
            setIsLoading(false);
        }
    }, [project.characters, project.styleReferences]);

     const handleCharacterSelection = async (character: CharacterInPanel) => {
        if (!characterSelection) return;
        const { subPanel } = characterSelection;
        setCharacterSelection(null);
        setIsLoading(true);
        try {
            const charImage = await extractAssetFromImage(subPanel.imageUrl!, character.description, 'character', project.styleReferences);
            const compressedCharImage = await compressImageBase64(charImage);
            handleOpenCharacterModal({
                name: character.name_suggestion,
                description: character.description,
                referenceImage: compressedCharImage,
            });
        } catch(e) {
             console.error("Failed to extract selected character:", e);
             showToast("Could not extract the selected character.", 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleContinuePanel = useCallback((subPanel: SubPanel) => {
        window.dispatchEvent(new CustomEvent('prepopulate-agent', { detail: subPanel }));
    }, []);

    const handleOpenCharacterModal: AssetManagerProps['onOpenCharacterModal'] = useCallback((character) => {
        if (character) {
            setEditingCharacter(character as Character | Omit<Character, 'id'>);
        } else {
            setEditingCharacter({
                name: 'New Character',
                description: '',
                referenceImage: 'data:image/svg+xml;charset=UTF-8,%3csvg width="300" height="400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"%3e%3crect width="300" height="400" fill="%2318181b"/%3e%3ctext x="50%25" y="50%25" fill="%2352525b" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16pt"%3eUpload or Generate%3c/text%3e%3c/svg%3e',
            });
        }
    }, []);

    const executeAgentAction = useCallback(async (action: AgentFunctionCall) => {
        if (!activeChapter) return;
        showToast(`Executing: ${action.name}`, 'info');

        switch (action.name) {
            case 'create_manhwa_panel': {
                const { layout_type, prompts, character_names } = action.args;
                const panel: Panel = {
                    id: `panel-agent-${Date.now()}`,
                    layout: layouts[layout_type || '1'],
                    dialogueBubbles: [],
                    subPanels: (prompts as string[]).map((prompt, index) => ({
                        id: `subpanel-agent-${Date.now()}-${index + 1}`,
                        prompt,
                        imageUrl: null,
                        characterIds: project.characters.filter(c => character_names?.includes(c.name)).map(c => c.id),
                        styleReferenceIds: [],
                    })),
                };
                const chapterWithPanel = { ...activeChapter, panels: [...activeChapter.panels, panel] };
                setActiveChapter(chapterWithPanel);
                break;
            }
             case 'fill_manhwa_panels': {
                const { targets, character_names } = action.args;
                let chapterToUpdate = { ...activeChapter };
                const characterIds = project.characters.filter(c => character_names?.includes(c.name)).map(c => c.id);

                (targets as any[]).forEach(target => {
                    chapterToUpdate = {
                        ...chapterToUpdate,
                        panels: chapterToUpdate.panels.map(p => ({
                            ...p,
                            imageUrl: p.subPanels.some(sp => sp.id === target.sub_panel_id) ? null : p.imageUrl,
                            subPanels: p.subPanels.map(sp =>
                                sp.id === target.sub_panel_id
                                    ? { ...sp, prompt: target.prompt, characterIds: characterIds, shotType: target.shot_type, cameraAngle: target.camera_angle, imageUrl: null }
                                    : sp
                            ),
                        })),
                    };
                });
                setActiveChapter(chapterToUpdate);
                break;
            }
             case 'edit_panel_image': {
                const { sub_panel_id, edit_prompt } = action.args;
                const allSubPanels = activeChapter.panels.flatMap(p => p.subPanels);
                const targetSubPanel = allSubPanels.find(sp => sp.id === sub_panel_id);
                if (targetSubPanel?.imageUrl) {
                    try {
                        const newUrl = await editPanelImage(targetSubPanel.imageUrl, edit_prompt);
                        const compressedUrl = await compressImageBase64(newUrl);
                        setActiveChapter({ ...activeChapter, panels: activeChapter.panels.map(p => ({ ...p, subPanels: p.subPanels.map(sp => sp.id === sub_panel_id ? { ...sp, imageUrl: compressedUrl } : sp) }))});
                    } catch(e) { showToast("Image edit failed.", 'error');}
                } else {
                    showToast("Target panel has no image to edit.", 'error');
                }
                break;
            }
            default:
                showToast(`Action "${action.name}" is not implemented yet.`, 'error');
        }
        setSelectedSubPanelIds([]);
    }, [activeChapter, project.characters, setActiveChapter, setSelectedSubPanelIds]);

    if (!project || !activeChapter) return <div>Loading...</div>;

    return (
        <div className="flex h-full bg-[#09090b] text-gray-200 font-sans">
            {isLoading && <Loader message="Processing..." />}
            
            {/* LEFT SIDEBAR */}
            <aside className="w-[280px] flex-shrink-0 bg-[#09090b]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col z-20 relative">
                 {/* Project Header */}
                 <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                     <div className="flex items-center gap-2 mb-4">
                        <button onClick={onExit} className="text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all">
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400/80">Studio Mode</span>
                     </div>
                     <input 
                        type="text" 
                        onBlur={(e) => updateProject(p => ({...p, title: e.target.value || 'Untitled Manhwa'}))} 
                        defaultValue={project.title} 
                        className="bg-transparent text-xl font-bold w-full focus:outline-none focus:ring-2 focus:ring-violet-500/50 rounded-lg px-2 py-1 -ml-2 text-white placeholder-gray-600 transition-all" 
                     />
                 </div>

                 {/* Cover Art Preview */}
                 <div className="p-5">
                     <div className="relative group w-full aspect-[9/14] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/50">
                        <button ref={coverArtRef} onClick={() => setCoverViewerOpen(true)} className="w-full h-full transition-transform duration-700 group-hover:scale-105">
                            {isCoverLoading ? (
                                <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div></div>
                            ) : (
                                <img src={project.coverImagePreview} alt={project.title} className="w-full h-full object-cover" />
                            )}
                        </button>
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 gap-3 backdrop-blur-sm">
                            <button onClick={() => setCoverModalOpen(true)} className="px-4 py-2 text-xs font-bold text-white bg-violet-600 rounded-full hover:bg-violet-500 shadow-lg shadow-violet-500/20 flex items-center gap-2 transform transition hover:scale-105">
                                <EditIcon className="w-3 h-3" /> Edit Cover
                            </button>
                            <button onClick={() => downloadBase64Image(project.coverImage, `${project.title}-cover.jpg`)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors backdrop-blur-md">
                                <DownloadIcon className="w-4 h-4" />
                            </button>
                        </div>
                     </div>
                 </div>

                <div className="flex-grow overflow-y-auto px-3 space-y-1 py-2">
                    <div className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                        <span>Chapters</span>
                        <button onClick={() => setSettingsModalOpen(true)} className="hover:text-white transition-colors opacity-50 hover:opacity-100"><SettingsIcon className="w-3.5 h-3.5"/></button>
                    </div>
                    {project.chapters.map(chap => {
                        const isActive = chap.id === activeChapterId;
                        return (
                             <div key={chap.id} className={`flex items-center p-2.5 rounded-xl cursor-pointer transition-all duration-200 group relative overflow-hidden ${isActive ? 'bg-gradient-to-r from-violet-500/20 to-indigo-500/10 text-white border border-violet-500/20 shadow-lg shadow-violet-500/5' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'}`}>
                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-full my-2 ml-0.5"></div>}
                                {editingChapterId === chap.id ? (
                                    <input
                                        type="text"
                                        defaultValue={chap.title}
                                        onBlur={(e) => handleSaveChapterTitle(chap.id, e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveChapterTitle(chap.id, (e.target as HTMLInputElement).value)}
                                        autoFocus
                                        className="bg-black/50 text-white w-full text-sm outline-none rounded px-2 py-0.5 border border-violet-500/50"
                                    />
                                ) : (
                                    <span onClick={() => setActiveChapterId(chap.id)} className="flex-grow text-sm truncate font-medium pl-2">{chap.title}</span>
                                )}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingChapterId(chap.id)} className="p-1.5 hover:bg-white/10 rounded-md transition-colors"><EditIcon className="w-3 h-3"/></button>
                                    <button onClick={() => handleDeleteChapter(chap.id)} className="p-1.5 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 rounded-md transition-colors"><TrashIcon className="w-3 h-3"/></button>
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                <div className="p-4 border-t border-white/5 bg-gradient-to-b from-transparent to-black/20">
                    <button onClick={handleAddChapter} className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-zinc-800 to-zinc-700 border border-white/5 rounded-xl hover:from-zinc-700 hover:to-zinc-600 hover:border-white/10 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0">
                        <PlusIcon className="w-4 h-4"/> New Chapter
                    </button>
                </div>
            </aside>

            {/* CENTER CANVAS */}
            <main className="flex-1 relative bg-zinc-950 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] pointer-events-none mix-blend-overlay"></div>
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-violet-900/10 to-transparent pointer-events-none"></div>
                <Canvas 
                    chapter={activeChapter} 
                    setChapter={setActiveChapter}
                    isAgentMode={isAgentMode}
                    selectedSubPanelIds={selectedSubPanelIds}
                    setSelectedSubPanelIds={setSelectedSubPanelIds}
                    onExecutePlan={handleExecutePlan}
                    onCreateCharacterFromPanel={handleCreateCharacterFromPanel}
                    onExtractAsset={(subPanel) => setExtractingAsset({ subPanel })}
                    onContinuePanel={handleContinuePanel}
                />
            </main>

            {/* RIGHT SIDEBAR */}
            <aside className="w-[400px] flex-shrink-0 bg-[#09090b]/80 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20 relative shadow-2xl">
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <AssetManager onOpenCharacterModal={handleOpenCharacterModal}/>
                </div>
                 <div className="h-[40%] min-h-[350px] border-t border-white/5 bg-black/20 backdrop-blur-md relative">
                    <AssistantPanel 
                        isAgentMode={isAgentMode} 
                        setIsAgentMode={setIsAgentMode}
                        selectedSubPanelIds={selectedSubPanelIds}
                        setSelectedSubPanelIds={setSelectedSubPanelIds}
                        onExecuteAction={executeAgentAction}
                        updateHistory={updateHistory}
                    />
                </div>
            </aside>
            
            {/* FLOATING TOOLS (Bottom Right) */}
             <div className="fixed bottom-8 right-[420px] flex flex-col gap-4 z-40">
                <button onClick={() => setShowLiveAssistant(true)} className="w-12 h-12 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xl rounded-full shadow-lg shadow-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-violet-600 hover:border-violet-500 transition-all hover:scale-110 group" title="Live AI Debug Assistant">
                    <AssistantIcon className="w-6 h-6 group-hover:animate-pulse"/>
                </button>
                <button onClick={() => setImageAnalyzerOpen(true)} className="w-12 h-12 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xl rounded-full shadow-lg shadow-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-pink-600 hover:border-pink-500 transition-all hover:scale-110" title="Analyze Image">
                    <PhotoIcon className="w-5 h-5"/>
                </button>
                <button onClick={() => setImageGeneratorOpen(true)} className="w-12 h-12 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xl rounded-full shadow-lg shadow-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-cyan-600 hover:border-cyan-500 transition-all hover:scale-110" title="AI Art Generator">
                    <ImageIcon className="w-5 h-5"/>
                </button>
            </div>

            {/* MODALS */}
            <Modal isOpen={isCoverModalOpen} onClose={() => setCoverModalOpen(false)} title="Generate Cover Art">
                 <div className="space-y-4">
                    <textarea placeholder="Describe the scene..." value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} className="w-full p-3 bg-zinc-950 border border-white/10 rounded-xl focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all text-sm" rows={3}/>
                    <div><p className="text-xs font-bold text-gray-500 uppercase mb-2">Characters</p><div className="flex flex-wrap gap-2">{project.characters.map(char => (<button key={char.id} onClick={() => setSelectedCoverCharIds(p => p.includes(char.id) ? p.filter(i => i !== char.id) : [...p, char.id])} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${selectedCoverCharIds.includes(char.id) ? 'bg-violet-500/20 border-violet-500 text-violet-200' : 'bg-zinc-800 border-white/5 text-gray-400 hover:bg-zinc-700'}`}>{char.name}</button>))}</div></div>
                    <div><p className="text-xs font-bold text-gray-500 uppercase mb-2">Style</p><div className="flex flex-wrap gap-2">{project.styleReferences.map(style => (<button key={style.id} onClick={() => setSelectedCoverStyleIds(p => p.includes(style.id) ? p.filter(i => i !== style.id) : [...p, style.id])} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${selectedCoverStyleIds.includes(style.id) ? 'bg-violet-500/20 border-violet-500 text-violet-200' : 'bg-zinc-800 border-white/5 text-gray-400 hover:bg-zinc-700'}`}>{style.name}</button>))}</div></div>
                    <button onClick={handleGenerateCover} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all mt-4 hover:scale-[1.02] active:scale-[0.98]">Generate Cover</button>
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