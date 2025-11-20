import React from 'react';
import { Modal } from './Modal';
import { layouts as layoutData } from './layouts';

interface PanelLayoutPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layout: number[][]) => void;
}

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

const layouts = [
    { name: '1 Panel', id: '1', grid: layoutData['1'] },
    { name: '2 Vertical', id: '2v', grid: layoutData['2v'] },
    { name: '2 Horizontal', id: '2h', grid: layoutData['2h'] },
    { name: '3 Vertical', id: '3v', grid: layoutData['3v'] },
    { name: '3 Horizontal', id: '3h', grid: layoutData['3h'] },
    { name: '4 Grid', id: '4g', grid: layoutData['4g'] },
    { name: 'L-Shape', id: 'l-shape', grid: layoutData['l-shape'] },
    { name: 'Reverse L', id: 'reverse-l', grid: layoutData['reverse-l'] },
    { name: '1 Top, 3 Bottom', id: '1-top-3-bottom', grid: layoutData['1-top-3-bottom']},
    { name: '1 Left, 3 Right', id: '1-left-3-right', grid: layoutData['1-left-3-right']},
    { name: 'Complex 5', id: 'complex-5', grid: layoutData['complex-5']},
];

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