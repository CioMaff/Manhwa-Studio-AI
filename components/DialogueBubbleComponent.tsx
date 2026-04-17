import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import type { DialogueBubble, BubbleType, BubbleFont } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { BUBBLE_STYLES, BUBBLE_FONT_FAMILY, BUBBLE_STYLE_CATALOG } from '../utils/bubbleStyles';

const EditIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);

// Small ordered list of font options for the font-selector in the bubble menu.
const FONT_OPTIONS: { value: BubbleFont; label: string; sample: string }[] = [
    { value: 'sans-bold',     label: 'Bold',       sample: 'ABC' },
    { value: 'sans-italic',   label: 'Italic',     sample: 'ABC' },
    { value: 'gothic',        label: 'Gótica',     sample: 'ABC' },
    { value: 'serif-display', label: 'Display',    sample: 'ABC' },
    { value: 'handwritten',   label: 'Handwritten',sample: 'abc' },
];

export const DialogueBubbleComponent: React.FC<{
    bubble: DialogueBubble;
    panelBounds: DOMRect | undefined;
    onUpdate: (id: string, updates: Partial<DialogueBubble>) => void;
    onDelete: (id: string) => void;
    onBringToFront: (id: string) => void;
    onPlayAudio: (text: string) => void;
    isPlaying: boolean;
}> = ({ bubble, onUpdate, onDelete, onBringToFront }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showStyleDrawer, setShowStyleDrawer] = useState(false);
    const [showFontDrawer, setShowFontDrawer] = useState(false);
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
        setShowStyleDrawer(false);
    };

    const handleFontChange = (font: BubbleFont) => {
        onUpdate(bubble.id, { fontFamily: font });
        setShowFontDrawer(false);
    };

    const style = BUBBLE_STYLES[bubble.bubbleType] ?? BUBBLE_STYLES.speech;
    const font = bubble.fontFamily ?? style.defaultFont;
    const fontFamily = BUBBLE_FONT_FAMILY[font];
    const textColor = style.textColor;

    // emphasis-neon overrides stroke + filter using accentColor. Recompute the
    // filter string at render time so the color is live-editable.
    const accent = bubble.accentColor ?? '#ff2d55';
    const stroke = bubble.bubbleType === 'emphasis-neon' ? accent : style.stroke;
    const filter = bubble.bubbleType === 'emphasis-neon'
        ? `drop-shadow(0 0 6px ${accent}) drop-shadow(0 0 14px ${accent}B3)`
        : style.filter;

    return (
        <Rnd
            ref={bubbleRef}
            style={{ zIndex: bubble.zIndex }}
            size={{ width: bubble.width, height: bubble.height }}
            position={{ x: bubble.x, y: bubble.y }}
            onDragStart={() => { onBringToFront(bubble.id); setShowMenu(false); }}
            onDragStop={(_e, d) => onUpdate(bubble.id, { x: d.x, y: d.y })}
            onResizeStart={() => { onBringToFront(bubble.id); setShowMenu(false); }}
            onResizeStop={(_e, _direction, ref, _delta, position) => {
                onUpdate(bubble.id, {
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    ...position,
                });
            }}
            bounds="parent"
            className="group absolute"
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => {
                if (!isEditing) {
                    setShowMenu(false);
                    setShowStyleDrawer(false);
                    setShowFontDrawer(false);
                }
            }}
            onClick={() => setShowMenu(true)}
        >
            {/* Context Menu */}
            {showMenu && (
                <div
                    className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg shadow-2xl flex items-center gap-1 p-1 z-50 animate-fade-in-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => { setShowStyleDrawer(v => !v); setShowFontDrawer(false); }}
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-600/30 text-violet-200 hover:bg-violet-600/50"
                        title="Cambiar estilo de burbuja"
                    >
                        Estilo
                    </button>
                    <button
                        onClick={() => { setShowFontDrawer(v => !v); setShowStyleDrawer(false); }}
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600/30 text-blue-200 hover:bg-blue-600/50"
                        title="Cambiar tipografía"
                    >
                        Fuente
                    </button>
                    {bubble.bubbleType === 'emphasis-neon' && (
                        <label className="flex items-center gap-1 px-1 rounded bg-white/5" title="Color del glow">
                            <input
                                type="color"
                                value={accent}
                                onChange={(e) => onUpdate(bubble.id, { accentColor: e.target.value })}
                                className="w-5 h-5 rounded cursor-pointer bg-transparent border border-white/10"
                            />
                        </label>
                    )}
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-300"
                        title="Editar texto"
                    >
                        <EditIcon />
                    </button>
                    <div className="w-px h-4 bg-zinc-700 mx-0.5" />
                    <button
                        onClick={() => onDelete(bubble.id)}
                        className="p-1.5 rounded hover:bg-red-900/50 text-red-400"
                        title="Borrar burbuja"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Style picker drawer */}
            {showStyleDrawer && (
                <div
                    className="absolute -top-12 left-1/2 transform -translate-x-1/2 translate-y-[-100%] mt-[-8px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg shadow-2xl p-2 z-50 w-64"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="grid grid-cols-2 gap-1">
                        {BUBBLE_STYLE_CATALOG.map(({ type, description }) => (
                            <button
                                key={type}
                                onClick={() => handleTypeChange(type)}
                                className={`text-left px-2 py-1.5 rounded text-[10px] transition ${
                                    bubble.bubbleType === type
                                        ? 'bg-violet-600 text-white'
                                        : 'hover:bg-white/5 text-gray-300'
                                }`}
                                title={description}
                            >
                                <div className="font-bold uppercase">{type.replace(/-/g, ' ')}</div>
                                <div className="text-[9px] opacity-60 line-clamp-1">{description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Font picker drawer */}
            {showFontDrawer && (
                <div
                    className="absolute -top-12 left-1/2 transform -translate-x-1/2 translate-y-[-100%] mt-[-8px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg shadow-2xl p-2 z-50 flex flex-col gap-1 w-48"
                    onClick={(e) => e.stopPropagation()}
                >
                    {FONT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => handleFontChange(opt.value)}
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                                font === opt.value ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-300'
                            }`}
                        >
                            <span>{opt.label}</span>
                            <span style={{ fontFamily: BUBBLE_FONT_FAMILY[opt.value] }}>
                                {opt.sample}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <div className="relative w-full h-full" onDoubleClick={() => setIsEditing(true)}>
                {/* SVG bubble shape */}
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full absolute inset-0 pointer-events-none overflow-visible"
                    style={{ filter }}
                >
                    <path
                        d={style.path}
                        fill={style.fill}
                        stroke={stroke}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                    />
                    {style.overlayPath && (
                        <path
                            d={style.overlayPath}
                            fill={bubble.bubbleType === 'splash-sfx' ? accent : style.fill}
                            stroke={bubble.bubbleType === 'splash-sfx' ? 'transparent' : stroke}
                            strokeWidth={style.strokeWidth}
                            strokeDasharray={style.strokeDasharray}
                            vectorEffect="non-scaling-stroke"
                            strokeLinejoin="round"
                        />
                    )}
                    {style.tailPath && (
                        <path
                            d={style.tailPath}
                            fill={style.fill}
                            stroke={stroke}
                            strokeWidth={style.strokeWidth}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </svg>

                {/* Editable text */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div
                        ref={textRef}
                        contentEditable={isEditing}
                        onBlur={handleTextBlur}
                        suppressContentEditableWarning
                        className={`w-full text-center outline-none break-words whitespace-pre-wrap leading-snug ${style.textClass}`}
                        style={{
                            color: textColor,
                            fontFamily,
                            fontSize: bubble.fontSize
                                ? `${bubble.fontSize}px`
                                : `${Math.max(14, bubble.height / 5)}px`,
                        }}
                    >
                        {bubble.text}
                    </div>
                </div>
            </div>
        </Rnd>
    );
};
