/**
 * SISTEMA DE LAYOUTS MEJORADO
 * Incluye layouts dramáticos basados en análisis de manga/manhwa
 */

import type { CompositionType, SceneType } from '../types';

export interface LayoutDefinition {
  id: string;
  name: string;
  description: string;
  grid: number[][];
  panelHeights?: string[]; // Para layouts verticales (cascada)
  compositionType?: CompositionType;
  bestFor: SceneType[];
}

/**
 * LAYOUTS TRADICIONALES (Grid-based)
 */
export const TRADITIONAL_LAYOUTS: LayoutDefinition[] = [
  {
    id: '1',
    name: 'Single Panel',
    description: 'Una viñeta completa',
    grid: [[1]],
    compositionType: 'impact-single',
    bestFor: ['emotional', 'reveal', 'dramatic']
  },
  {
    id: '2v',
    name: '2 Vertical',
    description: 'Dos viñetas apiladas verticalmente',
    grid: [[1], [2]],
    bestFor: ['dialogue', 'action']
  },
  {
    id: '2h',
    name: '2 Horizontal',
    description: 'Dos viñetas lado a lado',
    grid: [[1, 2]],
    compositionType: 'horizontal-split',
    bestFor: ['dialogue', 'establishment']
  },
  {
    id: '3v',
    name: '3 Vertical',
    description: 'Tres viñetas apiladas',
    grid: [[1], [2], [3]],
    compositionType: 'dialogue-3',
    bestFor: ['dialogue', 'action']
  },
  {
    id: '4g',
    name: '4 Grid',
    description: 'Cuatro viñetas en cuadrícula',
    grid: [[1, 2], [3, 4]],
    bestFor: ['action', 'establishment']
  }
];

/**
 * LAYOUTS DRAMÁTICOS (Nuevos - basados en análisis)
 */
export const DRAMATIC_LAYOUTS: LayoutDefinition[] = [
  {
    id: 'dramatic-3',
    name: 'Dramatic Reveal (3 panels)',
    description: 'Pequeño → GRANDE (impacto) → Medio',
    grid: [[1], [2], [3]],
    panelHeights: ['20%', '50%', '30%'],
    compositionType: 'dramatic-3',
    bestFor: ['reveal', 'dramatic', 'emotional']
  },
  {
    id: 'dialogue-3-equal',
    name: 'Dialogue Flow (3 equal)',
    description: 'Tres paneles iguales para conversación',
    grid: [[1], [2], [3]],
    panelHeights: ['33%', '33%', '34%'],
    compositionType: 'dialogue-3',
    bestFor: ['dialogue']
  },
  {
    id: 'atmospheric-2',
    name: 'Atmospheric (2 large)',
    description: 'Wide shot → Extreme close-up',
    grid: [[1], [2]],
    panelHeights: ['55%', '45%'],
    compositionType: 'atmospheric-2',
    bestFor: ['emotional', 'establishment']
  },
  {
    id: 'impact-crescendo',
    name: 'Impact Crescendo',
    description: 'Pequeño → Medio → GRANDE',
    grid: [[1], [2], [3]],
    panelHeights: ['15%', '30%', '55%'],
    compositionType: 'dramatic-3',
    bestFor: ['action', 'reveal']
  },
  {
    id: 'dynamic-4',
    name: 'Dynamic Action (4 varied)',
    description: 'Cuatro paneles con variación dramática',
    grid: [[1], [2], [3], [4]],
    panelHeights: ['25%', '20%', '35%', '20%'],
    compositionType: 'dynamic-4',
    bestFor: ['action']
  }
];

/**
 * TODOS LOS LAYOUTS DISPONIBLES
 */
export const ALL_LAYOUTS = [...TRADITIONAL_LAYOUTS, ...DRAMATIC_LAYOUTS];

/**
 * REGLAS DE COMPOSICIÓN INTELIGENTE
 */
export interface CompositionRecommendation {
  layout: LayoutDefinition;
  shotTypes: string[];
  cameraAngles: string[];
  emphasis: ('normal' | 'impact' | 'transition')[];
  reasoning: string;
}

/**
 * Recomienda la mejor composición basada en el tipo de escena
 */
