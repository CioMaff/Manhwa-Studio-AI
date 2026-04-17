
import React from 'react';
import { Modal } from './Modal';
import { layouts as layoutData } from './layouts';

interface PanelLayoutPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layout: number[][]) => void;
}

const LayoutPreview: React.FC<{ layout: number[][] }> = ({ layout }) => {
    // Safety check: If layout is undefined or empty, render error state
    if (!layout || !Array.isArray(layout) || layout.length === 0) return (
        <div className="p-2 border border-red-500/30 bg-red-900/20 text-red-400 text-[10px] rounded-md h-full flex items-center justify-center">
            Invalid Layout
        </div>
    );

    const numRows = layout.length;
    const numCols = layout[0]?.length || 0;
    const uniquePanels = layout.flat().filter((v, i, a) => a.indexOf(v) === i);

    const getGridArea = (panelId: number): React.CSSProperties => {
        let rowStart = -1, rowEnd = -1, colStart = -1, colEnd = -1;
        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                if (layout[r][c] === panelId) {
                    if (rowStart === -1) rowStart = r + 1;
                    if (colStart === -1 || c < colStart) colStart = c + 1;
                    rowEnd = r + 2;
                    if (c + 2 > colEnd) colEnd = c + 2;
                }
            }
        }
        return { gridArea: `${rowStart} / ${colStart} / ${rowEnd} / ${colEnd}` };
    };

    return (
        <div className="p-2 border border-white/10 rounded-md group-hover:border-violet-500 bg-zinc-800 transition-all h-full flex flex-col pointer-events-none">
            <div style={{ display: 'grid', gridTemplateRows: `repeat(${numRows}, 1fr)`, gridTemplateColumns: `repeat(${numCols}, 1fr)`, gap: '4px', flexGrow: 1, minHeight: '100px' }}>
                {uniquePanels.map(panelId => (
                    <div key={panelId} style={getGridArea(panelId)} className="bg-zinc-600 group-hover:bg-zinc-500 transition-colors rounded-sm flex items-center justify-center text-[10px] text-zinc-400 font-mono">
                        {panelId}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Defined strictly based on keys available in layouts.ts
const layouts = [
    { name: 'Vertical Standard', id: '1' }, // Renamed from Single Panel
    // '1-tall' removed as requested
    { name: 'Ultra Tall (Scroll)', id: '1-ultra-tall' },
    { name: '2 Vertical', id: '2v' },
    { name: '2V Action', id: '2v-action' },
    { name: '2V Reaction', id: '2v-reaction' },
    { name: '2 Horizontal', id: '2h' },
    { name: 'Diagonal Slash', id: 'slash-diag' },
    { name: 'Action Impact', id: 'action-impact' },
    { name: 'Reaction Inset', id: 'reaction-inset' },
    { name: 'Establish Split', id: 'establish-split' },
    { name: 'Complex 5', id: 'complex-5' },
    { name: 'Chaos Grid', id: 'chaos-grid' },
    { name: '3 Vertical', id: '3v' },
];

export const PanelLayoutPickerModal: React.FC<PanelLayoutPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a Panel Layout (Webtoon Standard)" maxWidth="max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
        {layouts.map((layout) => (
          <div key={layout.id} onClick={() => layoutData[layout.id] && onSelect(layoutData[layout.id])} className="flex flex-col h-full cursor-pointer group">
            {layoutData[layout.id] ? (
                <LayoutPreview layout={layoutData[layout.id]} />
            ) : (
                <div className="h-24 bg-red-900/20 border border-red-500/30 rounded flex items-center justify-center text-xs text-red-400">Missing Layout Data</div>
            )}
            <p className="text-center text-[10px] mt-2 text-gray-400 font-medium uppercase tracking-wider group-hover:text-white transition-colors">{layout.name}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
};
