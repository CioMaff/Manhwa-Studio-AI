import React, { useMemo } from 'react';
import { Modal } from './Modal';
import type { SubPanel, Panel } from '../types';
import { useProject } from '../contexts/ProjectContext';

interface ContinuityPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: SubPanel[];
  onSelect: (subPanelId: string) => void;
}

export const ContinuityPickerModal: React.FC<ContinuityPickerModalProps> = ({
  isOpen,
  onClose,
  candidates,
  onSelect,
}) => {
  const { project } = useProject();

  const groupedCandidates = useMemo(() => {
    const panelsMap = new Map<string, { panel: Panel; subPanels: SubPanel[] }>();
    
    // Create a map for quick lookup of panel by subpanel ID
    const subPanelToPanelMap = new Map<string, Panel>();
    project.chapters.flatMap(c => c.panels).forEach(p => {
        p.subPanels.forEach(sp => {
            subPanelToPanelMap.set(sp.id, p);
        });
    });

    candidates.forEach(sp => {
        const parentPanel = subPanelToPanelMap.get(sp.id);
        if (parentPanel) {
            if (!panelsMap.has(parentPanel.id)) {
                panelsMap.set(parentPanel.id, { panel: parentPanel, subPanels: [] });
            }
            panelsMap.get(parentPanel.id)!.subPanels.push(sp);
        }
    });

    return Array.from(panelsMap.values());
  }, [candidates, project.chapters]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Panel to Continue From" maxWidth="max-w-5xl">
      <div className="max-h-[70vh] overflow-y-auto p-2">
        {candidates.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No previous panels with images found in this chapter.</p>
        ) : (
          <div className="space-y-6">
            {groupedCandidates.map(({ panel, subPanels }, index) => (
                <div key={panel.id}>
                    <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Page {index + 1}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {subPanels.map((sp) => (
                          <div
                            key={sp.id}
                            onClick={() => onSelect(sp.id)}
                            className="group cursor-pointer bg-gray-900 rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all"
                          >
                            <div className="aspect-w-3 aspect-h-4">
                              <img
                                src={sp.imageUrl!}
                                alt={sp.prompt}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2 bg-gray-800">
                              <p className="text-xs text-gray-300 line-clamp-2">{sp.prompt}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};