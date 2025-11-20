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

const APP_VERSION = '1.9.1'; 

interface StudioProps {
    username: string;
    setProjectTitle: (title: string) => void;
}

export const Studio: React.FC<StudioProps> = ({ username, setProjectTitle }) => {
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
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
    const [extractingAsset, setExtractingAsset] = useState<{ subPanel: SubPanel } | null>(null);
    const [characterSelection, setCharacterSelection] = useState<{ subPanel: SubPanel, characters: CharacterInPanel[] } | null>(null);

    const [isImageGeneratorOpen, setImageGeneratorOpen] = useState(false);
    const [isImageAnalyzerOpen, setImageAnalyzerOpen] = useState(false);
    const [showLiveAssistant, setShowLiveAssistant] = useState(false);
    const coverArtRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        // Automatically update version but do NOT open modal unless explicitly requested
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
            showToast("Failed to generate cover art. Check network or permissions.", 'error');
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

            showToast(`Nano is extracting '${prompt}'...`, 'info');
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
                showToast("Nano didn't find any new characters in this panel.", 'info');
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
            showToast("An error occurred during character creation.", 'error');
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
                referenceImage: 'data:image/svg+xml;charset=UTF-8,%3csvg width="300" height="400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"%3e%3crect width="300" height="400" fill="%232d3748"/%3e%3ctext x="50%25" y="50%25" fill="%23a0aec0" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16pt"%3eUpload or Generate%3c/text%3e%3c/svg%3e',
            });
        }
    }, []);

    const executeAgentAction = useCallback(async (action: AgentFunctionCall) => {
        if (!activeChapter) return;
        showToast(`Executing agent action: ${action.name}`, 'info');

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
        <div className="flex h-full">
            {isLoading && <Loader message="Processing..." />}
            <aside className="w-[300px] flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-r border-gray-700 p-4 flex flex-col">
                 <div className="relative mb-4 group">
                    <button ref={coverArtRef} onClick={() => setCoverViewerOpen(true)} className="w-full aspect-[9/16] rounded-lg overflow-hidden border-2 border-transparent group-hover:border-purple-500 transition-all">
                        {isCoverLoading && <div className="w-full h-full bg-gray-800 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div></div>}
                        {!isCoverLoading && <img src={project.coverImagePreview} alt={project.title} className="w-full h-full object-cover" />}
                    </button>
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setCoverModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600/80 rounded-full hover:bg-purple-600"><EditIcon className="w-3 h-3" /> Edit Cover</button>
                        <button onClick={() => downloadBase64Image(project.coverImage, `${project.title}-cover.jpg`)} title="Download Full Cover" className="absolute bottom-2 right-2 p-2 bg-gray-800/60 rounded-full text-white hover:bg-cyan-600"><DownloadIcon className="w-4 h-4" /></button>
                    </div>
                 </div>

                <div className="flex items-center justify-between mb-4">
                     <input type="text" onBlur={(e) => updateProject(p => ({...p, title: e.target.value || 'Untitled Manhwa'}))} defaultValue={project.title} className="bg-transparent text-lg font-bold w-full focus:outline-none focus:bg-gray-800 rounded-md p-1 -m-1" />
                    <button onClick={() => setSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-gray-700"><SettingsIcon className="w-5 h-5"/></button>
                </div>

                <nav className="flex-grow overflow-y-auto pr-2 space-y-1">
                    {project.chapters.map(chap => {
                        const isActive = chap.id === activeChapterId;
                        return (
                             <div key={chap.id} className={`flex items-center p-2 rounded-md cursor-pointer transition-colors group ${isActive ? 'bg-purple-600/30' : 'hover:bg-gray-800'}`}>
                                {editingChapterId === chap.id ? (
                                    <input
                                        type="text"
                                        defaultValue={chap.title}
                                        onBlur={(e) => handleSaveChapterTitle(chap.id, e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveChapterTitle(chap.id, (e.target as HTMLInputElement).value)}
                                        autoFocus
                                        className="bg-gray-700 text-white w-full text-sm outline-none"
                                    />
                                ) : (
                                    <span onClick={() => setActiveChapterId(chap.id)} className="flex-grow text-sm truncate">{chap.title}</span>
                                )}
                                <button onClick={() => setEditingChapterId(chap.id)} className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white"><EditIcon className="w-3 h-3"/></button>
                                <button onClick={() => handleDeleteChapter(chap.id)} className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"><TrashIcon className="w-3 h-3"/></button>
                            </div>
                        )
                    })}
                </nav>
                <button onClick={handleAddChapter} className="mt-4 flex items-center justify-center gap-2 w-full p-2 text-sm bg-gray-700/50 rounded-md hover:bg-gray-700"><PlusIcon className="w-4 h-4"/> Add Chapter</button>
            </aside>

            <main className="flex-1">
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

            <aside className="w-[450px] flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-l border-gray-700 p-4 flex flex-col gap-4">
                <div className="flex-1 min-h-0">
                    <AssetManager onOpenCharacterModal={handleOpenCharacterModal}/>
                </div>
                 <div className="flex-shrink-0 h-[40%] min-h-[300px]">
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
            
             <div className="fixed bottom-4 right-[474px] flex flex-col gap-2 z-40">
                <button onClick={() => setShowLiveAssistant(true)} className="bg-gray-800 p-3 rounded-full shadow-lg hover:bg-purple-600 border border-gray-700" title="Live AI Debug Assistant"><AssistantIcon className="w-6 h-6"/></button>
                <button onClick={() => setImageAnalyzerOpen(true)} className="bg-gray-800 p-3 rounded-full shadow-lg hover:bg-purple-600 border border-gray-700" title="Analyze Image"><PhotoIcon className="w-6 h-6"/></button>
                <button onClick={() => setImageGeneratorOpen(true)} className="bg-gray-800 p-3 rounded-full shadow-lg hover:bg-purple-600 border border-gray-700" title="AI Art Generator"><ImageIcon className="w-6 h-6"/></button>
            </div>

            <Modal isOpen={isCoverModalOpen} onClose={() => setCoverModalOpen(false)} title="Generate Cover Art">
                 <div className="space-y-4">
                    <textarea placeholder="Describe your cover art..." value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md" rows={3}/>
                    <div><p className="text-sm font-semibold mb-2">Characters:</p><div className="flex flex-wrap gap-2">{project.characters.map(char => (<button key={char.id} onClick={() => setSelectedCoverCharIds(p => p.includes(char.id) ? p.filter(i => i !== char.id) : [...p, char.id])} className={`px-3 py-1 text-sm rounded-full ${selectedCoverCharIds.includes(char.id) ? 'bg-purple-600' : 'bg-gray-600'}`}>{char.name}</button>))}</div></div>
                    <div><p className="text-sm font-semibold mb-2">Style References:</p><div className="flex flex-wrap gap-2">{project.styleReferences.map(style => (<button key={style.id} onClick={() => setSelectedCoverStyleIds(p => p.includes(style.id) ? p.filter(i => i !== style.id) : [...p, style.id])} className={`px-3 py-1 text-sm rounded-full ${selectedCoverStyleIds.includes(style.id) ? 'bg-purple-600' : 'bg-gray-600'}`}>{style.name}</button>))}</div></div>
                    <button onClick={handleGenerateCover} className="w-full bg-purple-600 text-white font-bold py-2 rounded-md mt-4">Generate</button>
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