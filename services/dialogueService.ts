/**
 * SERVICIO DE DIÁLOGOS
 * Sistema para añadir burbujas de diálogo a viñetas
 */

import { GoogleGenAI, Modality } from "@google/genai";
import type { Part } from "@google/genai";
import { resizeAndCropToExactDimensions } from '../utils/fileUtils';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match || match.length < 3) throw new Error("Invalid data URL");
  return { mimeType: match[1], data: match[2] };
};

const makeApiCallWithRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await apiCall();
        } catch (error: any) {
            attempt++;
            if (attempt >= maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    throw new Error("Max retries reached");
};

export interface DialogueBubble {
  text: string;
  speaker?: string;
  type: 'speech' | 'thought' | 'narration' | 'shout' | 'whisper';
  position?: 'top' | 'middle' | 'bottom' | 'auto';
}

/**
 * Añade burbujas de diálogo a una viñeta existente
 */
export const addDialogueToPanelImage = async (
  panelImage: string,
  dialogues: DialogueBubble[],
  width: number,
  height: number
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    // Construir instrucciones de diálogo
    let dialogueInstructions = '';
    dialogues.forEach((dialogue, index) => {
      const bubbleType = {
        speech: 'oval speech bubble',
        thought: 'cloud thought bubble',
        narration: 'rectangular narration box',
        shout: 'spiky/jagged speech bubble',
        whisper: 'small dashed speech bubble'
      }[dialogue.type];
      
      const position = dialogue.position || 'auto';
      const positionText = position === 'auto' 
        ? 'positioned naturally near the speaker' 
        : `positioned at the ${position} of the panel`;
      
      dialogueInstructions += `\n${index + 1}. ${bubbleType} ${positionText}`;
      if (dialogue.speaker) {
        dialogueInstructions += ` (${dialogue.speaker} speaking)`;
      }
      dialogueInstructions += `\n   Text: "${dialogue.text}"`;
    });
    
    const textPrompt = `[CRITICAL TASK: ADD DIALOGUE BUBBLES TO PANEL]
You are adding dialogue bubbles to an existing manhwa panel.

[ABSOLUTE RULES FOR DIALOGUE BUBBLES]
1. **PRESERVE ORIGINAL:** Keep the original panel art EXACTLY as it is
2. **BUBBLE PLACEMENT:**
   - Place bubbles at the TOP of the panel when possible
   - NEVER cover character faces
   - NEVER cover important visual elements
   - Use natural reading order (left to right, top to bottom)
3. **BUBBLE STYLE:**
   - Clean, professional manhwa/webtoon style
   - White fill with black outline
   - Appropriate tail pointing to speaker
4. **TEXT:**
   - Clear, readable font
   - Appropriate size (not too small, not too large)
   - Properly centered in bubble
   - Black text on white background
5. **SPACING:**
   - Adequate space between bubbles
   - Don't overcrowd the panel
   - Maintain visual balance

[ORIGINAL PANEL]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\n[DIALOGUE BUBBLES TO ADD]${dialogueInstructions}` });
    
    parts.push({ text: `\n\n[IMPORTANT REMINDERS]
- Keep the original art UNCHANGED
- Place bubbles at the TOP
- NEVER cover faces
- Use professional manhwa bubble style
- Ensure text is readable` });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let modifiedImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        modifiedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!modifiedImage) {
      throw new Error("No modified image generated");
    }
    
    console.log(`💬 Dialogue added to panel (${dialogues.length} bubbles)`);
    const finalImage = await resizeAndCropToExactDimensions(modifiedImage, width, height);
    return finalImage;
  });
};

/**
 * Añade efectos de sonido (onomatopeyas) a una viñeta
 */
export const addSoundEffectsToPanelImage = async (
  panelImage: string,
  soundEffects: { text: string; style: 'impact' | 'ambient' | 'action' }[],
  width: number,
  height: number
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    let effectsInstructions = '';
    soundEffects.forEach((effect, index) => {
      const styleDesc = {
        impact: 'large, bold, dramatic lettering with impact lines',
        ambient: 'subtle, atmospheric lettering',
        action: 'dynamic, motion-emphasized lettering'
      }[effect.style];
      
      effectsInstructions += `\n${index + 1}. "${effect.text}" - ${styleDesc}`;
    });
    
    const textPrompt = `[CRITICAL TASK: ADD SOUND EFFECTS TO PANEL]
You are adding sound effects (onomatopoeia) to an existing manhwa panel.

[ABSOLUTE RULES FOR SOUND EFFECTS]
1. **PRESERVE ORIGINAL:** Keep the original panel art EXACTLY as it is
2. **EFFECT PLACEMENT:**
   - Place near the source of the sound
   - Integrate naturally with the action
   - Can overlap slightly with art (unlike dialogue bubbles)
3. **EFFECT STYLE:**
   - Stylized, dramatic lettering
   - Appropriate size for impact
   - Can use colors and effects
   - Professional manhwa/webtoon style
4. **VISUAL IMPACT:**
   - Enhance the action, don't distract
   - Use appropriate font weight and style
   - Add motion lines or effects if appropriate

[ORIGINAL PANEL]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\n[SOUND EFFECTS TO ADD]${effectsInstructions}` });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let modifiedImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        modifiedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!modifiedImage) {
      throw new Error("No modified image generated");
    }
    
    console.log(`🔊 Sound effects added to panel (${soundEffects.length} effects)`);
    const finalImage = await resizeAndCropToExactDimensions(modifiedImage, width, height);
    return finalImage;
  });
};

/**
 * Sugiere posiciones óptimas para burbujas de diálogo
 */
