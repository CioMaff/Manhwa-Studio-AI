
import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import type { DialogueBubble, BubbleType } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { useProject } from '../contexts/ProjectContext';

// Iconos simples para el menú
const EditIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;

export const DialogueBubbleComponent: React.FC<{
    bubble: DialogueBubble;
    panelBounds: DOMRect | undefined;
    onUpdate: (id: string, updates: Partial<DialogueBubble>) => void;
    onDelete: (id: string) => void;
    onBringToFront: (id: string) => void;
    onPlayAudio: (text: string) => void;
    isPlaying: boolean;
}> = ({ bubble, panelBounds, onUpdate, onDelete, onBringToFront, onPlayAudio, isPlaying }) => {
    const { project } = useProject();
    const [isEditing, setIsEditing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);
    const bubbleRef = useRef<any>(null);

    useEffect(() => {
        if (isEditing && textRef.current) {
            textRef.current.focus();
        }
    }, [isEditing]);

    const handleTextBlur = () => {
        if (textRef.current) {
            onUpdate(bubble.id, { text: textRef.current.innerText });
        }
        setIsEditing(false);
    };

    const handleTypeChange = (newType: BubbleType) => {
        onUpdate(bubble.id, { bubbleType: newType });
        setShowMenu(false);
    };

    const getBubbleStyle = (type: BubbleType) => {
        switch(type) {
            case 'shout':
                return {
                    filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.5))',
                    path: "M 10 10 L 15 0 L 25 10 L 35 0 L 45 15 L 55 5 L 65 15 L 80 0 L 85 20 L 100 25 L 85 40 L 100 50 L 85 60 L 100 75 L 80 70 L 70 85 L 60 75 L 50 90 L 40 75 L 25 85 L 20 70 L 0 75 L 10 55 L 0 40 L 15 30 Z",
                    bg: 'white',
                    color: 'black',
                    stroke: 'black',
                    strokeWidth: '2',
                    font: 'font-extrabold uppercase italic'
                };
            case 'thought':
                 return {
                    filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
                    path: "M 20 20 Q 10 10 25 5 Q 40 0 55 10 Q 70 0 85 10 Q 95 15 90 30 Q 100 45 90 60 Q 85 75 70 70 Q 55 80 40 70 Q 25 75 15 60 Q 0 50 10 35 Q 0 25 20 20 M 30 85 A 5 5 0 1 1 25 90 M 20 95 A 3 3 0 1 1 18 98",
                    bg: 'white',
                    color: '#333',
                    stroke: '#ccc',
                    strokeWidth: '2',
                    font: 'font-medium italic text-gray-700'
                };
            case 'box':
                return {
                    filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.8))',
                    path: "M 0 0 H 100 V 100 H 0 Z",
                    bg: '#000000',
                    color: 'white',
                    stroke: 'white',
                    strokeWidth: '1',
                    font: 'font-sans tracking-wide'
                };
            case 'whisper':
                return {
                    filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.2))',
                    path: "M 10 50 A 40 40 0 1 1 90 50 A 40 40 0 1 1 10 50",
                    strokeDasharray: "4,2",
                    bg: 'rgba(255,255,255,0.9)',
                    color: '#555',
                    stroke: '#888',
                    strokeWidth: '1',
                    font: 'text-xs text-gray-500 italic'
                }
            case 'speech':
            default:
                return {
                    filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
                    path: "M 10 10 C 0 10 0 30 0 40 V 60 C 0 80 20 90 40 90 H 50 L 45 100 L 65 90 H 80 C 100 90 100 70 100 60 V 40 C 100 10 80 10 50 10 H 10 Z",
                    bg: 'white',
                    color: 'black',
                    stroke: 'black',
                    strokeWidth: '2',
                    font: 'font-semibold'
                };
        }
    }

    const style = getBubbleStyle(bubble.bubbleType || 'speech');

    return (
        <Rnd
            ref={bubbleRef}
            style={{ zIndex: bubble.zIndex }}
            size={{ width: bubble.width, height: bubble.height }}
            position={{ x: bubble.x, y: bubble.y }}
            onDragStart={() => { onBringToFront(bubble.id); setShowMenu(false); }}
            onDragStop={(e, d) => onUpdate(bubble.id, { x: d.x, y: d.y })}
            onResizeStart={() => { onBringToFront(bubble.id); setShowMenu(false); }}
            onResizeStop={(e, direction, ref, delta, position) => {
                onUpdate(bubble.id, {
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    ...position,
                });
            }}
            bounds="parent"
            className="group absolute"
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => !isEditing && setShowMenu(false)}
            onClick={() => setShowMenu(true)}
        >
            {/* Context Menu */}
            {showMenu && (
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl flex items-center gap-1 p-1 z-50 animate-fade-in-up">
                    <button onClick={() => handleTypeChange('speech')} title="Habla Normal" className={`p-1.5 rounded hover:bg-zinc-700 ${bubble.bubbleType === 'speech' ? 'bg-violet-600 text-white' : 'text-gray-300'}`}>
                        <div className="w-4 h-4 border-2 border-current rounded-full rounded-bl-none"></div>
                    </button>
                    <button onClick={() => handleTypeChange('shout')} title="Grito" className={`p-1.5 rounded hover:bg-zinc-700 ${bubble.bubbleType === 'shout' ? 'bg-red-600 text-white' : 'text-gray-300'}`}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    </button>
                     <button onClick={() => handleTypeChange('thought')} title="Pensamiento" className={`p-1.5 rounded hover:bg-zinc-700 ${bubble.bubbleType === 'thought' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15a4 4 0 014-4h.5a4.5 4.5 0 018 0h.5a4 4 0 014 4v1a4 4 0 01-4 4h-9a4 4 0 01-4-4v-1z" /></svg>
                    </button>
                    <button onClick={() => handleTypeChange('box')} title="Narración" className={`p-1.5 rounded hover:bg-zinc-700 ${bubble.bubbleType === 'box' ? 'bg-gray-600 text-white' : 'text-gray-300'}`}>
                         <div className="w-4 h-4 border-2 border-current rounded-sm"></div>
                    </button>
                    <div className="w-px h-4 bg-zinc-600 mx-1"></div>
                    <button onClick={() => onDelete(bubble.id)} className="p-1.5 rounded hover:bg-red-900/50 text-red-400">
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="relative w-full h-full" onDoubleClick={() => setIsEditing(true)}>
                {/* SVG Shape */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0 pointer-events-none overflow-visible" style={{ filter: style.filter }}>
                    <path d={style.path} fill={style.bg} stroke={style.stroke} strokeWidth={style.strokeWidth} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
                
                {/* Text Editor */}
                <div 
                    className="absolute inset-0 flex items-center justify-center p-4"
                >
                    <div
                        ref={textRef}
                        contentEditable={isEditing}
                        onBlur={handleTextBlur}
                        suppressContentEditableWarning={true}
                        className={`w-full text-center outline-none break-words whitespace-pre-wrap leading-snug ${style.font}`}
                        style={{ 
                            color: style.color,
                            fontSize: `${Math.max(12, bubble.height / 6)}px`
                        }}
                    >
                        {bubble.text}
                    </div>
                </div>
            </div>
        </Rnd>
    );
};
