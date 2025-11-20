import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import type { SubPanel } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { ContinuityPickerModal } from './ContinuityPickerModal';

const shotTypes = ["", "Establishing Shot", "Full Shot", "American Shot", "Medium Shot", "Close-up", "Extreme Close-up"];
const cameraAngles = ["", "Normal Angle", "High Angle", "Low Angle", "Dutch Angle", "Bird's Eye View", "Worm's Eye View"];
const generationModes = [{id: 'page', name: 'Page Mode (Fast)'}, {id: 'sequential', name: 'Sequential Mode (Consistent)'}];

export const SubPanelEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    subPanel: SubPanel;
    onSave: (subPanel: SubPanel) => void;
}> = ({ isOpen, onClose, subPanel, onSave }) => {
    const { project } = useProject();
    const [editedSubPanel, setEditedSubPanel] = useState(subPanel);
    const [isContinuityPickerOpen, setContinuityPickerOpen] = useState(false);

    useEffect(() => {
        setEditedSubPanel(prev => ({...subPanel, generationMode: subPanel.generationMode || 'page'}));
    }, [subPanel, isOpen]);

    const handleSave = () => {
        onSave(editedSubPanel);
    };

    const toggleSelection = (id: string, field: 'characterIds' | 'styleReferenceIds') => {
        setEditedSubPanel(prev => {
            const currentIds = prev[field] || [];
            const newIds = currentIds.includes(id) ? currentIds.filter(i => i !== id) : [...currentIds, id];
            return { ...prev, [field]: newIds };
        });
    };
    
    const continuityCandidates = useMemo(() => {
        return project.chapters
            .flatMap(c => c.panels)
            .flatMap(p => p.subPanels)
            .filter(sp => sp.imageUrl && sp.id !== subPanel.id);
    }, [project.chapters, subPanel.id]);


    const selectedContinuityPanel = useMemo(() => {
        if (!editedSubPanel.continuitySubPanelId) return null;
        return project.chapters
            .flatMap(c => c.panels)
            .flatMap(p => p.subPanels)
            .find(sp => sp.id === editedSubPanel.continuitySubPanelId);
    }, [project.chapters, editedSubPanel.continuitySubPanelId]);

    const handleSelectContinuity = (selectedId: string) => {
        setEditedSubPanel(p => ({ ...p, continuitySubPanelId: selectedId }));
        setContinuityPickerOpen(false);
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Edit Sub-Panel">
                <div className="space-y-4">
                     <textarea
                        placeholder="Describe what should happen in this panel..."
                        value={editedSubPanel.prompt}
                        onChange={e => setEditedSubPanel(prev => ({...prev, prompt: e.target.value}))}
                        className="w-full p-2 bg-gray-700 rounded-md"
                        rows={4}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold mb-2 block">Shot Type</label>
                            <select value={editedSubPanel.shotType || ''} onChange={(e) => setEditedSubPanel(p => ({...p, shotType: e.target.value}))} className="w-full p-2 bg-gray-700 rounded-md text-sm">
                               {shotTypes.map(s => <option key={s} value={s}>{s || 'Default'}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-2 block">Camera Angle</label>
                            <select value={editedSubPanel.cameraAngle || ''} onChange={(e) => setEditedSubPanel(p => ({...p, cameraAngle: e.target.value}))} className="w-full p-2 bg-gray-700 rounded-md text-sm">
                                {cameraAngles.map(a => <option key={a} value={a}>{a || 'Default'}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold mb-2 block">Generation Mode</label>
                         <div className="flex items-center gap-2 rounded-lg bg-gray-900/50 p-1">
                            {generationModes.map(mode => (
                                <button key={mode.id} onClick={() => setEditedSubPanel(p => ({...p, generationMode: mode.id as 'page' | 'sequential'}))} className={`w-full text-center py-2 rounded-md transition-colors text-sm ${editedSubPanel.generationMode === mode.id ? 'bg-purple-600 text-white' : 'hover:bg-gray-700'}`}>
                                    {mode.name}
                                </button>
                            ))}
                        </div>
                    </div>

                     {project.characters.length > 0 && <div><p className="text-sm font-semibold mb-2">Characters:</p><div className="flex flex-wrap gap-2">{project.characters.map(char => (<button key={char.id} onClick={() => toggleSelection(char.id, 'characterIds')} className={`px-3 py-1 text-sm rounded-full ${editedSubPanel.characterIds?.includes(char.id) ? 'bg-purple-600' : 'bg-gray-600'}`}>{char.name}</button>))}</div></div>}
                     {project.styleReferences.length > 0 && <div><p className="text-sm font-semibold mb-2">Style References:</p><div className="flex flex-wrap gap-2">{project.styleReferences.map(style => (<button key={style.id} onClick={() => toggleSelection(style.id, 'styleReferenceIds')} className={`px-3 py-1 text-sm rounded-full ${editedSubPanel.styleReferenceIds?.includes(style.id) ? 'bg-purple-600' : 'bg-gray-600'}`}>{style.name}</button>))}</div></div>}
                     
                     <div>
                        <p className="text-sm font-semibold mb-2">Continuity</p>
                        <div className="flex gap-2">
                            <button onClick={() => setContinuityPickerOpen(true)} className="flex-grow bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md">
                                {selectedContinuityPanel ? 'Change Reference...' : 'Continue Scene From...'}
                            </button>
                            {selectedContinuityPanel && (
                                <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-md">
                                    <img src={selectedContinuityPanel.imageUrl!} className="w-10 h-10 object-cover rounded"/>
                                    <span className="text-xs max-w-xs truncate">Ref: {selectedContinuityPanel.prompt}</span>
                                    <button onClick={() => setEditedSubPanel(p => ({...p, continuitySubPanelId: null}))} className="text-red-400 text-lg">&times;</button>
                                </div>
                            )}
                        </div>
                     </div>

                    <button onClick={handleSave} className="w-full bg-purple-600 text-white font-bold py-2 rounded-md mt-4">
                        {subPanel.imageUrl ? 'Save & Regenerate' : 'Generate Image'}
                    </button>
                </div>
            </Modal>
            {isContinuityPickerOpen && (
                <ContinuityPickerModal
                    isOpen={isContinuityPickerOpen}
                    onClose={() => setContinuityPickerOpen(false)}
                    candidates={continuityCandidates}
                    onSelect={handleSelectContinuity}
                />
            )}
        </>
    );
};