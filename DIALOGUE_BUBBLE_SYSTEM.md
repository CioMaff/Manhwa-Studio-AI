# Dialogue Bubble System

End-to-end documentation of how dialogue bubbles ("bocadillos") work in Manwha Studio AI.

## Why this is a separate system

Nano Banana Pro (Gemini 3 Pro Image) is explicitly instructed **not** to render text or bubbles inside images — it produces clean full-bleed panels. All dialogue, narration, SFX and on-panel typography is layered on top by this system as editable DOM objects. That way:

- The user can edit dialogue after the fact without regenerating the image.
- Re-localization is trivial (swap `bubble.text`).
- The text renders with real fonts at any zoom level.
- The agent can place and restyle bubbles conversationally.

## Data model

Defined in [types.ts](types.ts).

```ts
export type BubbleType =
    | 'speech' | 'shout' | 'thought' | 'whisper'
    | 'box' | 'narration-box' | 'narration-double'
    | 'emphasis-neon' | 'splash-sfx';

export type BubbleFont =
    | 'sans-bold'      // Bebas Neue / Anton
    | 'sans-italic'    // Oswald italic
    | 'gothic'         // UnifrakturMaguntia
    | 'serif-display'  // Cinzel Decorative
    | 'handwritten';   // Caveat

export interface DialogueBubble {
    id: string;
    text: string;
    x: number; y: number;
    width: number; height: number;
    zIndex: number;
    bubbleType: BubbleType;
    fontFamily?: BubbleFont;
    accentColor?: string;   // hex, e.g. "#ff2d55"
    fontSize?: number;
    styleId?: string;       // optional link to a DialogueStyle asset
}
```

Bubbles live inside a `Panel` (`panel.dialogueBubbles[]`). Coordinates are in pixels relative to the parent panel's bounding box.

## Style registry

All nine styles are defined once in [utils/bubbleStyles.ts](utils/bubbleStyles.ts) as `BUBBLE_STYLES: Record<BubbleType, BubbleVisual>`. Adding a new style means:

1. Add the literal to `BubbleType` in `types.ts`.
2. Add a `BubbleVisual` entry to `BUBBLE_STYLES` (SVG path in a `100x100` viewBox, fill/stroke/filter, default font, text classes).
3. Add a `{ type, description }` entry to `BUBBLE_STYLE_CATALOG` — this is what the agent sees.

### Style catalog

| `bubbleType` | Usage | Default font |
|---|---|---|
| `speech` | Normal volume dialogue. Oval with tail. | `sans-bold` |
| `shout` | Yelling, exclamation, impact. Spiky starburst. | `sans-italic` |
| `thought` | Internal monologue, telepathy. Soft cloud with trailing dots. | `handwritten` |
| `whisper` | Quiet / secret speech. Dashed oval. | `handwritten` |
| `narration-box` | Narrator describing the scene. Black-bordered rectangle. | `sans-bold` |
| `box` | **Back-compat alias** of `narration-box`. Old projects may have this value. | `sans-bold` |
| `narration-double` | Two-part narration: "X, but Y". Two overlapping rectangles. | `sans-bold` |
| `emphasis-neon` | Single short dramatic beat (2–4 words). Black rectangle with colored glow. | `sans-bold` |
| `splash-sfx` | Big cinematic splash over an already-dark panel. No bubble, just typography with decorative splatter. | `serif-display` |

## Rendering

[components/DialogueBubbleComponent.tsx](components/DialogueBubbleComponent.tsx) is the single renderer:

- Wrapped in `Rnd` so the user can drag and resize.
- Pulls its visual from `BUBBLE_STYLES[bubbleType]` (falls back to `speech` for unknown types so a data migration never hard-crashes the canvas).
- Renders an SVG with `preserveAspectRatio="none"` so the 100×100 path stretches to fit the bubble's dimensions. Up to three paths are drawn: `path`, `overlayPath`, `tailPath`.
- For `emphasis-neon`, `bubble.accentColor` overrides the stroke and rebuilds the `drop-shadow` filter live; the color picker in the floating menu writes back to that field.
- Text is a `contentEditable` div. Double-click to edit, blur to save. Font size scales with height by default, overridable by `bubble.fontSize`.

