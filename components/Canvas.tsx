
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chapter, Panel, SubPanel, ScenePlanPage, Character, StyleReference, ObjectAsset, SceneType, BackgroundAsset } from '../types';
import { generateSubPanelImage, assessPanelQuality, editPanelImage } from '../services/geminiService';
import { PanelLayoutPickerModal } from './PanelLayoutPickerModal';
import { ScenePlannerModal } from './ScenePlannerModal';
import { compressImageBase64, downloadBase64Image } from '../utils/fileUtils';
import { showConfirmation, showToast } from '../systems/uiSystem';
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
import { BrainCircuitIcon } from './icons/BrainCircuitIcon';
import { DirectorClapperIcon } from './icons/DirectorClapperIcon';
import { DirectorThoughtCloud } from './DirectorThoughtCloud';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ContinuePanelModal } from './ContinuePanelModal';
import { ExportModal } from './ExportModal';
import { MagicEditModal } from './MagicEditModal';
import { AnalysisModal } from './AnalysisModal';
import { layouts as layoutDefinitions } from './layouts';
import { generateId } from '../utils/ids';
import { logger, resetErrorCount } from '../systems/logger';

interface CanvasProps {
    chapter: Chapter;
    setChapter: (update: Chapter | ((prev: Chapter) => Chapter)) => void;
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
    timeout = 3000, 
    minHeight = 10
): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = ref.current[id];
            if (element && element.clientWidth > 0 && element.clientHeight > minHeight) {
                clearInterval(interval);
                // Reduce multiplier slightly to match 2K render target better without overblowing DOM
                const resolutionMultiplier = 2.0; 
                logger.info(`Measured Element ${id.slice(-4)}: ${element.clientWidth}x${element.clientHeight}`);
                resolve({ width: Math.round(element.clientWidth * resolutionMultiplier), height: Math.round(element.clientHeight * resolutionMultiplier) });
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                console.warn(`Timeout waiting for dimensions on ${id}, using fallback.`);
                logger.warn(`Dimension Timeout ${id.slice(-4)}. Using fallback 1024x1536.`);
                resolve({ width: 1024, height: 1536 }); 
            }
        }, 50);
    });
};

// --- FIX: ULTRA AGGRESSIVE WEBTOON HEIGHT CALCULATION v3 ---
// Manhwa panels must be TALL. 
const getPanelHeight = (layout: number[][], pageWidth: number): number => {
    if (!layout || !layout.length) return pageWidth * 2.0; // Default 1:2 (Very Tall)

    const getLayoutId = (grid: number[][]): string => {
        const signature = JSON.stringify(grid);
        for (const [key, val] of Object.entries(layoutDefinitions)) {
            if (JSON.stringify(val) === signature) return key;
        }
        return 'custom';
    };
    const layoutId = getLayoutId(layout);

    // Specific overrides for known layouts
    // 1 = Standard Vertical. FORCE 2.0x (1:2 ratio) to ensure verticality and prevent squares.
    if (layoutId === '1') return Math.round(pageWidth * 2.0); 
    
    // 1-ultra-tall = Scrolling shot. Should be very long (~1:3)
    if (layoutId === '1-ultra-tall') return Math.round(pageWidth * 3.2);
    
    // 2v = Two panels stacked. 
    if (layoutId === '2v') return Math.round(pageWidth * 3.0);
    
    // 3v = Three panels stacked.
    if (layoutId === '3v') return Math.round(pageWidth * 4.5);

    // 2h = Horizontal split.
    if (layoutId === '2h') return Math.round(pageWidth * 0.6); 

    // Slash diag = 2 rows.
    if (layoutId === 'slash-diag') return Math.round(pageWidth * 2.2);

    // Fallback for custom grids:
    const rows = layout.length;
    const heightPerRow = pageWidth * 1.5;
    return Math.round(rows * heightPerRow);
};

