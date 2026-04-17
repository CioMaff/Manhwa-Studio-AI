/**
 * SERVICIO DE EDICIÓN
 * Herramientas para que el agente pueda editar y mejorar viñetas existentes
 */

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Part } from "@google/genai";
import type { SubPanel, Character, StyleReference, BackgroundAsset, ObjectAsset } from '../types';
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

/**
 * Edita una viñeta existente con instrucciones específicas
 */
export const editPanelImage = async (
  originalImage: string,
  editInstructions: string,
  width: number,
  height: number,
  characters?: Character[],
  styleReferences?: StyleReference[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const aspectRatio = width / height;
    const orientation = aspectRatio > 1 ? 'landscape' : aspectRatio < 1 ? 'portrait' : 'square';
    
    const textPrompt = `[CRITICAL TASK: EDIT EXISTING PANEL]
You are editing an existing manhwa panel. You MUST maintain the overall composition and style while making the requested changes.

[ABSOLUTE RULES]
1. **MAINTAIN COMPOSITION:** Keep the same framing, camera angle, and general layout
2. **MAINTAIN STYLE:** Keep the same art style, line work, and coloring approach
3. **ASPECT RATIO:** Output MUST be in ${orientation} format (${aspectRatio.toFixed(2)}:1)
4. **APPLY CHANGES:** Make ONLY the changes described in the edit instructions
5. **QUALITY:** Maintain or improve the quality of the original

[ORIGINAL PANEL TO EDIT]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(originalImage) });
    
    parts.push({ text: `\n\n[EDIT INSTRUCTIONS]\n${editInstructions}` });
    
    if (characters && characters.length > 0) {
      parts.push({ text: `\n\n[CHARACTER REFERENCES - Maintain consistency]` });
      for (const char of characters) {
        parts.push({ text: `\n${char.name}:` });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
      }
    }
    
    if (styleReferences && styleReferences.length > 0) {
      parts.push({ text: `\n\n[STYLE REFERENCES - Maintain this art style]` });
      for (const ref of styleReferences) {
        parts.push({ inlineData: parseDataUrl(ref.image) });
      }
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let editedImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        editedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!editedImage) {
      throw new Error("No edited image generated");
    }
    
    console.log(`✏️ Panel edited successfully`);
    const finalImage = await resizeAndCropToExactDimensions(editedImage, width, height);
    return finalImage;
  });
};

/**
 * Corrige inconsistencias específicas en una viñeta
 */
export const fixInconsistency = async (
  panelImage: string,
  inconsistencyType: 'character' | 'background' | 'style' | 'composition',
  referenceImage: string,
  width: number,
  height: number
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const instructions: Record<typeof inconsistencyType, string> = {
      character: `Fix the character's appearance to match the reference image EXACTLY. Pay special attention to:
- Facial features (eyes, nose, mouth, face shape)
- Hair style and color
- Clothing and accessories
- Body proportions
- Skin tone`,
      
      background: `Fix the background/scenario to match the reference image. Maintain:
- Environment style and atmosphere
- Lighting and mood
- Architectural elements
- Color palette
- Level of detail`,
      
      style: `Fix the art style to match the reference. Adjust:
- Line work thickness and style
- Coloring technique
- Shading and lighting approach
- Level of detail
- Overall artistic mood`,
      
      composition: `Fix the composition to match the reference. Adjust:
- Framing and camera angle
- Character/object placement
- Balance and visual weight
- Focal points
- Negative space usage`
    };
    
    const textPrompt = `[CRITICAL TASK: FIX INCONSISTENCY]
You are correcting a ${inconsistencyType} inconsistency in a manhwa panel.

[ABSOLUTE RULES]
1. **STUDY THE REFERENCE:** Carefully analyze the reference image
2. **FIX THE ISSUE:** ${instructions[inconsistencyType]}
3. **MAINTAIN OTHER ELEMENTS:** Keep everything else unchanged
4. **QUALITY:** Maintain high quality throughout

[PANEL WITH INCONSISTENCY]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\n[REFERENCE IMAGE - This is CORRECT]` });
    parts.push({ inlineData: parseDataUrl(referenceImage) });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let fixedImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        fixedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!fixedImage) {
      throw new Error("No fixed image generated");
    }
    
    console.log(`🔧 ${inconsistencyType} inconsistency fixed`);
    const finalImage = await resizeAndCropToExactDimensions(fixedImage, width, height);
    return finalImage;
  });
};

/**
 * Añade un elemento a una viñeta existente
 */
export const addElementToPanel = async (
  panelImage: string,
  elementDescription: string,
  elementType: 'character' | 'object' | 'effect',
  width: number,
  height: number,
  referenceImage?: string
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: ADD ELEMENT TO PANEL]
You are adding a ${elementType} to an existing manhwa panel.

[ABSOLUTE RULES]
1. **MAINTAIN ORIGINAL:** Keep the existing composition, style, and elements
2. **ADD NATURALLY:** Integrate the new element seamlessly
3. **MATCH STYLE:** The new element MUST match the art style of the panel
4. **PROPER PLACEMENT:** Place the element logically in the scene
5. **LIGHTING:** Match the lighting and shadows of the original

[ORIGINAL PANEL]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\n[ELEMENT TO ADD]\nType: ${elementType}\nDescription: ${elementDescription}` });
    
    if (referenceImage) {
      parts.push({ text: `\n\n[REFERENCE FOR NEW ELEMENT]` });
      parts.push({ inlineData: parseDataUrl(referenceImage) });
    }
    
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
    
    console.log(`➕ Element added to panel`);
    const finalImage = await resizeAndCropToExactDimensions(modifiedImage, width, height);
    return finalImage;
  });
};