### UI affordances

Hovering the bubble reveals a floating toolbar with:

- **Estilo** — opens a drawer listing all styles with their descriptions.
- **Fuente** — opens a drawer with the five font families previewed.
- **Color picker** — only visible for `emphasis-neon`; writes to `accentColor`.
- **Edit** — toggles `isEditing` (same as double-click).
- **Trash** — removes the bubble.

## Fonts

Loaded from Google Fonts in [index.html](index.html:34):

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:...&family=Bebas+Neue&family=Anton&family=Oswald:ital,wght@1,500;1,700&family=UnifrakturMaguntia&family=Cinzel+Decorative:wght@700;900&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
```

The `BubbleFont → CSS font-family` mapping lives in `BUBBLE_FONT_FAMILY` inside [bubbleStyles.ts](utils/bubbleStyles.ts). To swap a font family, edit that map — the bubble component reads from it at render time.

## Agent tool: `createDialogueBubble`

Registered in [services/geminiService.ts](services/geminiService.ts) and exposed to the chat agent via `tools: [{ functionDeclarations: [createDialogueBubbleTool] }]`.

### Signature

```ts
createDialogueBubble({
    text: string,                 // required
    bubbleType: BubbleType,       // required
    fontFamily?: BubbleFont,
    accentColor?: string,         // hex, only used by emphasis-neon / splash-sfx
    subPanelId?: string,          // omit to use the selected sub-panel
    position?: 'top' | 'center' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
})
```

### System prompt guidance

The agent is told to pick `bubbleType` by tone:

- Normal dialogue → `speech`
- Yelling / impact → `shout`
- Internal monologue → `thought`
- Secret / quiet → `whisper`
- Narrator line → `narration-box`
- Two-part narration ("X… but Y") → `narration-double`
- Short dramatic beat (2–4 words) → `emphasis-neon`
- Big cinematic splash → `splash-sfx`

### Execution

`Studio.tsx → executeAgentAction` handles the `createDialogueBubble` call:

1. Resolves the target sub-panel: explicit `subPanelId` → first selected id → first sub-panel of the active chapter.
2. Computes heuristic `x/y` based on `position` and dimensions based on `text.length` + `bubbleType` (splash-sfx is taller, emphasis-neon shorter).
3. Appends a new `DialogueBubble` to the parent panel's `dialogueBubbles` array via `updateProject`.
4. Toasts success. The user can drag/resize to refine.

### Example calls

```jsonc
// "El protagonista entra gritando"
{ "text": "¡APARTAOS!",          "bubbleType": "shout",            "position": "top" }

// Narrador de apertura
{ "text": "Era la última noche antes del torneo.",
  "bubbleType": "narration-box", "position": "top" }

// Beat dramático
{ "text": "SER SACRIFICADO.",    "bubbleType": "emphasis-neon",
  "accentColor": "#ff2d55" }

// Pensamiento interno
{ "text": "No puedo moverme...", "bubbleType": "thought",
  "fontFamily": "handwritten",   "position": "center" }
```

## Extending

- **New style:** follow the 3-step recipe under *Style registry* above. Both the renderer and the agent tool pick it up automatically because they both consume `BUBBLE_STYLES` / `BUBBLE_STYLE_CATALOG`.
- **New font:** add the `@family=` entry in `index.html`, add the key to `BubbleFont` in `types.ts`, add the `font-family` chain to `BUBBLE_FONT_FAMILY`, add an option to `FONT_OPTIONS` in `DialogueBubbleComponent.tsx`.
- **New agent action:** add a declaration next to `createDialogueBubbleTool` in `geminiService.ts` and a `case` in `executeAgentAction` in `Studio.tsx`.

## Non-goals

- Bubble text rendered *inside* the generated image — explicitly forbidden in the Nano Banana Pro prompt. Keep bubbles as DOM overlays.
- Cross-panel tails. Tails belong to a single sub-panel; pointing outside it is out of scope.
- Auto-wrapping based on panel geometry. The user (or the agent via size hints) controls the dimensions.
