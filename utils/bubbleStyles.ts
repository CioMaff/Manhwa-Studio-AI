// -----------------------------------------------------------------------------
// Dialogue bubble style registry.
//
// One source of truth for every bubble shape the app supports. Each entry owns:
//   - its SVG path (drawn in a 100x100 viewBox, stretched with preserveAspectRatio)
//   - its fill / stroke / glow
//   - its default font family
//   - a short agent-facing description used inside the `createDialogueBubble`
//     function declaration. The model picks the style by name so the names and
//     descriptions are part of the tool's contract — avoid renaming without
//     grepping usages.
//
// See DIALOGUE_BUBBLE_SYSTEM.md at the repo root for when-to-use guidance.
// -----------------------------------------------------------------------------

import type { BubbleType, BubbleFont } from '../types';

export interface BubbleVisual {
    // Primary path rendered in the 100x100 viewBox. Use `preserveAspectRatio="none"`
    // on the <svg>, so paths stretch with the bubble's width/height.
    path: string;
    // Optional second path drawn on top (used by narration-double for the inner
    // rectangle and by splash-sfx for the splatter overlay).
    overlayPath?: string;
    // Optional third path, drawn after `overlayPath`. Used by the thought style
    // for the trailing bubble dots.
    tailPath?: string;
    fill: string;
    stroke: string;
    strokeWidth: string;
    strokeDasharray?: string;
    // CSS filter applied to the <svg>. Drop shadows and glows live here.
    filter: string;
    // Default font for this bubble. Caller can override via DialogueBubble.fontFamily.
    defaultFont: BubbleFont;
    // Tailwind classes applied to the inner text <div>. Style-specific tweaks
    // like italic, uppercase or letter-spacing go here.
    textClass: string;
    // Text color.
    textColor: string;
}

// Font family → CSS value, referencing the fonts loaded in index.html.
// Kept as a const map so agent tool argument validation can enumerate it.
export const BUBBLE_FONT_FAMILY: Record<BubbleFont, string> = {
    'sans-bold':     `'Bebas Neue', 'Anton', 'Oswald', 'Outfit', sans-serif`,
    'sans-italic':   `'Oswald', 'Outfit', sans-serif`,
    'gothic':        `'UnifrakturMaguntia', serif`,
    'serif-display': `'Cinzel Decorative', 'Cinzel', serif`,
    'handwritten':   `'Caveat', 'Outfit', cursive`,
};