/**
 * Elimina un elemento de una viñeta existente
 */
export const removeElementFromPanel = async (
  panelImage: string,
  elementDescription: string,
  width: number,
  height: number
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: REMOVE ELEMENT FROM PANEL]
You are removing an element from an existing manhwa panel.

[ABSOLUTE RULES]
1. **REMOVE CLEANLY:** Remove the specified element completely
2. **FILL THE GAP:** Naturally fill the space left by the removed element
3. **MAINTAIN STYLE:** Keep the same art style and quality
4. **SEAMLESS:** The removal should look natural, not edited
5. **PRESERVE REST:** Keep all other elements unchanged

[ORIGINAL PANEL]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\n[ELEMENT TO REMOVE]\n${elementDescription}` });
    
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
    
    console.log(`➖ Element removed from panel`);
    const finalImage = await resizeAndCropToExactDimensions(modifiedImage, width, height);
    return finalImage;
  });
};

/**
 * Mejora la calidad de una viñeta existente
 */
export const enhanceQuality = async (
  panelImage: string,
  width: number,
  height: number
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: ENHANCE QUALITY]
You are improving the quality of an existing manhwa panel.

[ABSOLUTE RULES]
1. **MAINTAIN COMPOSITION:** Keep the exact same composition and framing
2. **IMPROVE DETAILS:** Add more detail to faces, clothing, backgrounds
3. **ENHANCE LINES:** Make line work cleaner and more professional
4. **IMPROVE COLORS:** Enhance color vibrancy and shading
5. **SHARPEN:** Increase overall sharpness and clarity
6. **PRESERVE STYLE:** Maintain the original art style

[PANEL TO ENHANCE]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let enhancedImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        enhancedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!enhancedImage) {
      throw new Error("No enhanced image generated");
    }
    
    console.log(`✨ Panel quality enhanced`);
    const finalImage = await resizeAndCropToExactDimensions(enhancedImage, width, height);
    return finalImage;
  });
};

/**
 * Cambia el estilo artístico de una viñeta
 */
export const changeArtStyle = async (
  panelImage: string,
  newStyleReferences: StyleReference[],
  width: number,
  height: number
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: CHANGE ART STYLE]
You are converting an existing manhwa panel to a different art style.

[ABSOLUTE RULES]
1. **MAINTAIN COMPOSITION:** Keep the exact same composition, framing, and poses
2. **MAINTAIN CONTENT:** Keep all characters, objects, and elements
3. **CHANGE STYLE ONLY:** Apply the new art style (line work, coloring, shading)
4. **STUDY REFERENCES:** Carefully study the new style references
5. **CONSISTENCY:** Apply the new style consistently throughout

[ORIGINAL PANEL]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panelImage) });
    
    parts.push({ text: `\n\n[NEW ART STYLE REFERENCES - Apply this style]` });
    for (const ref of newStyleReferences) {
      parts.push({ inlineData: parseDataUrl(ref.image) });
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let styledImage = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        styledImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (!styledImage) {
      throw new Error("No styled image generated");
    }
    
    console.log(`🎨 Art style changed`);
    const finalImage = await resizeAndCropToExactDimensions(styledImage, width, height);
    return finalImage;
  });
};
