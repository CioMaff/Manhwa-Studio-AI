
import React from 'react';
import type { Project } from '../types';

interface ReaderProps {
    project: Project;
    onBack: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ project, onBack }) => {
    return (
        <div className="h-full bg-black overflow-y-auto scroll-smooth">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 flex justify-between items-center">
                <button onClick={onBack} className="text-gray-300 hover:text-white font-semibold">
                    &larr; Back
                </button>
                <h2 className="text-white font-bold truncate max-w-xs">{project.title}</h2>
                <div className="w-16"></div> {/* Spacer */}
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto bg-black min-h-screen pb-20">
                {project.chapters.map((chapter, cIdx) => (
                    <div key={chapter.id} className="mb-20">
                        <div className="py-10 text-center text-gray-500 text-sm uppercase tracking-widest">
                            Episode {cIdx + 1} - {chapter.title}
                        </div>
                        
                        <div className="flex flex-col items-center">
                            {chapter.panels.length === 0 && (
                                <div className="text-gray-600 py-20">No panels in this chapter yet.</div>
                            )}
                            
                            {chapter.panels.map(panel => (
                                <div key={panel.id} className="w-full flex flex-col items-center gap-0">
                                    {/* Render panel layouts as stitched vertical flow */}
                                    <div className="w-full relative" style={{ maxWidth: '100%' }}>
                                        {/* We render subpanels in their grid configuration but mapped purely visually for the reader */}
                                        {/* Note: A true reader might stitch these images into one long strip. For now we render the grid as is but optimized for viewing */}
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateRows: `repeat(${panel.layout.length}, 1fr)`, 
                                            gridTemplateColumns: `repeat(${panel.layout[0].length}, 1fr)`, 
                                            gap: '4px',
                                            aspectRatio: `${panel.layout[0].length / panel.layout.length}`,
                                            marginBottom: '20px' // Space between panels in webtoon format
                                        }}>
                                            {panel.subPanels.map(sp => {
                                                 const { rowStart, rowEnd, colStart, colEnd } = getGridArea(panel.layout, sp.id);
                                                 return (
                                                    <div key={sp.id} className="relative overflow-hidden bg-gray-900" style={{ gridArea: `${rowStart} / ${colStart} / ${rowEnd} / ${colEnd}` }}>
                                                        {sp.imageUrl ? (
                                                            <img src={sp.imageUrl} alt="panel" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-800 text-xs">Generating...</div>
                                                        )}
                                                        {/* Bubbles overlay would go here if we rendered them separately over the image */}
                                                        {/* For this version, we assume bubbles are part of the editing process or future compositing */}
                                                    </div>
                                                 )
                                            })}
                                        </div>
                                        
                                        {/* Simple overlay for dialogue if needed, though typically baked or positioned absolutely */}
                                        {panel.dialogueBubbles.map(bubble => (
                                            <div 
                                                key={bubble.id}
                                                className="absolute bg-white text-black p-2 rounded-full text-center text-xs font-bold shadow-lg flex items-center justify-center pointer-events-none opacity-90"
                                                style={{
                                                    left: `${bubble.x}px`,
                                                    top: `${bubble.y}px`,
                                                    width: `${bubble.width}px`,
                                                    height: `${bubble.height}px`,
                                                    zIndex: 50
                                                }}
                                            >
                                                {bubble.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                <div className="py-20 text-center text-gray-700">
                    <p>End of available content.</p>
                    <p className="text-xs mt-2">Created with Gemini Manhwa Studio</p>
                </div>
            </div>
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
