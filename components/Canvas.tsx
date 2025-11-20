import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chapter, Panel, SubPanel, ScenePlanPage, Character, StyleReference, ObjectAsset, SceneType, DialogueBubble, BackgroundAsset, NewEntityAnalysis, NewObjectEntity } from '../types';
// Fix: Import 'generateSpeech' to make it available for use in the component.
import { generateSubPanelImage, analyzePanelForNewEntities, extractAssetFromImage, generateSpeech } from '../services/geminiService';
import { PanelLayoutPickerModal } from './PanelLayoutPickerModal';
import { ScenePlannerModal } from './ScenePlannerModal';
import { fileToBase64, compressImageBase64, downloadBase64Image } from '../utils/fileUtils';
import { showConfirmation, showToast } from '../systems/uiSystem';
import { playAudioFromBase64 } from '../utils/audioUtils';
import { useProject } from '../contexts/ProjectContext';
import { DialogueBubbleComponent } from './DialogueBubbleComponent';
import { SubPanelEditorModal } from './SubPanelEditorModal';
import { SubPanelComponent } from './SubPanelComponent';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { MagicWandIcon } from './icons/MagicWandIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import html2canvas from 'html2canvas';
import { ContinuePanelModal } from './ContinuePanelModal';

interface CanvasProps {
    chapter: Chapter;
    setChapter: (chapter: Chapter) => void;
    isAgentMode: boolean;
    selectedSubPanelIds: string[];
    setSelectedSubPanelIds: (ids: string[]) => void;
    onExecutePlan: (plan: ScenePlanPage[], characters: Character[], styles: StyleReference[], objects: ObjectAsset[], backgrounds: BackgroundAsset[], sceneType: SceneType) => Promise<void>;
    onCreateCharacterFromPanel: (subPanel: SubPanel) => void;
    onExtractAsset: (subPanel: SubPanel) => void;
    onContinuePanel: (subPanel: SubPanel) => void;
}

const waitForElementDimensions = (
    ref: React.MutableRefObject<Record<string, HTMLDivElement | null>>, 
    id: string, 
    timeout = 5000,
    minHeight = 20
): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = ref.current[id];
            if (element && element.clientWidth > 0 && element.clientHeight > minHeight) {
                clearInterval(interval);
                const resolutionMultiplier = 3.5; // Force high resolution calculation
                resolve({ width: Math.round(element.clientWidth * resolutionMultiplier), height: Math.round(element.clientHeight * resolutionMultiplier) });
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                const finalElement = ref.current[id];
                reject(new Error(`Timeout or invalid dimensions for element ${id}. Width: ${finalElement?.clientWidth}, Height: ${finalElement?.clientHeight}`));
            }
        }, 100);
    });
};

