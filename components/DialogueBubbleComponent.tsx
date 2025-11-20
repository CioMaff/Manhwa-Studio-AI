import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import type { DialogueBubble } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { PlayIcon } from './icons/PlayIcon';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { useProject } from '../contexts/ProjectContext';

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
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing && textRef.current) {
            textRef.current.focus();
            document.execCommand('selectAll', false, undefined);
        }
    }, [isEditing]);

    const handleTextBlur = () => {
        if (textRef.current) {
            onUpdate(bubble.id, { text: textRef.current.innerText });
        }
        setIsEditing(false);
    };
    
    // Find custom style if it exists
    const bubbleStyle = bubble.styleId ? project.dialogueStyles.find(s => s.id === bubble.styleId) : null;
    
    return (
        <Rnd
            style={{ zIndex: bubble.zIndex }}
            size={{ width: bubble.width, height: bubble.height }}
            position={{ x: bubble.x, y: bubble.y }}
            onDragStart={() => onBringToFront(bubble.id)}
            onDragStop={(e, d) => onUpdate(bubble.id, { x: d.x, y: d.y })}
            onResizeStart={() => onBringToFront(bubble.id)}
            onResizeStop={(e, direction, ref, delta, position) => {
                onUpdate(bubble.id, {
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    ...position,
                });
            }}
            bounds="parent"
            className="group absolute"
        >
            <div className="relative w-full h-full" onDoubleClick={() => setIsEditing(true)} onMouseDownCapture={() => onBringToFront(bubble.id)}>
                {bubbleStyle ? (
                     <img src={bubbleStyle.image} alt="Bubble Style" className="w-full h-full object-contain absolute inset-0 pointer-events-none" />
                ) : (
                    <svg viewBox="0 0 32 24" className="w-full h-full absolute inset-0 pointer-events-none" style={{ filter: 'drop-shadow(rgba(0,0,0,0.2) 2px 2px 2px)' }}>
                        <path d="M 4 0 C 1.79086 0 0 1.79086 0 4 V 16 C 0 18.2091 1.79086 20 4 20 H 10 L 8 24 L 14 20 H 28 C 30.2091 20 32 18.2091 32 16 V 4 C 32 1.79086 30.2091 0 28 0 H 4 Z" fill="white" stroke="black" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                )}
                
                <div 
                    ref={textRef}
                    contentEditable={isEditing}
                    onBlur={handleTextBlur}
                    suppressContentEditableWarning={true}
                    className={`absolute top-0 left-0 w-full h-full p-3 text-center text-black font-semibold text-sm leading-tight flex items-center justify-center break-words outline-none ${isEditing ? 'ring-2 ring-purple-500' : ''}`}
                    style={{ 
                        // If no style, clip text to standard shape. If style exists, allow full box (user relies on image transparency)
                        clipPath: bubbleStyle ? undefined : 'path("M 4 0 C 1.79086 0 0 1.79086 0 4 V 16 C 0 18.2091 1.79086 20 4 20 H 10 L 8 24 L 14 20 H 28 C 30.2091 20 32 18.2091 32 16 V 4 C 32 1.79086 30.2091 0 28 0 H 4 Z")' 
                    }}
                >
                    {bubble.text}
                </div>
                 <button onClick={(e) => { e.stopPropagation(); onDelete(bubble.id); }} className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 z-20">
                    <TrashIcon className="w-3 h-3"/>
                </button>
                 <button onClick={(e) => { e.stopPropagation(); onPlayAudio(bubble.text); }} title="Play Audio" className="absolute -bottom-2 -right-2 bg-gray-700 p-1.5 rounded-full text-white hover:bg-purple-600 z-20">
                    {isPlaying ? <SpeakerIcon className="w-3 h-3 animate-pulse text-purple-300" /> : <PlayIcon className="w-3 h-3" />}
                </button>
            </div>
        </Rnd>
    );
};