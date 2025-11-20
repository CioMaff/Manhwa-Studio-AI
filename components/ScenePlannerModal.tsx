import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { Loader } from './Loader';
import { useProject } from '../contexts/ProjectContext';
import { planScene, analyzeStoryAndPlan } from '../services/geminiService';
import type { ScenePlanPage, Character, StyleReference, ObjectAsset, SceneType, BackgroundAsset } from '../types';
import { showToast } from '../systems/uiSystem';
import { layouts } from './layouts';
import { fileToBase64 } from '../utils/fileUtils';

interface ScenePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePlan: (plan: ScenePlanPage[], characters: Character[], styles: StyleReference[], objects: ObjectAsset[], backgrounds: BackgroundAsset[], sceneType: SceneType) => Promise<void>;
}

const sceneTypes: { id: SceneType; name: string }[] = [
    { id: '', name: 'Default' },
    { id: 'dialogue', name: 'Dialogue' },
    { id: 'action', name: 'Action / Combat' },
    { id: 'emotional', name: 'Emotional / Dramatic' },
    { id: 'establishment', name: 'Establishment' },
];

const allLayoutKeys = Object.keys(layouts);

export const ScenePlannerModal: React.FC<ScenePlannerModalProps> = ({ isOpen, onClose, onExecutePlan }) => {
  const { project } = useProject();
  const [mode, setMode] = useState<'manual' | 'full_story'>('manual');
  
  // Manual Mode State
  const [sceneDescription, setSceneDescription] = useState('');
  const [sceneType, setSceneType] = useState<SceneType>('');
  
  // Full Story Mode State
  const [storyFiles, setStoryFiles] = useState<{ name: string, type: string, data: string }[]>([]);
  
  // Shared State
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [selectedBackgroundIds, setSelectedBackgroundIds] = useState<string[]>([]);
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [flowStyle, setFlowStyle] = useState<'grid' | 'waterfall'>('grid');
  const [panelCount, setPanelCount] = useState(5);
  const [allowedLayouts, setAllowedLayouts] = useState<string[]>(() => allLayoutKeys);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<ScenePlanPage[] | null>(null);
  
  const totalPanelsInPlan = useMemo(() => {
    if (!plan) return 0;
    return plan.reduce((acc, page) => acc + page.sub_panels.length, 0);
  }, [plan]);

  const handlePlanScene = async () => {
    if (mode === 'manual' && !sceneDescription.trim()) {
      showToast('Please provide a scene description.', 'error');
      return;
    }
    if (mode === 'full_story' && storyFiles.length === 0) {
        showToast('Please upload at least one story file.', 'error');
        return;
    }

    setIsLoading(true);
    setPlan(null);
    try {
      const selectedCharacters = project.characters.filter(c => selectedCharIds.includes(c.id));
      const selectedObjects = project.objects.filter(o => selectedObjectIds.includes(o.id));
      const selectedStyles = project.styleReferences.filter(s => selectedStyleIds.includes(s.id));

      let generatedPlan;
      
      if (mode === 'manual') {
          generatedPlan = await planScene(sceneDescription, selectedCharacters, selectedObjects, selectedStyles, sceneType, allowedLayouts, flowStyle, flowStyle === 'waterfall' ? panelCount : undefined);
      } else {
          // Map files to the format expected by the service
          const assets = storyFiles.map(f => ({ mimeType: f.type, data: f.data.split(',')[1] }));
          generatedPlan = await analyzeStoryAndPlan(assets, selectedCharacters, flowStyle);
      }
      
      setPlan(generatedPlan);
    } catch (error: any) {
      console.error('Failed to plan scene:', error);
      showToast(error.message || 'Failed to generate a plan.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExecutePlan = () => {
      if (!plan) return;
      const selectedCharacters = project.characters.filter(c => selectedCharIds.includes(c.id));
      const selectedObjects = project.objects.filter(o => selectedObjectIds.includes(o.id));
      const selectedStyles = project.styleReferences.filter(s => selectedStyleIds.includes(s.id));
      const selectedBackgrounds = project.backgrounds.filter(b => selectedBackgroundIds.includes(b.id));
      onExecutePlan(plan, selectedCharacters, selectedStyles, selectedObjects, selectedBackgrounds, sceneType);
      handleClose();
  }
  
  const handleClose = () => {
      setPlan(null);
      setStoryFiles([]);
      onClose();
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const files = Array.from(e.target.files);
          for (const file of files) {
              const base64 = await fileToBase64(file);
              setStoryFiles(prev => [...prev, { name: file.name, type: file.type, data: base64 }]);
          }
          e.target.value = '';
      }
  }

  const toggleSelection = (id: string, state: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Story Planner" maxWidth="max-w-5xl">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
        {isLoading && <Loader message={plan ? "Executing plan..." : "Nano is reading your story and planning..."} />}
        
        {!plan && (
            <>
                <div className="flex gap-4 border-b border-gray-700 pb-2 mb-4">
                    <button onClick={() => setMode('manual')} className={`pb-2 px-2 ${mode === 'manual' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}>Manual Description</button>
                    <button onClick={() => setMode('full_story')} className={`pb-2 px-2 ${mode === 'full_story' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}>Full Story Upload</button>
                </div>

                {mode === 'manual' ? (
                    <textarea
                        placeholder="Describe la escena que quieres crear..."
                        value={sceneDescription}
                        onChange={e => setSceneDescription(e.target.value)}
                        className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
                        rows={3}
                    />
                ) : (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                        <input type="file" multiple accept=".txt,.pdf,.doc,.docx,audio/*,image/*" onChange={handleFileUpload} className="hidden" id="story-upload" />
                        <label htmlFor="story-upload" className="cursor-pointer block">
                            <div className="text-purple-300 font-semibold mb-2">Upload Story Assets</div>
                            <div className="text-xs text-gray-400">Supports Text, PDF, Images (Storyboards), and Audio (Voice Notes)</div>
                        </label>
                        {storyFiles.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                {storyFiles.map((f, i) => (
                                    <div key={i} className="bg-gray-800 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                                        {f.name}
                                        <button onClick={() => setStoryFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400">&times;</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Active Characters (Auto-Consistency)</label>
                         <div className="flex flex-wrap gap-2 p-2 bg-gray-700/50 rounded-md max-h-24 overflow-y-auto">
                            {project.characters.map(c => (
                                <button key={c.id} onClick={() => toggleSelection(c.id, selectedCharIds, setSelectedCharIds)} className={`px-3 py-1 text-sm rounded-full ${selectedCharIds.includes(c.id) ? 'bg-purple-600' : 'bg-gray-600'}`}>
                                    {c.name}
                                </button>
                            ))}
                         </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Style Reference (Global)</label>
                         <div className="flex flex-wrap gap-2 p-2 bg-gray-700/50 rounded-md max-h-24 overflow-y-auto">
                            {project.styleReferences.map(s => (
                                <button key={s.id} onClick={() => toggleSelection(s.id, selectedStyleIds, setSelectedStyleIds)} className={`px-3 py-1 text-sm rounded-full ${selectedStyleIds.includes(s.id) ? 'bg-purple-600' : 'bg-gray-600'}`}>
                                    {s.name}
                                </button>
                            ))}
                         </div>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Scene Flow Style</label>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-900/50 p-1">
                        <button onClick={() => setFlowStyle('grid')} className={`w-full text-center py-2 rounded-md transition-colors ${flowStyle === 'grid' ? 'bg-purple-600 text-white' : 'hover:bg-gray-700'}`}>Grid Layouts</button>
                        <button onClick={() => setFlowStyle('waterfall')} className={`w-full text-center py-2 rounded-md transition-colors ${flowStyle === 'waterfall' ? 'bg-purple-600 text-white' : 'hover:bg-gray-700'}`}>Vertical Flow (Webtoon)</button>
                    </div>
                </div>

                 <button onClick={handlePlanScene} disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-md mt-6 disabled:opacity-50">
                    {mode === 'manual' ? 'Plan Scene' : 'Analyze Story & Auto-Plan'}
                </button>
            </>
        )}
        
        {plan && (
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-200">Scene Plan ({totalPanelsInPlan} Panels)</h3>
                <div className="space-y-4 bg-gray-900/50 p-3 rounded-lg max-h-[50vh] overflow-y-auto">
                {plan.map(page => (
                    <div key={page.page_number} className="border border-gray-700 rounded-lg p-3">
                         <p className="font-bold text-cyan-300">Page {page.page_number} (Layout: {page.layout})</p>
                         <div className="mt-2 space-y-3 pl-4 border-l-2 border-cyan-500/30">
                            {page.sub_panels.map((item, index) => (
                                <div key={index}>
                                    <p className="font-bold text-purple-300">Panel {index + 1}: {item.shot_type}</p>
                                    <p className="text-sm text-gray-300 mt-1 font-mono text-xs bg-gray-800 p-2 rounded">"{item.action_description}"</p>
                                </div>
                            ))}
                         </div>
                    </div>
                ))}
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button onClick={() => setPlan(null)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Modify</button>
                    <button onClick={handleExecutePlan} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">Generate All Panels</button>
                </div>
            </div>
        )}
      </div>
    </Modal>
  );
};