export const Canvas: React.FC<CanvasProps> = ({
    chapter,
    setChapter,
    isAgentMode,
    selectedSubPanelIds,
    setSelectedSubPanelIds,
    onExecutePlan,
    onCreateCharacterFromPanel,
    onExtractAsset,
    onContinuePanel
}) => {
    const { project, updateProject } = useProject();
    const [isLayoutPickerOpen, setLayoutPickerOpen] = useState(false);
    const [insertAfterPanelId, setInsertAfterPanelId] = useState<string | null>(null);
    const [isScenePlannerOpen, setScenePlannerOpen] = useState(false);
    const [editingSubPanel, setEditingSubPanel] = useState<SubPanel | null>(null);
    const [playingAudioBubbleId, setPlayingAudioBubbleId] = useState<string | null>(null);
    const [analysisQueue, setAnalysisQueue] = useState<SubPanel[]>([]);
    
    // Continuity / Arrow feature state
    const [continuingSubPanel, setContinuingSubPanel] = useState<SubPanel | null>(null);
    
    const [generationQueue, setGenerationQueue] = useState<SubPanel[]>([]);
    const [loadingIds, setLoadingIds] = useState<string[]>([]);

    const audioContextRef = useRef<AudioContext | null>(null);
    const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);
    const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const lastGeneratedImageUrlRef = useRef<string | null>(null);

    const updatePanel = useCallback((panelId: string, updater: (p: Panel) => Panel) => {
        setChapter({
            ...chapter,
            panels: chapter.panels.map(p => p.id === panelId ? updater(p) : p),
        });
    }, [chapter, setChapter]);

     const updateSubPanel = useCallback((subPanelId: string, updater: (sp: SubPanel) => SubPanel) => {
        setChapter({
            ...chapter,
            panels: chapter.panels.map(p => ({
                ...p,
                subPanels: p.subPanels.map(sp => sp.id === subPanelId ? updater(sp) : sp),
            })),
        });
    }, [chapter, setChapter]);
    
    const analyzeAndCreateAssets = useCallback(async (subPanel: SubPanel) => {
        if (!subPanel.imageUrl) return;
        showToast("Nano is analyzing the panel for new assets...", "info");
        try {
            const analysis: NewEntityAnalysis = await analyzePanelForNewEntities(
                subPanel.imageUrl,
                subPanel.prompt,
                project.characters,
                project.objects
            );

            if (analysis.new_characters.length === 0 && analysis.new_objects.length === 0) return;
            
            showToast(`Nano found ${analysis.new_characters.length} new character(s) and ${analysis.new_objects.length} new object(s). Creating assets...`, 'info');

            for (const char of analysis.new_characters) {
                onCreateCharacterFromPanel({ ...subPanel, prompt: char.description });
            }

            for (const obj of analysis.new_objects) {
                const objImage = await extractAssetFromImage(subPanel.imageUrl, obj.description, 'object');
                const compressedObjImage = await compressImageBase64(objImage);
                const characterOwner = project.characters.find(c => c.name === obj.owner_suggestion);
                const newObject: ObjectAsset = {
                    id: `obj-${Date.now()}`, name: obj.name_suggestion, image: compressedObjImage,
                    ownerInfo: { type: characterOwner ? 'character' : 'various', name: characterOwner ? characterOwner.name : 'Various' },
                };
                updateProject(p => ({...p, objects: [...p.objects, newObject]}));
                showToast(`New object asset created: ${newObject.name}`, 'success');
            }

        } catch (error) {
            console.error("Failed during automatic asset creation:", error);
            showToast("Nano had trouble creating new assets from the panel.", "error");
        }
    }, [project, updateProject, onCreateCharacterFromPanel]);


    useEffect(() => {
        const itemsToGenerate = chapter.panels
            .flatMap(p => p.subPanels)
            .filter(sp => sp.prompt && !sp.imageUrl && !loadingIds.includes(sp.id) && !generationQueue.some(q => q.id === sp.id));

        if (itemsToGenerate.length > 0) {
            setGenerationQueue(prev => [...prev, ...itemsToGenerate]);
        }
    }, [chapter.panels, loadingIds, generationQueue]);

    useEffect(() => {
        const processQueue = async () => {
            if (generationQueue.length === 0 || loadingIds.length >= project.settings.maxConcurrentGenerations) {
                return;
            }

            const availableSlots = project.settings.maxConcurrentGenerations - loadingIds.length;
            const itemsToProcess = generationQueue.slice(0, availableSlots);
            
            if (itemsToProcess.length === 0) return;

            setLoadingIds(prev => [...prev, ...itemsToProcess.map(item => item.id)]);
            setGenerationQueue(prev => prev.slice(itemsToProcess.length));

            const generationPromises = itemsToProcess.map(async (item) => {
                try {
                    const { width, height } = await waitForElementDimensions(elementRefs, item.id);
                    
                    const charIds = item.characterIds || [];
                    const styleIds = item.styleReferenceIds || [];
                    const bgIds = item.backgroundIds || [];

                    const characters = project.characters.filter(c => charIds.includes(c.id));
                    const styles = project.styleReferences.filter(s => styleIds.includes(s.id));
                    const backgrounds = project.backgrounds.filter(b => bgIds.includes(b.id));
                    const objects = project.objects; 

                    const continuityId = item.continuitySubPanelId;
                    let continuityPanel: SubPanel | undefined;
                    if (continuityId) {
                        continuityPanel = project.chapters.flatMap(c => c.panels).flatMap(p => p.subPanels).find(sp => sp.id === continuityId);
                    }
                    
                    const continuityRef = continuityPanel?.imageUrl || lastGeneratedImageUrlRef.current;
                    
                    // NANO CONSCIOUSNESS: Gather context from previous panels
                    const allSubPanels = chapter.panels.flatMap(p => p.subPanels);
                    const currentIndex = allSubPanels.findIndex(sp => sp.id === item.id);
                    // Get prompts of up to 5 preceding panels to give the AI narrative memory
                    const previousPrompts = allSubPanels
                        .slice(Math.max(0, currentIndex - 5), currentIndex)
                        .map((sp, idx) => `Panel ${idx + 1} (PREVIOUS): ${sp.prompt}`)
                        .join('\n');

                    const imageUrl = await generateSubPanelImage(
                        item, 
                        width, 
                        height, 
                        styles, 
                        characters, 
                        objects, 
                        backgrounds, 
                        previousPrompts, // Pass the consciousness context
                        continuityRef || undefined
                    );

                    const compressedUrl = await compressImageBase64(imageUrl);
                    if (project.settings.maxConcurrentGenerations === 1) {
                         lastGeneratedImageUrlRef.current = compressedUrl;
                    }
                    
                    updateSubPanel(item.id, () => ({...item, imageUrl: compressedUrl }));
                    setAnalysisQueue(prev => [...prev, { ...item, imageUrl: compressedUrl }]);

                } catch (error: any) {
                    console.error(`Error generating for ${item.id}:`, error);
                    showToast(`Generation failed: ${error.message || 'Unknown error'}`, "error");
                } finally {
                    setLoadingIds(prev => prev.filter(id => id !== item.id));
                }
            });
            await Promise.all(generationPromises);
        };
        processQueue();
    }, [generationQueue, loadingIds, project, updateSubPanel, chapter.panels]);
    
    useEffect(() => {
        if (analysisQueue.length > 0) {
            const queue = [...analysisQueue];
            setAnalysisQueue([]);
            const processAnalysisQueue = async () => {
                for(const item of queue) {
                    await analyzeAndCreateAssets(item);
                }
            };
            processAnalysisQueue();
        }
    }, [analysisQueue, analyzeAndCreateAssets]);
    
    useEffect(() => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) { console.error("AudioContext is not supported by this browser."); }
        }
        return () => {
            if (currentAudioSourceRef.current) currentAudioSourceRef.current.stop();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close().catch(console.error);
        };
    }, []);
    
    const handleAddPanel = useCallback((layout: number[][]) => {
        const newPanel: Panel = {
            id: `panel-${Date.now()}`,
            layout,
            subPanels: Array.from(new Set(layout.flat())).map(val => ({
                id: `subpanel-${Date.now()}-${val}`, prompt: '', characterIds: [], imageUrl: null,
            })),
            dialogueBubbles: [],
        };

        const panelIndex = chapter.panels.findIndex(p => p.id === insertAfterPanelId);
        const newPanels = [...chapter.panels];
        if (panelIndex > -1) newPanels.splice(panelIndex + 1, 0, newPanel);
        else newPanels.push(newPanel);

        setChapter({ ...chapter, panels: newPanels });
        setLayoutPickerOpen(false);
        setInsertAfterPanelId(null);
    }, [chapter, insertAfterPanelId, setChapter]);
    
    const handleCreateNextPanel = useCallback((layout: number[][], prompt: string, maintainConsistency: boolean) => {
        if (!continuingSubPanel) return;

        const newPanel: Panel = {
            id: `panel-${Date.now()}`,
            layout,
            subPanels: Array.from(new Set(layout.flat())).map(val => ({
                id: `subpanel-${Date.now()}-${val}`, 
                prompt: prompt, 
                characterIds: continuingSubPanel.characterIds || [],
                styleReferenceIds: continuingSubPanel.styleReferenceIds || [],
                backgroundIds: continuingSubPanel.backgroundIds || [],
                imageUrl: null,
                continuitySubPanelId: maintainConsistency ? continuingSubPanel.id : undefined
            })),
            dialogueBubbles: [],
        };
        
        // Insert after the panel that contains the source subpanel
        const parentPanelIndex = chapter.panels.findIndex(p => p.subPanels.some(sp => sp.id === continuingSubPanel.id));
        const newPanels = [...chapter.panels];
        if (parentPanelIndex > -1) {
             newPanels.splice(parentPanelIndex + 1, 0, newPanel);
        } else {
            newPanels.push(newPanel);
        }
        
        setChapter({ ...chapter, panels: newPanels });
        setContinuingSubPanel(null); // Close modal
        showToast("Next scene created. Generation starting...", "success");

    }, [chapter, continuingSubPanel, setChapter]);

    const handleDeletePanel = useCallback(async (panelId: string) => {
        const confirmed = await showConfirmation({ title: "Delete Panel", message: "Are you sure you want to delete this panel and all its content?" });
        if (confirmed) {
            setChapter({ ...chapter, panels: chapter.panels.filter(p => p.id !== panelId) });
        }
    }, [chapter, setChapter]);
    
    const movePanel = useCallback((panelId: string, direction: 'up' | 'down') => {
        const index = chapter.panels.findIndex(p => p.id === panelId);
        if (index === -1) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= chapter.panels.length) return;
        const newPanels = [...chapter.panels];
        const [movedPanel] = newPanels.splice(index, 1);
        newPanels.splice(newIndex, 0, movedPanel);
        setChapter({ ...chapter, panels: newPanels });
    }, [chapter, setChapter]);
    
    const handleSaveSubPanelEdit = useCallback((updatedSubPanel: SubPanel) => {
        updateSubPanel(updatedSubPanel.id, () => ({...updatedSubPanel, imageUrl: null }));
        setEditingSubPanel(null);
    }, [updateSubPanel]);

    const handleAddBubble = useCallback((panelId: string) => {
        const defaultStyle = project.dialogueStyles.length > 0 ? project.dialogueStyles[0].id : undefined;
        const newBubble: DialogueBubble = {
            id: `bubble-${Date.now()}`,
            text: 'New Dialogue',
            x: 10,
            y: 10,
            width: 150,
            height: 80,
            zIndex: 10,
            styleId: defaultStyle
        };
        updatePanel(panelId, (p) => ({ ...p, dialogueBubbles: [...p.dialogueBubbles, newBubble] }));
    }, [project.dialogueStyles, updatePanel]);

    const handleUpdateBubble = useCallback((panelId: string, bubbleId: string, updates: Partial<DialogueBubble>) => {
        updatePanel(panelId, (p) => ({
            ...p,
            dialogueBubbles: p.dialogueBubbles.map(b => b.id === bubbleId ? { ...b, ...updates } : b)
        }));
    }, [updatePanel]);

    const handleDeleteBubble = useCallback((panelId: string, bubbleId: string) => {
        updatePanel(panelId, (p) => ({
            ...p,
            dialogueBubbles: p.dialogueBubbles.filter(b => b.id !== bubbleId)
        }));
    }, [updatePanel]);

    const handleBringBubbleToFront = useCallback((panelId: string, bubbleId: string) => {
        updatePanel(panelId, (p) => {
            const maxZ = Math.max(...p.dialogueBubbles.map(b => b.zIndex), 0);
            return {
                ...p,
                dialogueBubbles: p.dialogueBubbles.map(b => b.id === bubbleId ? { ...b, zIndex: maxZ + 1 } : b)
            };
        });
    }, [updatePanel]);

    const handlePlayAudio = useCallback(async (text: string, bubbleId: string) => {
        if (!audioContextRef.current) return showToast("Audio context not available.", "error");
        if (currentAudioSourceRef.current) { currentAudioSourceRef.current.stop(); currentAudioSourceRef.current = null; }
        setPlayingAudioBubbleId(bubbleId);
        try {
            const base64Audio = await generateSpeech(text);
            const source = await playAudioFromBase64(base64Audio, audioContextRef.current);
            currentAudioSourceRef.current = source;
            source.onended = () => { setPlayingAudioBubbleId(null); currentAudioSourceRef.current = null; };
        } catch (error) {
            console.error(error); showToast("Could not play audio.", "error"); setPlayingAudioBubbleId(null);
        }
    }, []);

    const toggleSubPanelSelection = useCallback((subPanelId: string) => {
        if (!isAgentMode) return;
        const newSelection = selectedSubPanelIds.includes(subPanelId) ? selectedSubPanelIds.filter(id => id !== subPanelId) : [...selectedSubPanelIds, subPanelId];
        setSelectedSubPanelIds(newSelection);
    }, [isAgentMode, selectedSubPanelIds, setSelectedSubPanelIds]);

    const handleRegenerate = (subPanel: SubPanel) => {
        updateSubPanel(subPanel.id, sp => ({ ...sp, imageUrl: null }));
    };

    const handleDeleteContent = (subPanel: SubPanel) => {
        updateSubPanel(subPanel.id, sp => ({ ...sp, imageUrl: null, prompt: '' }));
    };

    const handleDownloadChapter = useCallback(async () => {
        if (!panelContainerRef.current) return;
        showToast("Generating High-Quality Webtoon Strip...", "info");

        try {
            const panelElements = Array.from(panelContainerRef.current.children) as HTMLElement[];
            const canvases: HTMLCanvasElement[] = [];
            let totalHeight = 0;
            let maxWidth = 0;

            // Generate canvas for each panel individually to maintain high res
            for (const panelEl of panelElements) {
                // Skip hidden/UI elements
                if (!panelEl.classList.contains('panel-container')) continue;
                
                const canvas = await html2canvas(panelEl, {
                    backgroundColor: '#111827',
                    scale: 2, // High res
                    ignoreElements: (element) => element.tagName === 'BUTTON' || element.classList.contains('opacity-0') // Ignore UI buttons
                });
                canvases.push(canvas);
                totalHeight += canvas.height;
                maxWidth = Math.max(maxWidth, canvas.width);
            }

            if (canvases.length === 0) {
                showToast("No panels to download.", "error");
                return;
            }

            // Stitch vertically
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = maxWidth;
            finalCanvas.height = totalHeight + (canvases.length * 20); // Add spacing
            const ctx = finalCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");

            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            let yOffset = 0;
            for (const canvas of canvases) {
                const xOffset = (maxWidth - canvas.width) / 2;
                ctx.drawImage(canvas, xOffset, yOffset);
                yOffset += canvas.height + 20; 
            }

            downloadBase64Image(finalCanvas.toDataURL('image/jpeg', 0.95), `${chapter.title}-webtoon.jpg`);
            showToast("Webtoon strip downloaded successfully!", "success");
        } catch (error) {
            console.error(error); 
            showToast("Could not download chapter image.", "error");
        }
    }, [chapter.title]);

    return (
        <div className="h-full overflow-y-auto text-white p-4 pt-24 scroll-smooth">
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-30 bg-zinc-800/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl flex items-center gap-2">
                <button onClick={handleDownloadChapter} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-zinc-700 hover:bg-zinc-600 rounded-full transition-all hover:scale-105">
                    <DownloadIcon className="w-3.5 h-3.5" /> Download
                </button>
                <div className="w-px h-6 bg-white/10"></div>
                <button onClick={() => setScenePlannerOpen(true)} className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full hover:shadow-lg hover:shadow-violet-500/30 transition-all hover:scale-105">
                    <MagicWandIcon className="w-3.5 h-3.5" /> Plan Scene with AI
                </button>
            </div>
            
            {chapter.panels.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <PlusIcon className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-gray-400 mb-4 font-medium">This chapter is empty.</p>
                    <button onClick={() => { setInsertAfterPanelId(null); setLayoutPickerOpen(true); }} className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-violet-600 rounded-full hover:bg-violet-500 shadow-lg transition-all hover:scale-105">
                        Start Creating
                    </button>
                </div>
            )}
            
            {chapter.panels.length > 0 && (
                <div ref={panelContainerRef} className="flex flex-col items-center pb-20" style={{ gap: `${project.settings.panelSpacing}px` }}>
                    {chapter.panels.map((panel, panelIndex) => (
                        <div key={panel.id} className="panel-container group relative w-full transition-all duration-300 hover:z-10" style={{ maxWidth: `${project.settings.pageWidth}px` }}>
                             <div className="relative bg-black rounded-sm overflow-hidden shadow-2xl ring-1 ring-white/5 group-hover:ring-violet-500/30 transition-all" style={{ display: 'grid', gridTemplateRows: `repeat(${panel.layout.length}, 1fr)`, gridTemplateColumns: `repeat(${panel.layout[0].length}, 1fr)`, gap: `${project.settings.panelSpacing}px`, aspectRatio: `${panel.layout[0].length / panel.layout.length}` }}>
                                {panel.subPanels.map(sp => {
                                    const { rowStart, rowEnd, colStart, colEnd } = getGridArea(panel.layout, sp.id);
                                    const isLoading = loadingIds.includes(sp.id);
                                    const isQueued = generationQueue.some(item => item.id === sp.id);
                                    const status = isLoading ? 'generating' : isQueued ? 'queued' : 'idle';
                                    return (
                                        <div key={sp.id} style={{ gridArea: `${rowStart} / ${colStart} / ${rowEnd} / ${colEnd}` }} ref={(el) => { elementRefs.current[sp.id] = el; }}>
                                            <SubPanelComponent
                                                subPanel={sp}
                                                onGenerateClick={() => setEditingSubPanel(sp)}
                                                onEditClick={() => { /* Placeholder */ }}
                                                onUploadClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) { /* Placeholder */ } }; input.click(); }}
                                                onDownloadClick={() => downloadBase64Image(sp.imageUrl!, `${chapter.title}-panel-${sp.id}.png`)}
                                                onDeleteContent={() => handleDeleteContent(sp)}
                                                onRegenerate={() => handleRegenerate(sp)}
                                                onAddBubble={() => handleAddBubble(panel.id)}
                                                onAnalyze={() => { /* Placeholder */ }}
                                                onCreateCharacter={() => onCreateCharacterFromPanel(sp)}
                                                onExtractAsset={() => onExtractAsset(sp)}
                                                onContinuePanel={() => setContinuingSubPanel(sp)}
                                                status={status}
                                                isSelected={isAgentMode && selectedSubPanelIds.includes(sp.id)}
                                                onSelect={() => toggleSubPanelSelection(sp.id)}
                                                isAgentMode={isAgentMode}
                                            />
                                        </div>
                                    );
                                })}
                                {panel.dialogueBubbles.map(bubble => (
                                    <DialogueBubbleComponent 
                                        key={bubble.id} 
                                        bubble={bubble} 
                                        panelBounds={elementRefs.current[panel.id]?.getBoundingClientRect()} 
                                        onUpdate={(id, u) => handleUpdateBubble(panel.id, id, u)} 
                                        onDelete={(id) => handleDeleteBubble(panel.id, id)} 
                                        onBringToFront={(id) => handleBringBubbleToFront(panel.id, id)} 
                                        onPlayAudio={(text) => handlePlayAudio(text, bubble.id)} 
                                        isPlaying={playingAudioBubbleId === bubble.id} 
                                    />
                                ))}
                            </div>
                            
                            <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                <button onClick={() => movePanel(panel.id, 'up')} disabled={panelIndex === 0} className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-gray-400 hover:text-white disabled:opacity-30 shadow-lg backdrop-blur-sm"><ArrowUpIcon className="w-4 h-4"/></button>
                                <button onClick={() => { setInsertAfterPanelId(panel.id); setLayoutPickerOpen(true);}} className="p-2 rounded-full bg-zinc-800/80 hover:bg-violet-600 text-gray-400 hover:text-white shadow-lg backdrop-blur-sm"><PlusIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleDeletePanel(panel.id)} className="p-2 rounded-full bg-zinc-800/80 hover:bg-red-600 text-gray-400 hover:text-white shadow-lg backdrop-blur-sm"><TrashIcon className="w-4 h-4"/></button>
                                <button onClick={() => movePanel(panel.id, 'down')} className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-gray-400 hover:text-white disabled:opacity-30 shadow-lg backdrop-blur-sm"><ArrowDownIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <PanelLayoutPickerModal isOpen={isLayoutPickerOpen} onClose={() => setLayoutPickerOpen(false)} onSelect={handleAddPanel} />
            <ScenePlannerModal isOpen={isScenePlannerOpen} onClose={() => setScenePlannerOpen(false)} onExecutePlan={onExecutePlan}/>
            {editingSubPanel && <SubPanelEditorModal isOpen={!!editingSubPanel} onClose={() => setEditingSubPanel(null)} subPanel={editingSubPanel} onSave={handleSaveSubPanelEdit} />}
            
            {/* The new Continuity Modal */}
            {continuingSubPanel && (
                <ContinuePanelModal 
                    isOpen={!!continuingSubPanel} 
                    onClose={() => setContinuingSubPanel(null)} 
                    sourceSubPanel={continuingSubPanel} 
                    onConfirm={handleCreateNextPanel} 
                />
            )}
        </div>
    );
};

const getGridArea = (layout: number[][], subPanelId: string) => {
    const panelValueStr = subPanelId.split('-').pop()!;
    const panelValue = parseInt(panelValueStr, 10);
    const numRows = layout.length;
    const numCols = layout[0].length;
    let rowStart = numRows + 1, rowEnd = 0, colStart = numCols + 1, colEnd = 0;
    
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            if (layout[r][c] === panelValue) {
                rowStart = Math.min(rowStart, r + 1);
                rowEnd = Math.max(rowEnd, r + 2);
                colStart = Math.min(colStart, c + 1);
                colEnd = Math.max(colEnd, c + 2);
            }
        }
    }
    return { rowStart, rowEnd, colStart, colEnd };
};