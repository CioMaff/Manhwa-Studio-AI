
import React, { useState, useMemo, useRef } from 'react';
import { Modal } from './Modal';
import { Loader } from './Loader';
import { useProject } from '../contexts/ProjectContext';
import { planScene } from '../services/geminiService';
import type { ScenePlanPage, Character, StyleReference, ObjectAsset, SceneType, BackgroundAsset } from '../types';
import { showToast } from '../systems/uiSystem';
import { layouts } from './layouts';
import { fileToBase64, textFileToString } from '../utils/fileUtils';
import { UploadIcon } from './icons/UploadIcon';

interface ScenePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePlan: (plan: ScenePlanPage[], characters: Character[], styles: StyleReference[], objects: ObjectAsset[], backgrounds: BackgroundAsset[], sceneType: SceneType) => Promise<void>;
}

const sceneTypes: { id: SceneType; name: string }[] = [
    { id: '', name: 'Automático (IA Decide)' },
    { id: 'dialogue', name: 'Diálogo / Tensión' },
    { id: 'action', name: 'Acción / Combate' },
    { id: 'emotional', name: 'Emocional / Drama' },
    { id: 'establishment', name: 'Establecimiento / Paisaje' },
];

const LayoutPreview: React.FC<{ layoutId: string }> = ({ layoutId }) => {
    // Robust Fallback: If layoutId doesn't exist in layouts, default to '1-tall' or similar
    // This prevents errors if Gemini invents a layout name.
    const grid = layouts[layoutId] || layouts['1-tall'] || [[1]];
    
    if (!grid) return <div className="w-full h-full bg-zinc-800 rounded flex items-center justify-center text-[10px] text-gray-500 font-mono">?</div>;
    
    const rows = grid.length;
    const cols = grid[0].length;
    
    // MATHEMATICAL ASPECT RATIO FOR PREVIEW
    // 16:9 = 1.777 (Tall) -> css aspectRatio: 9/16 = 0.5625
    let ratioValue = 3/4; // Default Portrait
    
    if (layoutId === '1-tall' || layoutId === '1-ultra-tall') ratioValue = 9/16;
    if (layoutId === '2v' || layoutId === '2v-action' || layoutId === '2v-reaction' || layoutId === 'complex-5') ratioValue = 9/32;
    if (layoutId === '3v') ratioValue = 9/48; 
    if (layoutId === 'slash-diag') ratioValue = 9/16;
    if (layoutId === '2h') ratioValue = 16/9;

    return (
        <div 
            className="w-full bg-black border border-white/20 rounded-sm p-0.5 grid gap-0.5 shadow-md transition-all" 
            style={{ 
                aspectRatio: `${ratioValue}`,
                gridTemplateRows: `repeat(${rows}, 1fr)`, 
                gridTemplateColumns: `repeat(${cols}, 1fr)` 
            }}
        >
            {Array.from(new Set(grid.flat())).map(id => (
                <div key={id} className="bg-violet-900/50 border border-violet-500/30 rounded-[1px] flex items-center justify-center" style={{ gridArea: (() => {
                     let rs=99,re=0,cs=99,ce=0;
                     grid.forEach((r, ri) => r.forEach((c, ci) => { if(c===id){ rs=Math.min(rs, ri+1); re=Math.max(re, ri+2); cs=Math.min(cs, ci+1); ce=Math.max(ce, ci+2); }}));
                     return `${rs}/${cs}/${re}/${ce}`;
                })()}}>
                    <span className="text-[8px] text-violet-300/50">{id}</span>
                </div>
            ))}
        </div>
    )
}

