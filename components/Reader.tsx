
import React from 'react';
import type { Project } from '../types';

interface ReaderProps {
    project: Project;
    onBack: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ project, onBack }) => {
    return (
        <div className="h-full bg-[#050505] overflow-y-auto scroll-smooth relative">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center transition-all duration-300 hover:bg-black/80">
                <button onClick={onBack} className="text-gray-400 hover:text-white font-medium flex items-center gap-2 transition-colors group">
                    <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <span className="text-sm tracking-wide">Volver al Proyecto</span>
                </button>
                <h2 className="text-gray-200 font-bold truncate max-w-xs tracking-tight text-sm opacity-0 hover:opacity-100 transition-opacity duration-500">{project.title}</h2>
                <div className="w-20"></div> {/* Spacer */}
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto min-h-screen pb-32 px-0 md:px-0"> {/* Removed px-4 to ensure full edge-to-edge on mobile */}
                {project.chapters.map((chapter, cIdx) => (
                    <div key={chapter.id} className="mb-32">
                        {/* HERO TITLE SECTION */}
                        <div className="py-40 flex flex-col items-center justify-center text-center space-y-8 animate-fade-in-up px-4">
                             <div className="flex items-center gap-4">
                                 <div className="h-px w-16 bg-gradient-to-r from-transparent to-purple-500"></div>
                                 <p className="text-purple-400 text-xs font-black uppercase tracking-[0.5em] drop-shadow-lg">EPISODIO {cIdx + 1}</p>
                                 <div className="h-px w-16 bg-gradient-to-l from-transparent to-purple-500"></div>
                             </div>
                             
                             <h3 className="text-white text-7xl md:text-9xl font-serif font-black tracking-tighter leading-none drop-shadow-[0_0_50px_rgba(139,92,246,0.4)] max-w-4xl">
                                 {chapter.title}
                             </h3>
                        </div>
                        
                        <div className="flex flex-col items-center w-full"> 
                            {chapter.panels.length === 0 && (
                                <div className="text-gray-600 py-32 text-sm font-mono flex flex-col items-center gap-2">
                                    <span>No visual content yet.</span>
                                    <span className="text-xs text-gray-700">Go to Studio to create panels.</span>
                                </div>
                            )}
                            
                            {/* Container for the 'Strip' */}
                            <div className="flex flex-col w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                {chapter.panels.map((panel, index) => {
                                    // Fallback if layout is missing or empty
                                    const layout = (panel.layout && Array.isArray(panel.layout) && panel.layout.length > 0) 
                                        ? panel.layout 
                                        : [[1]];
                                        
                                    const numRows = layout.length;
                                    const numCols = layout[0]?.length || 1;

                                    return (
                                        <div key={panel.id} className="w-full relative overflow-hidden bg-[#000000] transform translate-z-0">
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateRows: `repeat(${numRows}, 1fr)`, 
                                                gridTemplateColumns: `repeat(${numCols}, 1fr)`, 
                                                gap: '0px', // ZERO GAP FOR FULL BLEED
                                                aspectRatio: `${numCols / numRows}`,
                                                marginBottom: '0px'
                                            }}>
                                                {panel.subPanels.map(sp => {
                                                     const { rowStart, rowEnd, colStart, colEnd } = getGridArea(layout, sp.id);
                                                     return (
                                                        <div key={sp.id} className="relative overflow-hidden bg-black" style={{ gridArea: `${rowStart} / ${colStart} / ${rowEnd} / ${colEnd}` }}>
                                                            {sp.imageUrl ? (
                                                                <img src={sp.imageUrl} alt="panel" className="w-full h-full object-cover" loading="lazy" />
                                                            ) : null}
                                                        </div>
                                                     )
                                                })}
                                            </div>
                                            
                                            {/* Dialogue Bubbles Layer */}
                                            {panel.dialogueBubbles.map(bubble => (
                                                <div 
                                                    key={bubble.id}
                                                    className={`absolute flex items-center justify-center pointer-events-none z-20`}
                                                    style={{
                                                        left: `${bubble.x}px`,
                                                        top: `${bubble.y}px`,
                                                        width: `${bubble.width}px`,
                                                        height: `${bubble.height}px`,
                                                    }}
                                                >
                                                    {/* Render Bubble Shape SVG based on type */}
                                                     <div className="relative w-full h-full">
                                                         <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full drop-shadow-xl" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
                                                             <path d={getBubblePath(bubble.bubbleType)} fill={bubble.bubbleType === 'box' ? 'black' : 'white'} stroke={bubble.bubbleType === 'box' ? 'white' : 'black'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                                         </svg>
                                                         <div className={`absolute inset-0 flex items-center justify-center p-4 text-center text-sm font-bold leading-snug ${bubble.bubbleType === 'box' ? 'text-white font-sans' : 'text-black'}`} style={{ fontSize: `${Math.max(12, bubble.height / 6)}px` }}>
                                                             {bubble.text}
                                                         </div>
                                                     </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="py-32 text-center opacity-60">
                    <div className="w-12 h-1 mx-auto bg-white/10 rounded-full mb-6"></div>
                    <p className="text-gray-600 text-[10px] font-medium tracking-[0.2em] uppercase">Creado con Nano Banana Pro</p>
                </div>
            </div>
        </div>
    );
};

const getBubblePath = (type: string) => {
    switch(type) {
        case 'shout': return "M 10 10 L 15 0 L 25 10 L 35 0 L 45 15 L 55 5 L 65 15 L 80 0 L 85 20 L 100 25 L 85 40 L 100 50 L 85 60 L 100 75 L 80 70 L 70 85 L 60 75 L 50 90 L 40 75 L 25 85 L 20 70 L 0 75 L 10 55 L 0 40 L 15 30 Z";
        case 'thought': return "M 20 20 Q 10 10 25 5 Q 40 0 55 10 Q 70 0 85 10 Q 95 15 90 30 Q 100 45 90 60 Q 85 75 70 70 Q 55 80 40 70 Q 25 75 15 60 Q 0 50 10 35 Q 0 25 20 20 M 30 85 A 5 5 0 1 1 25 90 M 20 95 A 3 3 0 1 1 18 98";
        case 'box': return "M 0 0 H 100 V 100 H 0 Z";
        default: return "M 10 10 C 0 10 0 30 0 40 V 60 C 0 80 20 90 40 90 H 50 L 45 100 L 65 90 H 80 C 100 90 100 70 100 60 V 40 C 100 10 80 10 50 10 H 10 Z";
    }
};

const getGridArea = (layout: number[][], subPanelId: string) => {
    if (!layout || layout.length === 0) return { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 };
    const panelValueStr = subPanelId.split('-').pop();
    if (!panelValueStr) return { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 };
    const panelValue = parseInt(panelValueStr, 10);
    const numRows = layout.length;
    const numCols = layout[0]?.length || 1;
    let rs=99,re=0,cs=99,ce=0;
    for(let r=0;r<numRows;r++) for(let c=0;c<numCols;c++) if(layout[r][c]===panelValue){ rs=Math.min(rs,r+1); re=Math.max(re,r+2); cs=Math.min(cs,c+1); ce=Math.max(ce,c+2); }
    if(rs>re) return { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 };
    return { rowStart: rs, rowEnd: re, colStart: cs, colEnd: ce };
};
