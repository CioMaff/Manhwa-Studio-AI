/**
 * SERVICIO DE CONTINUIDAD MEJORADO
 * Sistema avanzado para mantener consistencia ABSOLUTA entre viñetas
 */

import { GoogleGenAI, Modality } from "@google/genai";
import type { Part } from "@google/genai";
import type { SubPanel, Character, StyleReference, BackgroundAsset } from '../types';
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
 * Genera una viñeta con continuidad MÁXIMA de la anterior
 */
export const generateWithStrictContinuity = async (
  previousPanel: SubPanel,
  newPrompt: string,
  width: number,
  height: number,
  characters: Character[],
  styleReferences: StyleReference[],
  backgrounds: BackgroundAsset[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const aspectRatio = width / height;
    const orientation = aspectRatio > 1 ? 'landscape' : aspectRatio < 1 ? 'portrait' : 'square';
    
    const textPrompt = `[CRITICAL TASK: NEXT FRAME WITH ABSOLUTE CONTINUITY]
You are creating the NEXT FRAME in a manhwa sequence. This is NOT a new scene - it's a continuation.

[ABSOLUTE RULES FOR CONTINUITY - NON-NEGOTIABLE]
1. **STYLE CONSISTENCY:** The art style, line work, coloring, and shading MUST be PIXEL-PERFECT identical to the previous frame
2. **CHARACTER CONSISTENCY:** If the same character appears:
   - Face MUST be identical (eyes, nose, mouth, face shape)
   - Hair MUST be identical (style, color, length)
   - Clothing MUST be identical (every detail, every fold)
   - Body proportions MUST be identical
   - Skin tone MUST be identical
3. **BACKGROUND CONSISTENCY:** Unless the scene explicitly changes location:
   - Environment style MUST match
   - Lighting direction MUST match
   - Color palette MUST match
   - Atmosphere MUST match
4. **TECHNICAL CONSISTENCY:**
   - Line thickness MUST match
   - Shading technique MUST match
   - Color saturation MUST match
   - Level of detail MUST match
5. **ASPECT RATIO:** Output MUST be in ${orientation} format (${aspectRatio.toFixed(2)}:1)

[PREVIOUS FRAME - STUDY THIS EXTREMELY CAREFULLY]
This is the REFERENCE for style, characters, and continuity:`;
    parts.push({ text: textPrompt });
    
    // CRITICAL: Cuádruple referencia de la viñeta anterior
    if (previousPanel.imageUrl) {
      parts.push({ inlineData: parseDataUrl(previousPanel.imageUrl) });
      parts.push({ inlineData: parseDataUrl(previousPanel.imageUrl) });
      parts.push({ inlineData: parseDataUrl(previousPanel.imageUrl) });
      parts.push({ inlineData: parseDataUrl(previousPanel.imageUrl) });
    }
    
    parts.push({ text: `\n\n[PROMPT FOR THIS NEW FRAME]\n${newPrompt}\n\nREMEMBER: Maintain ABSOLUTE consistency with the previous frame. Only change what the prompt explicitly requests.` });
    
    // Añadir referencias de personajes
    if (characters.length > 0) {
      parts.push({ text: `\n\n[CHARACTER REFERENCES - These MUST match the previous frame]` });
      for (const char of characters) {
        parts.push({ text: `\n${char.name}:` });
        // Triple referencia de cada personaje
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
      }
    }
    
    // Añadir referencias de estilo
    if (styleReferences.length > 0) {
      parts.push({ text: `\n\n[STYLE REFERENCES - Match this art style EXACTLY]` });
      for (const ref of styleReferences) {
        parts.push({ inlineData: parseDataUrl(ref.image) });
        parts.push({ inlineData: parseDataUrl(ref.image) });
      }
    }
    
    // Añadir referencias de background
    if (backgrounds.length > 0) {
      parts.push({ text: `\n\n[BACKGROUND REFERENCES - Maintain environment consistency]` });
      for (const bg of backgrounds) {
        parts.push({ inlineData: parseDataUrl(bg.image) });
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
    
    console.log(`🔗 Panel generated with strict continuity`);
    const finalImage = await resizeAndCropToExactDimensions(generatedImage, width, height);
    return finalImage;
  });
};

/**
 * Genera múltiples viñetas en secuencia con continuidad
 */
export const generateSequenceWithContinuity = async (
  prompts: string[],
  width: number,
  height: number,
  characters: Character[],
  styleReferences: StyleReference[],
  backgrounds: BackgroundAsset[],
  onProgress?: (index: number, total: number, imageUrl: string) => void
): Promise<string[]> => {
  const results: string[] = [];
  
  for (let i = 0; i < prompts.length; i++) {
    console.log(`📸 Generating panel ${i + 1}/${prompts.length}`);
    
    if (i === 0) {
      // Primera viñeta: generación normal
      const firstImage = await generateFirstPanel(
        prompts[i],
        width,
        height,
        characters,
        styleReferences,
        backgrounds
      );
      results.push(firstImage);
      
      if (onProgress) {
        onProgress(i, prompts.length, firstImage);
      }
    } else {
      // Viñetas siguientes: con continuidad estricta
      const previousPanel: SubPanel = {
        id: `temp-${i - 1}`,
        prompt: prompts[i - 1],
        characterIds: characters.map(c => c.id),
        imageUrl: results[i - 1],
        generationMode: 'sequential'
      };
      
      const nextImage = await generateWithStrictContinuity(
        previousPanel,
        prompts[i],
        width,
        height,
        characters,
        styleReferences,
        backgrounds
      );
      results.push(nextImage);
      
      if (onProgress) {
        onProgress(i, prompts.length, nextImage);
      }
    }
  }
  
  return results;
};

/**
 * Genera la primera viñeta de una secuencia
 */
const generateFirstPanel = async (
  prompt: string,
  width: number,
  height: number,
  characters: Character[],
  styleReferences: StyleReference[],
  backgrounds: BackgroundAsset[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const aspectRatio = width / height;
    const orientation = aspectRatio > 1 ? 'landscape' : aspectRatio < 1 ? 'portrait' : 'square';
    
    const textPrompt = `[CRITICAL TASK: FIRST PANEL OF SEQUENCE]
Create a professional manhwa panel. This is the FIRST panel of a sequence, so establish a strong visual foundation.

[ABSOLUTE RULES]
1. **ASPECT RATIO:** Output MUST be in ${orientation} format (${aspectRatio.toFixed(2)}:1)
2. **COMPOSITION:** Frame the scene naturally in ${orientation} format
3. **MANHWA STYLE:** Modern professional manhwa/webtoon style with vibrant colors, clean line art, detailed facial features
4. **QUALITY:** Maximum detail and sharpness
5. **CONSISTENCY FOUNDATION:** This will be the reference for subsequent panels, so be consistent in:
   - Line work thickness
   - Coloring technique
   - Shading style
   - Level of detail

[SCENE DESCRIPTION]
${prompt}`;
    parts.push({ text: textPrompt });
    
    // Añadir referencias
    if (backgrounds.length > 0) {
      parts.push({ text: `\n\n[BACKGROUND/ENVIRONMENT REFERENCE]` });
      for (const bg of backgrounds) {
        parts.push({ inlineData: parseDataUrl(bg.image) });
      }
    }
    
    if (styleReferences.length > 0) {
      parts.push({ text: `\n\n[ART STYLE REFERENCE - Use this style]` });
      for (const ref of styleReferences) {
        parts.push({ inlineData: parseDataUrl(ref.image) });
      }
    }
    
    if (characters.length > 0) {
      parts.push({ text: `\n\n[CHARACTER REFERENCES - Draw these characters EXACTLY as shown]` });
      for (const char of characters) {
        parts.push({ text: `\n${char.name}:` });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
        parts.push({ inlineData: parseDataUrl(char.referenceImage) });
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
    
    console.log(`✨ First panel generated`);
    const finalImage = await resizeAndCropToExactDimensions(generatedImage, width, height);
    return finalImage;
  });
};

/**
 * Analiza la consistencia entre dos viñetas
 */
export const analyzeContinuityIssues = async (
  panel1: SubPanel,
  panel2: SubPanel
): Promise<{
  isConsistent: boolean;
  issues: string[];
  score: number;
}> => {
  if (!panel1.imageUrl || !panel2.imageUrl) {
    return {
      isConsistent: false,
      issues: ['One or both panels have no image'],
      score: 0
    };
  }
  
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[TASK: ANALYZE CONTINUITY BETWEEN PANELS]
You are analyzing two consecutive manhwa panels to detect continuity issues.

[WHAT TO CHECK]
1. **Character Consistency:**
   - Face (eyes, nose, mouth, shape)
   - Hair (style, color, length)
   - Clothing (details, colors, folds)
   - Body proportions
   - Skin tone

2. **Style Consistency:**
   - Line work thickness
   - Coloring technique
   - Shading style
   - Level of detail

3. **Environment Consistency:**
   - Background style
   - Lighting direction
   - Color palette
   - Atmosphere

[PANEL 1]`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(panel1.imageUrl) });
    
    parts.push({ text: `\n\n[PANEL 2]` });
    parts.push({ inlineData: parseDataUrl(panel2.imageUrl) });
    
    parts.push({ text: `\n\n[INSTRUCTIONS]
List ALL inconsistencies you find. Be thorough and specific.
Format: "- [Category]: [Specific issue]"
Example: "- Character: Hair color changed from brown to black"

If panels are consistent, respond with: "CONSISTENT"` });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts },
      config: { responseMimeType: 'text/plain' }
    });
    
    const analysis = response.text.trim();
    
    if (analysis === 'CONSISTENT' || analysis.includes('No inconsistencies')) {
      return {
        isConsistent: true,
        issues: [],
        score: 100
      };
    }
    
    // Parsear issues
    const issues = analysis
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.trim().substring(2));
    
    // Calcular score basado en número de issues
    const score = Math.max(0, 100 - (issues.length * 15));
    
    return {
      isConsistent: score >= 70,
      issues,
      score
    };
  });
};