export const ScenePlannerModal: React.FC<ScenePlannerModalProps> = ({ isOpen, onClose, onExecutePlan }) => {
  const { project } = useProject();
  const [mode, setMode] = useState<'manual' | 'file'>('manual');
  const [sceneDescription, setSceneDescription] = useState('');
  const [sceneType, setSceneType] = useState<SceneType>('');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<ScenePlanPage[] | null>(null);
  
  const [storyFileContent, setStoryFileContent] = useState<string | null>(null);
  const [storyFileMimeType, setStoryFileMimeType] = useState<string | null>(null);
  const [storyFileName, setStoryFileName] = useState<string | null>(null);
  const [panelCount, setPanelCount] = useState<number>(6);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.txt')) {
                  const content = await textFileToString(file);
                  setStoryFileContent(content);
                  setStoryFileMimeType('text/plain');
              } else {
                  const base64Full = await fileToBase64(file);
                  const base64Data = base64Full.split(',')[1];
                  setStoryFileContent(base64Data);
                  
                  let mime = file.type;
                  if (!mime || mime === '') {
                      if (file.name.toLowerCase().endsWith('.mp3')) mime = 'audio/mp3';
                      else if (file.name.toLowerCase().endsWith('.wav')) mime = 'audio/wav';
                      else if (file.name.toLowerCase().endsWith('.pdf')) mime = 'application/pdf';
                  }
                  setStoryFileMimeType(mime || 'application/octet-stream');
              }
              
              setStoryFileName(file.name);
              setMode('file');
              showToast(`Archivo cargado: ${file.name}`, 'success');
          } catch (err) {
              console.error(err);
              showToast("Error leyendo el archivo.", 'error');
          }
      }
  };

  const handlePlanScene = async () => {
    if (mode === 'manual' && !sceneDescription.trim()) {
      showToast('Describe la escena primero.', 'error');
      return;
    }
    if (mode === 'file' && !storyFileContent) {
        showToast('Sube un archivo primero.', 'error');
        return;
    }

    setIsLoading(true);
    try {
      const selectedCharacters = project.characters.filter(c => selectedCharIds.includes(c.id));
      
      const storyContext = mode === 'file' && storyFileContent ? {
          content: storyFileContent,
          mimeType: storyFileMimeType || 'text/plain'
      } : undefined;

      const generatedPlan = await planScene(
          mode === 'manual' ? sceneDescription : '', 
          selectedCharacters, 
          project.objects,
          project.styleReferences, 
          sceneType, 
          Object.keys(layouts), 
          'waterfall', 
          panelCount,
          storyContext
      );
      setPlan(generatedPlan);
    } catch (error: any) {
      console.error(error);
      showToast('Error planificando escena.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExecutePlan = () => {
      if (!plan) return;
      const selectedCharacters = project.characters.filter(c => selectedCharIds.includes(c.id));
      onExecutePlan(plan, selectedCharacters, project.styleReferences, project.objects, project.backgrounds, sceneType);
      onClose();
  }
  
  const toggleSelection = (id: string, state: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Planificador Webtoon IA (Nano Pro)" maxWidth="max-w-6xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto p-2 custom-scrollbar">
        {isLoading && <Loader message={plan ? "Ejecutando plan..." : "Nano Banana Pro analizando guión y estructura vertical..."} />}
        
        {!plan && (
            <>
                <div className="bg-zinc-900/80 border border-violet-500/20 p-6 rounded-xl mb-6 shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-900/20 to-transparent pointer-events-none" />
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-lg">💎</div>
                        <h3 className="text-white font-bold text-lg">Modo Webtoon Premium</h3>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed relative z-10 max-w-2xl">
                        El motor Gemini 3.0 analizará tu idea o guión para generar un <strong>Storyboard Vertical</strong> optimizado. Detecta automáticamente el ritmo, los cortes dramáticos y sugiere encuadres profesionales.
                    </p>
                </div>

                <div className="flex gap-1 bg-black/40 p-1 rounded-xl mb-6 w-fit border border-white/5">
                    <button 
                        onClick={() => setMode('manual')} 
                        className={`text-xs font-bold px-5 py-2 rounded-lg transition-all ${mode === 'manual' ? 'bg-zinc-700 text-white shadow-md ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Descripción Manual
                    </button>
                    <button 
                        onClick={() => setMode('file')} 
                        className={`text-xs font-bold px-5 py-2 rounded-lg transition-all ${mode === 'file' ? 'bg-zinc-700 text-white shadow-md ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Subir Guión (PDF/Audio)
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {mode === 'manual' ? (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider ml-1">Idea de la Escena</label>
                                <textarea
                                    placeholder="Ej: Jinwoo entra en la mazmorra, está oscuro. De repente, ojos azules brillan en la oscuridad. Él saca su daga."
                                    value={sceneDescription}
                                    onChange={e => setSceneDescription(e.target.value)}
                                    className="w-full p-4 bg-black/40 rounded-xl border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none text-sm min-h-[200px] text-gray-200 placeholder-gray-600 shadow-inner resize-none"
                                />
                            </div>
                        ) : (
                            <div className="bg-black/40 border border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-all group cursor-pointer h-[200px]" onClick={() => fileInputRef.current?.click()}>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.md,.json,.pdf,.mp3,.wav" />
                                <div className="p-4 bg-white/5 rounded-full text-gray-400 group-hover:text-violet-400 transition-colors group-hover:scale-110 transform duration-300">
                                    <UploadIcon className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                    {storyFileName ? (
                                        <p className="text-green-400 font-bold flex items-center gap-2 justify-center bg-green-900/20 px-3 py-1 rounded-full">
                                            <span>📄</span> {storyFileName}
                                        </p>
                                    ) : (
                                        <div>
                                            <p className="text-gray-300 font-medium">Arrastra o selecciona archivo</p>
                                            <p className="text-xs text-gray-500 mt-1">Soporta PDF, MP3, WAV, TXT</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 bg-white/5 p-5 rounded-xl border border-white/5 h-fit">
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">Personajes Presentes</label>
                             <div className="flex flex-wrap gap-2">
                                {project.characters.map(c => (
                                    <button key={c.id} onClick={() => toggleSelection(c.id, selectedCharIds, setSelectedCharIds)} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${selectedCharIds.includes(c.id) ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/20' : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                                        <img src={c.referenceImage} className="w-4 h-4 rounded-full object-cover ring-1 ring-white/10"/>
                                        {c.name}
                                    </button>
                                ))}
                                {project.characters.length === 0 && <p className="text-gray-600 text-xs italic">No hay personajes creados.</p>}
                             </div>
                         </div>

                         <div className="h-px bg-white/5 w-full"></div>

                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Densidad ({panelCount} Viñetas)</label>
                             <input type="range" min="1" max="30" value={panelCount} onChange={(e) => setPanelCount(parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                             <div className="flex justify-between text-[9px] text-gray-600 mt-1 font-mono">
                                 <span>CORTA</span>
                                 <span>EPISODIO COMPLETO</span>
                             </div>
                         </div>

                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Ritmo / Tono</label>
                             <div className="relative">
                                 <select value={sceneType} onChange={(e) => setSceneType(e.target.value as SceneType)} className="w-full p-2.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:border-violet-500 outline-none appearance-none">
                                     {sceneTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                 </select>
                                 <div className="absolute right-3 top-3 pointer-events-none text-gray-500 text-[10px]">▼</div>
                             </div>
                         </div>
                         
                         <button onClick={handlePlanScene} disabled={isLoading} className="w-full bg-white text-black hover:bg-gray-200 font-bold py-3 rounded-lg mt-4 shadow-lg transform hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                            <span className="text-lg">✨</span> Planificar Tira
                        </button>
                    </div>
                </div>
            </>
        )}
        
        {plan && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b border-white/10 pb-4 sticky top-0 bg-[#18181b]/95 backdrop-blur-md z-20 pt-2">
                    <div>
                        <h3 className="text-lg font-bold text-white">Layout Vertical Generado</h3>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {plan.length} Bloques Listos para Generar
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setPlan(null)} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Volver</button>
                        <button onClick={handleExecutePlan} className="px-6 py-2 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-500 shadow-lg shadow-violet-900/20 transform hover:scale-105 transition-all flex items-center gap-2">
                            <span>🚀</span> Generar Todo
                        </button>
                    </div>
                </div>
                
                <div className="grid gap-4 pb-10">
                {plan.map((page, i) => (
                    <div key={i} className="flex gap-4 bg-black/20 p-4 rounded-xl border border-white/5 hover:border-violet-500/30 transition-all group relative items-start">
                         <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500/20 group-hover:bg-violet-500 transition-colors rounded-l-xl"></div>
                         
                         <div className="flex-shrink-0 flex flex-col items-center gap-3 w-28 pt-2 border-r border-white/5 pr-4">
                             <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">BLOQUE {page.page_number}</span>
                             {/* The Preview Component is critical here */}
                             <div className="w-20">
                                <LayoutPreview layoutId={page.layout} />
                             </div>
                             <span className="text-[9px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 truncate w-full text-center">{page.layout}</span>
                         </div>
                         
                         <div className="flex-grow grid gap-3">
                            {page.sub_panels.map((panel, idx) => (
                                <div key={idx} className="bg-zinc-900/50 p-3 rounded-lg border border-white/5 flex gap-4 items-start">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap gap-2 mb-2 opacity-70">
                                            <span className="text-[9px] font-bold text-black bg-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">{panel.shot_type}</span>
                                            <span className="text-[9px] font-bold text-white border border-white/20 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">{panel.camera_angle}</span>
                                        </div>
                                        <p className="text-xs text-gray-300 leading-relaxed font-medium">"{panel.action_description}"</p>
                                    </div>
                                    <div className="w-1/3 border-l border-white/5 pl-4 hidden sm:block">
                                         <p className="text-[10px] text-gray-500 italic leading-tight">
                                            <span className="text-violet-400 font-bold block mb-1 not-italic">Director's Note:</span>
                                            {panel.justification}
                                         </p>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                ))}
                </div>
            </div>
        )}
      </div>
    </Modal>
  );
};