// All nine bubble definitions. Coordinates live in a 100x100 viewBox; the SVG
// is rendered with `preserveAspectRatio="none"` so paths stretch to fit.
export const BUBBLE_STYLES: Record<BubbleType, BubbleVisual> = {
    // Classic oval with tail pointing down-left. Normal volume dialogue.
    speech: {
        path: "M 10 10 C 0 10 0 30 0 40 V 60 C 0 80 20 90 40 90 H 50 L 45 100 L 65 90 H 80 C 100 90 100 70 100 60 V 40 C 100 10 80 10 50 10 H 10 Z",
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: '2',
        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
        defaultFont: 'sans-bold',
        textClass: 'font-bold',
        textColor: '#111111',
    },

    // Spiky starburst — yelling / impact / exclamation.
    shout: {
        path: "M 10 10 L 15 0 L 25 10 L 35 0 L 45 15 L 55 5 L 65 15 L 80 0 L 85 20 L 100 25 L 85 40 L 100 50 L 85 60 L 100 75 L 80 70 L 70 85 L 60 75 L 50 90 L 40 75 L 25 85 L 20 70 L 0 75 L 10 55 L 0 40 L 15 30 Z",
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: '2.5',
        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.5))',
        defaultFont: 'sans-italic',
        textClass: 'font-extrabold italic uppercase tracking-tight',
        textColor: '#000000',
    },

    // Soft cloud with trailing dots — internal monologue / telepathy.
    thought: {
        path: "M 20 25 Q 8 15 22 8 Q 38 0 55 10 Q 70 0 85 12 Q 98 20 92 35 Q 102 50 90 63 Q 86 78 68 72 Q 55 82 40 70 Q 22 75 12 60 Q -2 50 10 35 Q -2 22 20 25 Z",
        tailPath: "M 30 85 A 4 4 0 1 1 29 85.5 M 22 93 A 2.5 2.5 0 1 1 21.5 93.2",
        fill: '#ffffff',
        stroke: '#222222',
        strokeWidth: '2',
        filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
        defaultFont: 'handwritten',
        textClass: 'font-medium italic',
        textColor: '#333333',
    },

    // Dashed oval — whisper / secret.
    whisper: {
        path: "M 10 50 A 40 40 0 1 1 90 50 A 40 40 0 1 1 10 50",
        strokeDasharray: '4,2',
        fill: 'rgba(255,255,255,0.9)',
        stroke: '#888888',
        strokeWidth: '1.5',
        filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.2))',
        defaultFont: 'handwritten',
        textClass: 'italic',
        textColor: '#555555',
    },

    // Simple black rectangle — narrator box. Classic manhwa opener line.
    'narration-box': {
        path: "M 0 0 H 100 V 100 H 0 Z",
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: '3',
        filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.35))',
        defaultFont: 'sans-bold',
        textClass: 'font-bold uppercase tracking-wide',
        textColor: '#000000',
    },

    // Back-compat alias for narration-box — old projects saved this value.
    box: {
        path: "M 0 0 H 100 V 100 H 0 Z",
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: '3',
        filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.35))',
        defaultFont: 'sans-bold',
        textClass: 'font-bold uppercase tracking-wide',
        textColor: '#000000',
    },

    // Two overlapping rectangles — layered narration, "but…" / "however…" beats.
    'narration-double': {
        path: "M 0 0 H 70 V 50 H 0 Z",
        overlayPath: "M 30 45 H 100 V 100 H 30 Z",
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: '3',
        filter: 'drop-shadow(0px 6px 8px rgba(0,0,0,0.5))',
        defaultFont: 'sans-bold',
        textClass: 'font-bold uppercase tracking-wide',
        textColor: '#000000',
    },

    // Rectangle with neon glow border — the emphasis beat. Short, punchy, red by
    // default. Accent color is overridable via DialogueBubble.accentColor.
    'emphasis-neon': {
        path: "M 2 2 H 98 V 98 H 2 Z",
        fill: '#000000',
        stroke: '#ff2d55',
        strokeWidth: '3',
        filter: 'drop-shadow(0 0 6px #ff2d55) drop-shadow(0 0 14px rgba(255,45,85,0.7))',
        defaultFont: 'sans-bold',
        textClass: 'font-black uppercase tracking-wider',
        textColor: '#ffffff',
    },

    // No bubble — just typography on a subtle decorative backdrop (blood
    // splatter-style dots). Used for big cinematic beats over a black frame.
    // Caller usually places this over an already-dark panel.
    'splash-sfx': {
        // Subtle background rectangle so the text stays readable if placed on
        // a non-black panel. Stroke kept at 0 so it's invisible on darks.
        path: "M 0 0 H 100 V 100 H 0 Z",
        // Decorative splatter dots — rendered in accentColor, fades near text.
        overlayPath: "M 8 18 a 2 2 0 1 0 0.1 0 Z M 88 12 a 3 3 0 1 0 0.1 0 Z M 92 78 a 2.5 2.5 0 1 0 0.1 0 Z M 15 82 a 3.5 3.5 0 1 0 0.1 0 Z M 70 90 a 1.5 1.5 0 1 0 0.1 0 Z M 32 8 a 1.8 1.8 0 1 0 0.1 0 Z",
        fill: 'rgba(0,0,0,0.0)',
        stroke: 'transparent',
        strokeWidth: '0',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
        defaultFont: 'serif-display',
        textClass: 'font-black uppercase tracking-wide',
        textColor: '#ffffff',
    },
};

// Agent-facing catalog. Passed into the Gemini tool system prompt so the model
// knows what to pick. Keep descriptions tight — the model wastes tokens on long
// tool specs.
export const BUBBLE_STYLE_CATALOG: { type: BubbleType; description: string }[] = [
    { type: 'speech',            description: 'Oval clásico con cola. Diálogo normal.' },
    { type: 'shout',             description: 'Starburst puntiagudo. Gritos, impacto.' },
    { type: 'thought',           description: 'Nube con burbujitas. Monólogo interno.' },
    { type: 'whisper',           description: 'Óvalo con borde discontinuo. Susurro.' },
    { type: 'narration-box',     description: 'Rectángulo blanco bordeado. Voz narrador.' },
    { type: 'narration-double',  description: 'Dos rectángulos solapados. Narración en dos tiempos / pero…' },
    { type: 'emphasis-neon',     description: 'Rectángulo negro con glow neón de color. Golpe dramático corto.' },
    { type: 'splash-sfx',        description: 'Sin bocadillo, solo tipografía sobre panel oscuro con salpicaduras. Beats cinematográficos.' },
];