export const recommendComposition = (
  sceneType: SceneType,
  panelCount?: number
): CompositionRecommendation => {
  
  // REGLA 1: Diálogo
  if (sceneType === 'dialogue') {
    const layout = ALL_LAYOUTS.find(l => l.id === 'dialogue-3-equal') || ALL_LAYOUTS[3];
    return {
      layout,
      shotTypes: ['Medium Shot', 'Close-up', 'Close-up'],
      cameraAngles: ['Normal', 'Normal', 'Low Angle'],
      emphasis: ['normal', 'normal', 'normal'],
      reasoning: 'Dialogue scenes work best with equal-sized panels focusing on facial expressions'
    };
  }
  
  // REGLA 2: Revelación/Dramático
  if (sceneType === 'reveal' || sceneType === 'dramatic') {
    const layout = ALL_LAYOUTS.find(l => l.id === 'dramatic-3') || ALL_LAYOUTS[0];
    return {
      layout,
      shotTypes: ['Medium Shot', 'Extreme Close-up', 'Close-up'],
      cameraAngles: ['Normal', 'Normal', 'High Angle'],
      emphasis: ['normal', 'impact', 'normal'],
      reasoning: 'Dramatic reveals need a large central panel for maximum impact'
    };
  }
  
  // REGLA 3: Emocional
  if (sceneType === 'emotional') {
    const layout = ALL_LAYOUTS.find(l => l.id === 'atmospheric-2') || ALL_LAYOUTS[0];
    return {
      layout,
      shotTypes: ['Wide Shot', 'Extreme Close-up'],
      cameraAngles: ['Normal', 'Normal'],
      emphasis: ['normal', 'impact'],
      reasoning: 'Emotional scenes benefit from establishing atmosphere then focusing on character emotion'
    };
  }
  
  // REGLA 4: Acción
  if (sceneType === 'action') {
    const layout = ALL_LAYOUTS.find(l => l.id === 'dynamic-4') || ALL_LAYOUTS[4];
    return {
      layout,
      shotTypes: ['Wide Shot', 'Medium Shot', 'Close-up', 'Full Shot'],
      cameraAngles: ['Normal', 'Low Angle', 'Dutch Angle', 'High Angle'],
      emphasis: ['normal', 'normal', 'impact', 'normal'],
      reasoning: 'Action scenes need varied shot types and dynamic angles'
    };
  }
  
  // REGLA 5: Establecimiento
  if (sceneType === 'establishment') {
    const layout = ALL_LAYOUTS.find(l => l.id === '1') || ALL_LAYOUTS[0];
    return {
      layout,
      shotTypes: ['Wide Shot'],
      cameraAngles: ['Normal'],
      emphasis: ['normal'],
      reasoning: 'Establishing shots work best as single large panels'
    };
  }
  
  // DEFAULT: Balanceado
  const layout = ALL_LAYOUTS.find(l => l.id === '3v') || ALL_LAYOUTS[3];
  return {
    layout,
    shotTypes: ['Wide Shot', 'Medium Shot', 'Close-up'],
    cameraAngles: ['Normal', 'Normal', 'Normal'],
    emphasis: ['normal', 'normal', 'normal'],
    reasoning: 'Balanced composition for general scenes'
  };
};

/**
 * Obtiene layout por ID
 */
export const getLayoutById = (id: string): LayoutDefinition | undefined => {
  return ALL_LAYOUTS.find(l => l.id === id);
};

/**
 * Obtiene layouts recomendados para un tipo de escena
 */
export const getLayoutsForSceneType = (sceneType: SceneType): LayoutDefinition[] => {
  if (!sceneType) return ALL_LAYOUTS;
  return ALL_LAYOUTS.filter(l => l.bestFor.includes(sceneType));
};

/**
 * Calcula altura de panel basado en tipo
 */
export const calculatePanelHeight = (
  heightType: 'short' | 'medium' | 'long' | 'panoramic',
  baseWidth: number = 800
): number => {
  const ratios = {
    short: 0.5,      // 400px para width 800
    medium: 1.125,   // 900px
    long: 2.0,       // 1600px
    panoramic: 0.75  // 600px pero más ancho
  };
  
  return Math.round(baseWidth * ratios[heightType]);
};

/**
 * PROMPT DE COMPOSICIÓN para Gemini
 */
export const COMPOSITION_CONTEXT = `
[PANEL COMPOSITION RULES - CRITICAL]

Based on scene type, use these proven composition patterns:

**DIALOGUE SCENE:**
- 3 panels, equal height (33% each)
- Shot types: Medium → Close-up → Close-up
- Focus on facial expressions
- Dialogue bubbles at top, never covering faces

**DRAMATIC/REVEAL SCENE:**
- 3 panels: Small (20%) → LARGE (50%) → Medium (30%)
- Shot types: Setup → IMPACT (Extreme Close-up) → Reaction
- Middle panel is the emotional climax
- Use dramatic lighting

**EMOTIONAL SCENE:**
- 2 panels: Large (55%) → Large (45%)
- Shot types: Wide Shot (establishing) → Extreme Close-up
- Use negative space (sky, clean backgrounds)
- Melancholic atmosphere

**ACTION SCENE:**
- 4+ panels, varied sizes
- Shot types: Mix of Wide, Medium, Close-up, Full
- Dynamic angles (Low, High, Dutch)
- Speed lines, impact effects

[DIALOGUE BUBBLE RULES]
- Always position at TOP of panel
- Never cover character faces
- Use oval bubbles for speech
- Use rounded bubbles for thoughts
- Onomatopoeia for sound effects

[VISUAL HIERARCHY]
- Most important moment = Largest panel
- Build tension: small → large
- Release tension: large → small
- Emotional beats need close-ups
`;