export const suggestDialoguePlacement = async (
  panelImage: string,
  numberOfBubbles: number
): Promise<{
  suggestions: Array<{
    position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom';
    reason: string;
  }>;
}> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[TASK: ANALYZE PANEL FOR DIALOGUE PLACEMENT]
Analyze this manhwa panel and suggest the best positions for ${numberOfBubbles} dialogue bubble(s).

[RULES]
- Avoid covering faces
- Avoid covering important visual elements
- Prefer top positions
- Consider natural reading order
- Ensure bubbles won't overlap

[PANEL TO ANALYZE]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\nProvide ${numberOfBubbles} position suggestion(s) with reasoning.
Format:
Position: [top-left/top-center/top-right/middle-left/middle-right/bottom]
Reason: [why this position is good]` });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts },
      config: { responseMimeType: 'text/plain' }
    });
    
    const analysis = response.text;
    
    // Parsear respuesta (implementación básica)
    const suggestions: Array<{
      position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom';
      reason: string;
    }> = [];
    
    const lines = analysis.split('\n');
    let currentPosition: any = null;
    let currentReason = '';
    
    for (const line of lines) {
      if (line.toLowerCase().includes('position:')) {
        if (currentPosition && currentReason) {
          suggestions.push({ position: currentPosition, reason: currentReason });
        }
        const posMatch = line.match(/position:\s*(.+)/i);
        if (posMatch) {
          currentPosition = posMatch[1].trim().toLowerCase();
        }
        currentReason = '';
      } else if (line.toLowerCase().includes('reason:')) {
        const reasonMatch = line.match(/reason:\s*(.+)/i);
        if (reasonMatch) {
          currentReason = reasonMatch[1].trim();
        }
      }
    }
    
    if (currentPosition && currentReason) {
      suggestions.push({ position: currentPosition, reason: currentReason });
    }
    
    return { suggestions };
  });
};

/**
 * Analiza el texto de una viñeta para extraer diálogos
 */
export const extractDialogueFromPrompt = (prompt: string): DialogueBubble[] => {
  const dialogues: DialogueBubble[] = [];
  
  // Patrones para detectar diálogos
  const patterns = [
    // "Character says: 'text'"
    /(\w+)\s+says?:\s*['"](.+?)['"]/gi,
    // "Character: 'text'"
    /(\w+):\s*['"](.+?)['"]/gi,
    // "'text' - Character"
    /['"](.+?)['"]\s*-\s*(\w+)/gi,
    // Pensamientos: "Character thinks: 'text'"
    /(\w+)\s+thinks?:\s*['"](.+?)['"]/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const isThought = match[0].toLowerCase().includes('think');
      dialogues.push({
        text: match[2] || match[1],
        speaker: match[1] || match[2],
        type: isThought ? 'thought' : 'speech',
        position: 'auto'
      });
    }
  }
  
  return dialogues;
};

/**
 * Genera una viñeta con diálogos integrados desde el inicio
 */
export const generatePanelWithDialogue = async (
  sceneDescription: string,
  dialogues: DialogueBubble[],
  width: number,
  height: number,
  characters: any[],
  styleReferences: any[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const aspectRatio = width / height;
    const orientation = aspectRatio > 1 ? 'landscape' : aspectRatio < 1 ? 'portrait' : 'square';
    
    // Construir instrucciones de diálogo
    let dialogueInstructions = '\n\n[DIALOGUE BUBBLES TO INCLUDE]';
    dialogues.forEach((dialogue, index) => {
      const bubbleType = {
        speech: 'oval speech bubble',
        thought: 'cloud thought bubble',
        narration: 'rectangular narration box',
        shout: 'spiky/jagged speech bubble',
        whisper: 'small dashed speech bubble'
      }[dialogue.type];
      
      dialogueInstructions += `\n${index + 1}. ${bubbleType} at the TOP of the panel`;
      if (dialogue.speaker) {
        dialogueInstructions += ` (${dialogue.speaker} speaking)`;
      }
      dialogueInstructions += `\n   Text: "${dialogue.text}"`;
    });
    
    const textPrompt = `[CRITICAL TASK: GENERATE PANEL WITH DIALOGUE]
Create a professional manhwa panel with integrated dialogue bubbles.

[ABSOLUTE RULES]
1. **ASPECT RATIO:** Output MUST be in ${orientation} format (${aspectRatio.toFixed(2)}:1)
2. **COMPOSITION:** Frame the scene to leave space for dialogue bubbles at the TOP
3. **DIALOGUE BUBBLES:**
   - Place at the TOP of the panel
   - NEVER cover character faces
   - Professional manhwa/webtoon style
   - Clear, readable text
4. **MANHWA STYLE:** Modern professional manhwa/webtoon style with vibrant colors

[SCENE DESCRIPTION]
${sceneDescription}
${dialogueInstructions}

[IMPORTANT]
Compose the scene so dialogue bubbles fit naturally at the top without covering important elements.`;
    parts.push({ text: textPrompt });
    
    // Añadir referencias de personajes
    if (characters.length > 0) {
      parts.push({ text: `\n\n[CHARACTER REFERENCES]` });
      for (const char of characters) {
        parts.push({ text: `\n${char.name}:` });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
      }
    }
    
    // Añadir referencias de estilo
    if (styleReferences.length > 0) {
      parts.push({ text: `\n\n[STYLE REFERENCES]` });
      for (const ref of styleReferences) {
        parts.push({ inlineData: parseDataUrl(ref.image) });
      }
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let generatedImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!generatedImage) {
      throw new Error("No image generated");
    }
    
    console.log(`💬 Panel with dialogue generated`);
    const finalImage = await resizeAndCropToExactDimensions(generatedImage, width, height);
    return finalImage;
  });
};