export const Canvas: React.FC<CanvasProps> = ({
    chapter, setChapter, isAgentMode, selectedSubPanelIds, setSelectedSubPanelIds, onExecutePlan, onCreateCharacterFromPanel, onExtractAsset, onContinuePanel
}) => {
    const { project } = useProject();
    const [isLayoutPickerOpen, setLayoutPickerOpen] = useState(false);
    const [insertAfterPanelId, setInsertAfterPanelId] = useState<string | null>(null);
    const [isScenePlannerOpen, setScenePlannerOpen] = useState(false);
    const [editingSubPanel, setEditingSubPanel] = useState<SubPanel | null>(null);
    const [continuingSubPanel, setContinuingSubPanel] = useState<SubPanel | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const [magicEditSubPanel, setMagicEditSubPanel] = useState<SubPanel | null>(null);
    const [analyzingSubPanelId, setAnalyzingSubPanelId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any | null>(null);
    
    const [generationQueue, setGenerationQueue] = useState<SubPanel[]>([]);
    const [processingMode, setProcessingMode] = useState<'idle' | 'single' | 'batch-5' | 'auto' | 'repeat'>('idle');
    const [loadingIds, setLoadingIds] = useState<string[]>([]);
    const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);
    const [directorThought, setDirectorThought] = useState<string>("");
    
    const [directorStartTime, setDirectorStartTime] = useState<number | null>(null);
    const [completedCount, setCompletedCount] = useState(0);

    const panelContainerRef = useRef<HTMLDivElement | null>(null);
    const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
    
    const lastGeneratedImageUrlRef = useRef<string | null>(null);

    const updatePanel = useCallback((panelId: string, updater: (p: Panel) => Panel) => {
        setChapter(prev => ({ ...prev, panels: prev.panels.map(p => p.id === panelId ? updater(p) : p) }));
    }, [setChapter]);

     const updateSubPanel = useCallback((subPanelId: string, updater: (sp: SubPanel) => SubPanel) => {
        setChapter(prev => ({
            ...prev,
            panels: prev.panels.map(p => ({
                ...p,
                subPanels: p.subPanels.map(sp => sp.id === subPanelId ? updater(sp) : sp),
            })),
        }));
    }, [setChapter]);

    // Handle Emergency Stop from Logger
    useEffect(() => {
        const handleEmergencyStop = () => {
            setProcessingMode('idle');
            setGenerationQueue([]);
            setLoadingIds([]);
            setDirectorThought("🛑 PARADA DE EMERGENCIA: Límite de errores excedido.");
            showToast("Emergency Stop: Too many errors.", 'error');
        };
        window.addEventListener('nano-emergency-stop', handleEmergencyStop);
        return () => window.removeEventListener('nano-emergency-stop', handleEmergencyStop);
    }, []);

    // Robust Auto-Start Trigger
    useEffect(() => {
        if (generationQueue.length > 0 && processingMode === 'idle' && loadingIds.length === 0) {
            logger.system("Queue detected. Auto-starting Director Mode.");
            resetErrorCount(); 
            setProcessingMode('auto');
            setDirectorThought("Iniciando secuencia automática...");
        }
    }, [generationQueue.length, processingMode, loadingIds.length]);

    const handleExecutePlanAndStart = async (
        plan: ScenePlanPage[], characters: Character[], styles: StyleReference[], objects: ObjectAsset[], backgrounds: BackgroundAsset[], sceneType: SceneType
    ) => {
        await onExecutePlan(plan, characters, styles, objects, backgrounds, sceneType);
        
        // Wait for DOM update, then populate queue
        setTimeout(() => {
            setChapter(currentChapter => {
                const pendingPanels = currentChapter.panels
                    .flatMap(p => p.subPanels)
                    .filter(sp => sp.prompt && !sp.imageUrl);
                
                if (pendingPanels.length > 0) {
                    logger.info(`Plan executed. ${pendingPanels.length} panels queued.`);
                    setGenerationQueue(prev => {
                        const newQueue = [...prev];
                        pendingPanels.forEach(p => {
                            if (!newQueue.find(q => q.id === p.id)) newQueue.push(p);
                        });
                        return newQueue;
                    });
                    // Explicitly trigger auto mode here to prevent race conditions
                    setProcessingMode('auto');
                    setDirectorThought("Plan cargado. Iniciando generación...");
                } else {
                    logger.warn("Plan executed but no pending panels found.");
                }
                return currentChapter;
            });
        }, 800); // Increased timeout slightly to ensure DOM readiness
    };

    const handleAnalyzePanel = async (subPanel: SubPanel) => {
        if (!subPanel.imageUrl) return;
        setAnalyzingSubPanelId(subPanel.id);
        setAnalysisResult(null);
        try {
            const result = await assessPanelQuality(subPanel.imageUrl, subPanel.prompt);
            setAnalysisResult(result);
        } catch (error) {
            console.error(error);
            showToast("Error analizando la viñeta.", 'error');
            setAnalyzingSubPanelId(null);
        }
    };

    useEffect(() => {
        const processBatch = async () => {
            const hasQueue = generationQueue.length > 0;
            const isBusy = loadingIds.length > 0;
            const isRepeat = processingMode === 'repeat' && lastProcessedId;
            const isActive = processingMode !== 'idle';

            if (!isActive && !isBusy) {
                if (directorThought !== "" && directorThought !== "✨ Secuencia completada.") {
                     const timeout = setTimeout(() => setDirectorThought(""), 4000);
                     return () => clearTimeout(timeout);
                }
                return;
            }
            
            if (!hasQueue && !isRepeat && !isBusy) {
                 if (processingMode === 'auto') { 
                     setProcessingMode('idle');
                     setDirectorStartTime(null);
                     setCompletedCount(0);
                     setDirectorThought("✨ Secuencia completada.");
                     logger.success("Sequence completed.");
                     showToast("Generación automática completada.", "success");
                 } else if (processingMode !== 'idle') {
                     setProcessingMode('idle');
                 }
                 return;
            }
            
            if (isBusy) return; 
            
            if (!directorStartTime && isActive) setDirectorStartTime(Date.now());

            let itemsToProcess: SubPanel[] = [];

            if (isRepeat) {
                 const sp = chapter.panels.flatMap(p => p.subPanels).find(s => s.id === lastProcessedId);
                 if (sp) itemsToProcess = [sp];
                 setProcessingMode('idle'); 
            } else {
                let batchSize = 1; 
                itemsToProcess = generationQueue.slice(0, batchSize);
                setGenerationQueue(prev => prev.slice(batchSize));
            }

            if (itemsToProcess.length === 0) return;

            if (processingMode === 'auto' && itemsToProcess[0].imageUrl) {
                logger.info(`Skipping existing: ${itemsToProcess[0].id.slice(-4)}`);
                setLastProcessedId(itemsToProcess[0].id);
                setCompletedCount(c => c + 1);
                return;
            }

            const idsToProcess = itemsToProcess.map(i => i.id);
            setLoadingIds(prev => [...prev, ...idsToProcess]);
            
            setDirectorThought(`🎬 Generando (${completedCount + 1}/${generationQueue.length + completedCount + 1}): "${itemsToProcess[0].prompt.substring(0, 15)}..."`);
            
            const safetyTimeout = setTimeout(() => {
                setLoadingIds(prev => prev.filter(id => !idsToProcess.includes(id)));
                logger.error("Generation Timeout triggered.");
                setDirectorThought("⚠️ Tiempo de espera agotado. Saltando...");
            }, 60000); // Increased timeout for slower connections

            itemsToProcess.forEach(async (item) => {
                try {
                    await generateAndSetImage(item);
                    setLastProcessedId(item.id);
                    setCompletedCount(c => c + 1);
                } catch (e: any) {
                    logger.error(`Failed panel ${item.id}`, e);
                    showToast(`Error en viñeta: ${e.message}`, 'error');
                } finally {
                    clearTimeout(safetyTimeout);
                    setLoadingIds(prev => prev.filter(id => id !== item.id));
                    setDirectorThought("Verificando consistencia...");
                }
            });
        };
        
        const timer = setTimeout(processBatch, 200); 
        return () => clearTimeout(timer);
        
    }, [processingMode, generationQueue, loadingIds, project, chapter, lastProcessedId, directorStartTime]);

    const generateAndSetImage = async (item: SubPanel) => {
        logger.info(`Processing Panel: ${item.id}`);
        // Ensure element is measured before proceeding
        const { width, height } = await waitForElementDimensions(elementRefs, item.id);
        
        const charIds = item.characterIds || [];
        const styleIds = item.styleReferenceIds || [];
        const bgIds = item.backgroundIds || [];

        const characters = project.characters.filter(c => charIds.includes(c.id));
        const styles = project.styleReferences.filter(s => styleIds.includes(s.id));
        const backgrounds = project.backgrounds.filter(b => bgIds.includes(b.id));
        const objects = project.objects; 

        const allSubPanels = chapter.panels.flatMap(p => p.subPanels);
        const currentIndex = allSubPanels.findIndex(sp => sp.id === item.id);
        
        const previousPrompts = allSubPanels.slice(Math.max(0, currentIndex - 5), currentIndex).map((sp, idx) => `Panel ${idx}: ${sp.prompt} ${sp.generatedDescription ? `(Visual: ${sp.generatedDescription})` : ''}`).join('\n');

        let continuityImageToUse: string | undefined = undefined;

        if (item.continuitySubPanelId) {
             const explicitRef = allSubPanels.find(sp => sp.id === item.continuitySubPanelId);
             if (explicitRef && explicitRef.imageUrl) continuityImageToUse = explicitRef.imageUrl;
        } else if (currentIndex > 0) {
             const prevPanel = allSubPanels[currentIndex - 1];
             if (prevPanel && prevPanel.imageUrl) continuityImageToUse = prevPanel.imageUrl;
        } else {
             continuityImageToUse = lastGeneratedImageUrlRef.current || undefined;
        }

        // --- MASTER STYLE REFERENCE LOGIC ---
        // Find the FIRST subpanel of the entire chapter that has an image.
        // This acts as the "Source of Truth" for character face/style consistency.
        let masterReferenceImage: string | undefined = undefined;
        const firstPanelWithImage = allSubPanels.find(sp => sp.imageUrl);
        if (firstPanelWithImage && firstPanelWithImage.id !== item.id) {
            masterReferenceImage = firstPanelWithImage.imageUrl!;
            logger.info("Using Master Reference (First Panel) for consistency.");
        }

        // Force Aspect Ratio for Generation based on the *intended* layout
        // Default to 9:16 for proper Manhwa rendering
        const parentPanel = chapter.panels.find(p => p.subPanels.some(sp => sp.id === item.id));
        let overrideAspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | undefined = "9:16";

        if (parentPanel) {
             const signature = JSON.stringify(parentPanel.layout);
             let layoutId = 'custom';
             for (const [key, val] of Object.entries(layoutDefinitions)) {
                if (JSON.stringify(val) === signature) layoutId = key;
             }
             
             if (layoutId === '2h') overrideAspectRatio = '16:9';
             if (layoutId === '1') overrideAspectRatio = '9:16'; // STRICT FORCE FOR VERTICAL PANELS
             
             logger.info(`Layout: ${layoutId}. Forced Ratio: ${overrideAspectRatio}`);
        }

        const imageUrl = await generateSubPanelImage(
            item, 
            width, 
            height, 
            styles, 
            characters, 
            objects, 
            backgrounds, 
            previousPrompts, 
            continuityImageToUse,
            overrideAspectRatio,
            masterReferenceImage // PASS MASTER REF
        );
        
        const compressed = await compressImageBase64(imageUrl);
        lastGeneratedImageUrlRef.current = compressed;
        updateSubPanel(item.id, (sp) => ({...sp, imageUrl: compressed }));
        logger.success(`Image generated for ${item.id.slice(-4)}`);

        assessPanelQuality(compressed, item.prompt).then(async (report) => {
             // Only auto-alert on critical failures to avoid spamming
             if (!report.fixed && report.score < 4) {
                 const issueSummary = report.issues.join(', ');
                 const msg = {
                    text: `[DIRECTOR CRITICAL] Viñeta ID...${item.id.slice(-4)} marcada. Score: ${report.score}/10. Problemas graves: ${issueSummary}.`,
                    image: compressed
                 };
                 window.dispatchEvent(new CustomEvent('agent-message', { detail: msg }));
                 
                 // Disable aggressive auto-fix, just notify
             }
        });
    }

    const elapsedTime = directorStartTime ? Math.floor((Date.now() - directorStartTime) / 1000) : 0;
    const avgTimePerImg = completedCount > 0 ? elapsedTime / completedCount : 0;
    const remainingCount = generationQueue.length;
    const estTimeRemaining = remainingCount * (avgTimePerImg || 5); 
    
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleAddPanel = useCallback((layout: number[][]) => {
        const newPanel: Panel = {
            id: generateId('panel'),
            layout,
            subPanels: Array.from(new Set(layout.flat())).map(val => ({ id: generateId('subpanel'), prompt: '', characterIds: [], imageUrl: null })),
            dialogueBubbles: [],
        };
        setChapter(prev => {
            const panelIndex = prev.panels.findIndex(p => p.id === insertAfterPanelId);
            const newPanels = [...prev.panels];
            if (panelIndex > -1) newPanels.splice(panelIndex + 1, 0, newPanel);
            else newPanels.push(newPanel);
            return { ...prev, panels: newPanels };
        });
        setLayoutPickerOpen(false); setInsertAfterPanelId(null);
    }, [insertAfterPanelId, setChapter]);

    const handleCreateNextPanel = useCallback((layout: number[][], prompt: string, maintainConsistency: boolean, characterIds: string[]) => {
        if (!continuingSubPanel) return;
        
        const newPanel: Panel = {
            id: generateId('panel'),
            layout,
            subPanels: Array.from(new Set(layout.flat())).map(val => ({
                id: generateId('subpanel'),
                prompt: prompt, 
                characterIds: characterIds,
                styleReferenceIds: continuingSubPanel.styleReferenceIds || [],
                backgroundIds: continuingSubPanel.backgroundIds || [],
                imageUrl: null,
                continuitySubPanelId: maintainConsistency ? continuingSubPanel.id : undefined
            })),
            dialogueBubbles: [],
        };

        setChapter(prev => {
            const parentIdx = prev.panels.findIndex(p => p.subPanels.some(sp => sp.id === continuingSubPanel.id));
            const newPanels = [...prev.panels];
            if (parentIdx > -1) newPanels.splice(parentIdx + 1, 0, newPanel); else newPanels.push(newPanel);
            return { ...prev, panels: newPanels };
        });
        setContinuingSubPanel(null);
        
        setTimeout(() => {
             setGenerationQueue(prev => {
                 const allNewSubs = newPanel.subPanels;
                 const uniqueNew = allNewSubs.filter(ns => !prev.find(q => q.id === ns.id));
                 return [...prev, ...uniqueNew];
             });
             resetErrorCount(); 
             setProcessingMode('auto'); 
             setDirectorThought("Continuando escena (Generando)...");
        }, 200);

    }, [continuingSubPanel, setChapter]);

    const handleDeletePanel = useCallback(async (panelId: string) => {
        if (await showConfirmation({ title: "Borrar Panel", message: "¿Seguro?" })) setChapter(prev => ({ ...prev, panels: prev.panels.filter(p => p.id !== panelId) }));
    }, [setChapter]);

    const handleDeleteSubPanel = useCallback((subPanelId: string) => {
        setChapter(prev => ({
            ...prev,
            panels: prev.panels
                .map(p => ({ ...p, subPanels: p.subPanels.filter(sp => sp.id !== subPanelId) }))
                // Drop any panel that lost all its sub-panels so we don't leave empty rows.
                .filter(p => p.subPanels.length > 0),
        }));
    }, [setChapter]);
    
    const movePanel = useCallback((panelId: string, direction: 'up' | 'down') => {
        setChapter(prev => {
            const index = prev.panels.findIndex(p => p.id === panelId);
            if (index === -1) return prev;
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= prev.panels.length) return prev;
            const newPanels = [...prev.panels];
            const [moved] = newPanels.splice(index, 1);
            newPanels.splice(newIndex, 0, moved);
            return { ...prev, panels: newPanels };
        });
    }, [setChapter]);

    const handleAddBubble = useCallback((panelId: string) => updatePanel(panelId, p => ({...p, dialogueBubbles: [...p.dialogueBubbles, { 
        id: generateId('bubble'), 
        text: 'Texto...', 
        x: 50, 
        y: 50, 
        width: 150, 
        height: 100, 
        zIndex: 10,
        bubbleType: 'speech' 
    }]})), [updatePanel]);
    
    const handleUpdateBubble = useCallback((pId: string, bId: string, u: any) => updatePanel(pId, p => ({...p, dialogueBubbles: p.dialogueBubbles.map(b => b.id === bId ? {...b, ...u} : b)})), [updatePanel]);
    const handleDeleteBubble = useCallback((pId: string, bId: string) => updatePanel(pId, p => ({...p, dialogueBubbles: p.dialogueBubbles.filter(b => b.id !== bId)})), [updatePanel]);

    const captureAllPanels = async () => {
        if (!panelContainerRef.current) return [];
        const panelElements = Array.from(panelContainerRef.current.children) as HTMLElement[];
        const canvases = [];
        for (const el of panelElements) {
            if (!el.classList.contains('panel-container')) continue;
            const cvs = await html2canvas(el, { 
                backgroundColor: '#000000', 
                scale: 2, 
                useCORS: true,
                ignoreElements: (e) => e.tagName === 'BUTTON' 
            });
            canvases.push(cvs);
        }
        return canvases;
    };

    const handleExportWebtoon = async () => {
        setIsExporting(true);
        try {
            const canvases = await captureAllPanels();
            if (canvases.length === 0) throw new Error("No hay paneles para exportar.");

            let totalHeight = 0;
            let maxWidth = 0;
            canvases.forEach(c => {
                totalHeight += c.height;
                maxWidth = Math.max(maxWidth, c.width);
            });

            const spacing = 0;
            const finalHeight = totalHeight + (canvases.length * spacing);

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = maxWidth;
            finalCanvas.height = finalHeight;
            const ctx = finalCanvas.getContext('2d');
            if (!ctx) throw new Error("No se pudo crear el contexto de canvas.");

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            let y = 0;
            canvases.forEach(c => {
                const x = (maxWidth - c.width) / 2;
                ctx.drawImage(c, x, y);
                y += c.height + spacing;
            });

            downloadBase64Image(finalCanvas.toDataURL('image/jpeg', 0.90), `${chapter.title}_webtoon.jpg`);
            showToast("¡Tira Webtoon exportada con éxito!", "success");
            setIsExportModalOpen(false);

        } catch (e) {
            console.error(e);
            showToast("Error exportando Webtoon.", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const canvases = await captureAllPanels();
            if (canvases.length === 0) throw new Error("No hay paneles.");

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvases[0].width, canvases[0].height] 
            });

            doc.deletePage(1);

            canvases.forEach((canvas, index) => {
                doc.addPage([canvas.width, canvas.height]);
                const imgData = canvas.toDataURL('image/jpeg', 0.90);
                doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
            });

            doc.save(`${chapter.title}.pdf`);
            showToast("¡PDF exportado con éxito!", "success");
            setIsExportModalOpen(false);
        } catch (e) {
            console.error(e);
            showToast("Error exportando PDF.", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chapter));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${chapter.title}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast("Proyecto guardado en JSON.", "success");
        setIsExportModalOpen(false);
    };


    const getGridArea = (layout: number[][], subPanelId: string) => {
        if (!layout || !Array.isArray(layout) || layout.length === 0) return { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 };
        
        const panelValueStr = subPanelId.split('-').pop();
        if (!panelValueStr) return { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 };
        
        const panelValue = parseInt(panelValueStr, 10);
        let rs=999,re=0,cs=999,ce=0;
        
        layout.forEach((r,ri) => {
            if (!r || !Array.isArray(r)) return;
            r.forEach((c,ci) => { 
                if(c===panelValue) { 
                    rs=Math.min(rs,ri+1); re=Math.max(re,ri+2); cs=Math.min(cs,ci+1); ce=Math.max(ce,ci+2); 
                } 
            });
        });
        if (rs === 999) return { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 };
        return { rowStart: rs, rowEnd: re, colStart: cs, colEnd: ce };
    };

    const canvasWidth = project?.settings?.pageWidth || 800;

    const showDirectorCloud = (generationQueue.length > 0 || loadingIds.length > 0 || processingMode !== 'idle' || !!directorThought);

    return (
        <div className="h-full overflow-y-auto text-white p-4 pt-24 scroll-smooth relative bg-[#09090b]">
             {showDirectorCloud && (
                <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-900/95 backdrop-blur-xl border border-violet-500/50 p-2 rounded-2xl shadow-[0_0_50px_rgba(124,58,237,0.3)] flex items-center gap-2 animate-fade-in-up ring-1 ring-white/10 transition-all duration-300">
                    <DirectorThoughtCloud step={directorThought} isVisible={true} />
                    <div className="flex flex-col px-3 border-r border-white/10 mr-2 min-w-[100px]">
                        <span className={`text-[9px] uppercase tracking-wider font-bold ${processingMode === 'auto' || loadingIds.length > 0 ? 'text-green-400 animate-pulse' : 'text-violet-400'}`}>
                            {processingMode === 'auto' ? '⚫ Director LIVE' : 'Director ON'}
                        </span>
                        <span className="text-xl font-black text-white font-mono tracking-tight">{generationQueue.length} <span className="text-[10px] font-normal text-gray-500">cola</span></span>
                        {directorStartTime && (
                            <div className="flex justify-between text-[8px] font-mono text-gray-400 mt-1">
                                <span>T: {formatTime(elapsedTime)}</span>
                                {remainingCount > 0 && <span className="text-cyan-400">Est: {formatTime(estTimeRemaining)}</span>}
                            </div>
                        )}
                    </div>
                    <button onClick={() => { resetErrorCount(); setProcessingMode('single'); }} disabled={processingMode !== 'idle' || generationQueue.length === 0} className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all w-14 h-14 bg-white/5 group">
                        <DirectorClapperIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                        <span className="text-[8px] font-bold uppercase text-center">Sig. 1</span>
                    </button>
                    <button onClick={() => { resetErrorCount(); setProcessingMode('batch-5'); }} disabled={processingMode !== 'idle' || generationQueue.length === 0} className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all w-14 h-14 bg-white/5">
                        <span className="text-lg leading-none tracking-tighter">▶▶</span>
                        <span className="text-[8px] font-bold uppercase text-center">Sig. 5</span>
                    </button>
                     <button onClick={() => { resetErrorCount(); setProcessingMode('auto'); }} disabled={processingMode === 'auto' || generationQueue.length === 0} className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-all w-14 h-14 ${processingMode === 'auto' ? 'bg-green-600 text-white shadow-lg shadow-green-500/20 transform scale-105' : 'bg-white/5 hover:bg-green-500/10 text-green-400'}`}>
                        <span className="text-lg leading-none">⚡</span>
                        <span className="text-[8px] font-bold uppercase text-center">{processingMode === 'auto' ? 'ON' : 'AUTO'}</span>
                    </button>
                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                     <button onClick={() => { resetErrorCount(); setProcessingMode('repeat'); }} disabled={processingMode !== 'idle' || !lastProcessedId} className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all w-14 h-14 text-blue-400 bg-white/5">
                        <span className="text-lg leading-none">↺</span>
                        <span className="text-[8px] font-bold uppercase text-center">Repetir</span>
                    </button>
                    <button onClick={() => { setProcessingMode('idle'); setLoadingIds([]); setGenerationQueue([]); }} className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all w-12 h-14">
                        <span className="text-lg leading-none">⏹</span>
                    </button>
                </div>
            )}

            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-30 bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl flex items-center gap-2 ring-1 ring-black/50">
                <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all hover:scale-105">
                    <DownloadIcon className="w-3.5 h-3.5" /> Exportar
                </button>
                <div className="w-px h-6 bg-white/10"></div>
                <button onClick={() => setScenePlannerOpen(true)} className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full hover:from-violet-500 hover:to-indigo-500 shadow-lg hover:shadow-violet-500/20 transform hover:-translate-y-0.5 transition-all">
                    <BrainCircuitIcon className="w-3.5 h-3.5" /> Planificador IA
                </button>
                <div className="w-px h-6 bg-white/10"></div>
                <button onClick={() => setLayoutPickerOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all hover:scale-105">
                    <PlusIcon className="w-3.5 h-3.5" /> Nueva Viñeta
                </button>
            </div>

            <div 
                ref={panelContainerRef} 
                className="mx-auto space-y-0 shadow-2xl min-h-[100vh] bg-zinc-950 relative transition-all duration-300"
                style={{ width: `${canvasWidth}px` }}
            >
                <div className="py-16 text-center border-b border-white/5 bg-gradient-to-b from-transparent to-zinc-900/50">
                    <h2 className="text-3xl font-black text-white tracking-tight">{chapter.title}</h2>
                    <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">Scroll Vertical Mode (Nano Pro)</p>
                </div>

                {chapter.panels.map((panel, index) => {
                    // Safety check: Ensure layout is valid array of arrays. Fallback to [[1]] if invalid.
                    const safeLayout = (panel.layout && Array.isArray(panel.layout) && panel.layout.length > 0) 
                        ? panel.layout 
                        : [[1]];
                        
                    const numRows = safeLayout.length;
                    const numCols = safeLayout[0]?.length || 1; // Prevent crash if row is empty
                    
                    // Use calculated height instead of AspectRatio to force DOM expansion
                    const panelHeight = getPanelHeight(safeLayout, canvasWidth);

                    return (
                        <div key={panel.id} className={`panel-container relative group transition-all my-0 bg-black`}>
                            <div 
                                ref={el => { elementRefs.current[panel.id] = el; }}
                                className="grid w-full" 
                                style={{
                                    gridTemplateRows: `repeat(${numRows}, 1fr)`,
                                    gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                                    gap: '0px', 
                                    height: `${panelHeight}px`, // FORCED PIXEL HEIGHT
                                }}
                            >
                                {panel.subPanels.map((subPanel, idx) => {
                                    const { rowStart, rowEnd, colStart, colEnd } = getGridArea(safeLayout, subPanel.id);
                                    let status: 'idle' | 'queued' | 'generating' = 'idle';
                                    if (loadingIds.includes(subPanel.id)) status = 'generating';
                                    else if (generationQueue.some(q => q.id === subPanel.id)) status = 'queued';
                                    const zIndex = idx * 10;

                                    return (
                                        <div 
                                            key={subPanel.id} 
                                            ref={el => { elementRefs.current[subPanel.id] = el; }}
                                            className="relative w-full h-full overflow-hidden"
                                            style={{ 
                                                gridArea: `${rowStart} / ${colStart} / ${rowEnd} / ${colEnd}`,
                                                zIndex: zIndex
                                            }}
                                        >
                                            <SubPanelComponent
                                                subPanel={subPanel}
                                                status={status}
                                                isSelected={selectedSubPanelIds.includes(subPanel.id)}
                                                onSelect={() => setSelectedSubPanelIds([subPanel.id])}
                                                isAgentMode={isAgentMode}
                                                onGenerateClick={() => {
                                                    if (status === 'idle') {
                                                        if (!subPanel.prompt) {
                                                            setEditingSubPanel(subPanel);
                                                        } else {
                                                            setGenerationQueue(prev => [...prev, subPanel]);
                                                            resetErrorCount();
                                                            setProcessingMode('single');
                                                            setDirectorThought("Procesando petición manual...");
                                                        }
                                                    }
                                                }}
                                                onEditClick={() => setEditingSubPanel(subPanel)}
                                                onMagicEditClick={() => setMagicEditSubPanel(subPanel)}
                                                onUploadClick={() => {}}
                                                onDownloadClick={() => subPanel.imageUrl && downloadBase64Image(subPanel.imageUrl, `panel-${subPanel.id}.jpg`)}
                                                onDeleteContent={() => updateSubPanel(subPanel.id, (sp) => ({ ...sp, imageUrl: null, generatedDescription: undefined }))}
                                                onDeletePanel={() => handleDeleteSubPanel(subPanel.id)}
                                                onRegenerate={() => {
                                                    setGenerationQueue(prev => [...prev, subPanel]);
                                                    resetErrorCount();
                                                    setProcessingMode('single');
                                                    setDirectorThought("Regenerando viñeta...");
                                                }}
                                                onAddBubble={() => handleAddBubble(panel.id)}
                                                onAnalyze={() => handleAnalyzePanel(subPanel)}
                                                onCreateCharacter={() => onCreateCharacterFromPanel(subPanel)}
                                                onExtractAsset={() => onExtractAsset(subPanel)}
                                                onContinuePanel={() => setContinuingSubPanel(subPanel)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="absolute right-full top-0 h-full flex flex-col justify-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button onClick={() => movePanel(panel.id, 'up')} className="p-1 bg-zinc-800 text-gray-400 hover:text-white rounded hover:bg-zinc-700"><ArrowUpIcon className="w-3 h-3"/></button>
                                <button onClick={() => movePanel(panel.id, 'down')} className="p-1 bg-zinc-800 text-gray-400 hover:text-white rounded hover:bg-zinc-700"><ArrowDownIcon className="w-3 h-3"/></button>
                                <div className="h-px bg-white/10 my-1"></div>
                                <button onClick={() => handleDeletePanel(panel.id)} className="p-1 bg-red-900/20 text-red-400 hover:text-red-200 rounded hover:bg-red-900/50"><TrashIcon className="w-3 h-3"/></button>
                            </div>
                            <div className="absolute left-1/2 -bottom-3 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all z-20">
                                <button 
                                    onClick={() => { setInsertAfterPanelId(panel.id); setLayoutPickerOpen(true); }} 
                                    className="bg-violet-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform border-2 border-zinc-900"
                                    title="Insert Panel Below"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                            {panel.dialogueBubbles.map(bubble => (
                                <DialogueBubbleComponent
                                    key={bubble.id}
                                    bubble={bubble}
                                    panelBounds={undefined}
                                    onUpdate={(bId, u) => handleUpdateBubble(panel.id, bId, u)}
                                    onDelete={(bId) => handleDeleteBubble(panel.id, bId)}
                                    onBringToFront={() => {}}
                                    onPlayAudio={() => {}}
                                    isPlaying={false}
                                />
                            ))}
                        </div>
                    );
                })}
                <div className="h-64 flex items-center justify-center opacity-20 hover:opacity-50 transition-opacity cursor-pointer border-t border-dashed border-white/10 mt-4" onClick={() => { setInsertAfterPanelId(null); setLayoutPickerOpen(true); }}>
                    <div className="text-center">
                        <PlusIcon className="w-12 h-12 mx-auto mb-2 text-gray-500" />
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">End of Chapter</p>
                        <p className="text-xs text-gray-600">Click to append panel</p>
                    </div>
                </div>
            </div>
            <PanelLayoutPickerModal isOpen={isLayoutPickerOpen} onClose={() => setLayoutPickerOpen(false)} onSelect={handleAddPanel} />
            <ScenePlannerModal isOpen={isScenePlannerOpen} onClose={() => setScenePlannerOpen(false)} onExecutePlan={handleExecutePlanAndStart} />
            {editingSubPanel && <SubPanelEditorModal isOpen={!!editingSubPanel} onClose={() => setEditingSubPanel(null)} subPanel={editingSubPanel} onSave={(sp) => { updateSubPanel(sp.id, () => sp); setEditingSubPanel(null); }} />}
            {continuingSubPanel && <ContinuePanelModal isOpen={!!continuingSubPanel} onClose={() => setContinuingSubPanel(null)} sourceSubPanel={continuingSubPanel} onConfirm={handleCreateNextPanel} />}
            <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExportWebtoon={handleExportWebtoon} onExportPDF={handleExportPDF} onExportJSON={handleExportJSON} isProcessing={isExporting} />
            {magicEditSubPanel && magicEditSubPanel.imageUrl && (
                <MagicEditModal
                    isOpen={!!magicEditSubPanel}
                    onClose={() => setMagicEditSubPanel(null)}
                    subPanelImage={magicEditSubPanel.imageUrl}
                    onSave={(newImg) => updateSubPanel(magicEditSubPanel.id, (sp) => ({...sp, imageUrl: newImg}))}
                />
            )}
            {analyzingSubPanelId && (
                <AnalysisModal 
                    isOpen={!!analyzingSubPanelId} 
                    onClose={() => setAnalyzingSubPanelId(null)} 
                    imageUrl={chapter.panels.flatMap(p => p.subPanels).find(sp => sp.id === analyzingSubPanelId)?.imageUrl || ''}
                    analysis={analysisResult}
                    isAnalyzing={!analysisResult}
                />
            )}
        </div>
    );
};
