import React from 'react';
import { Modal } from './Modal';

interface PanelLayoutPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layout: number[][]) => void;
}

const layouts = [
  { name: '1 Panel', grid: [[1]] },
  { name: '2 Panels (Vertical)', grid: [[1], [2]] },
  { name: '2 Panels (Horizontal)', grid: [[1, 2]] },
  { name: '3 Panels (Vertical)', grid: [[1], [2], [3]] },
  { name: '3 Panels (Stacked)', grid: [[1], [2, 3]] },
  { name: '3 Panels (Featured)', grid: [[1, 1], [2, 3]] },
  { name: '4 Panels (Grid)', grid: [[1, 2], [3, 4]] },
  { name: '4 Panels (Featured)', grid: [[1, 1], [2, 3], [2, 4]] },
  { name: '5 Panels (Complex)', grid: [[1, 1, 2], [3, 4, 2], [5, 5, 5]] },
];

const LayoutPreview: React.FC<{ layout: number[][], onClick: () => void }> = ({ layout, onClick }) => {
    const numRows = layout.length;
    const numCols = layout[0].length;
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
        <div onClick={onClick} className="p-2 border-2 border-gray-700 rounded-md hover:border-purple-500 bg-gray-800 cursor-pointer transition-colors">
            <div style={{ display: 'grid', gridTemplateRows: `repeat(${numRows}, 1fr)`, gridTemplateColumns: `repeat(${numCols}, 1fr)`, gap: '4px', height: '100px'}}>
                {uniquePanels.map(panelId => (
                    <div key={panelId} style={getGridArea(panelId)} className="bg-gray-600 rounded-sm"></div>
                ))}
            </div>
        </div>
    );
};


export const PanelLayoutPickerModal: React.FC<PanelLayoutPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a Panel Layout" maxWidth="max-w-4xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto p-1">
        {layouts.map((layout) => (
          <div key={layout.name} onClick={() => onSelect(layout.grid)}>
            <LayoutPreview layout={layout.grid} onClick={() => onSelect(layout.grid)} />
            <p className="text-center text-xs mt-1 text-gray-400">{layout.name}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
};
