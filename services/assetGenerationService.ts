/**
 * SERVICIO DE GENERACIÓN DE ASSETS MEJORADO
 * Genera personajes, objetos y escenarios con máxima consistencia
 */

import { GoogleGenAI, Modality } from "@google/genai";
import type { Part } from "@google/genai";
import type { Character, ObjectAsset, BackgroundAsset, StyleReference } from '../types';
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
 * Genera una imagen de referencia de personaje con máxima calidad
 */
export const generateCharacterReference = async (
  description: string,
  styleReferences?: StyleReference[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: CHARACTER REFERENCE SHEET]
Create a professional character reference image for a manhwa/webtoon.

[ABSOLUTE RULES]
1. **FULL BODY:** Show the complete character from head to toe
2. **NEUTRAL POSE:** Standing straight, facing forward, arms slightly away from body
3. **CLEAR DETAILS:** All features must be clearly visible and detailed
4. **WHITE BACKGROUND:** Plain white background (#FFFFFF) for easy extraction
5. **PORTRAIT FORMAT:** Vertical orientation (portrait)
6. **MANHWA STYLE:** Modern professional manhwa/webtoon style
7. **HIGH QUALITY:** Maximum detail, clean line art, vibrant colors
8. **CONSISTENCY READY:** This will be used as reference, so be extremely consistent in:
   - Facial features (eyes, nose, mouth, face shape)
   - Hair (style, color, texture, length)
   - Clothing (every detail, colors, patterns)
   - Body proportions
   - Skin tone
   - Accessories

[CHARACTER DESCRIPTION]
${description}

[IMPORTANT]
This is a REFERENCE image. It will be used to maintain consistency across multiple panels.
Make every detail clear, distinct, and reproducible.`;
    parts.push({ text: textPrompt });
    
    if (styleReferences && styleReferences.length > 0) {
      parts.push({ text: `\n\n[ART STYLE REFERENCE - Use this style]` });
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
      throw new Error("No character reference generated");
    }
    
    console.log(`👤 Character reference generated`);
    // Tamaño estándar para referencias de personajes
    const finalImage = await resizeAndCropToExactDimensions(generatedImage, 1024, 1536);
    return finalImage;
  });
};

/**
 * Genera una imagen de referencia de objeto con máxima calidad
 */
export const generateObjectReference = async (
  description: string,
  styleReferences?: StyleReference[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: OBJECT REFERENCE IMAGE]
Create a professional object reference image for a manhwa/webtoon.

[ABSOLUTE RULES]
1. **COMPLETE OBJECT:** Show the entire object from all important angles
2. **CLEAR VIEW:** Main view should be clear and detailed
3. **WHITE BACKGROUND:** Plain white background (#FFFFFF)
4. **SQUARE FORMAT:** Balanced composition
5. **MANHWA STYLE:** Modern professional manhwa/webtoon style
6. **HIGH QUALITY:** Maximum detail, clean line art, appropriate colors
7. **CONSISTENCY READY:** This will be used as reference, so be extremely consistent in:
   - Shape and proportions
   - Colors and materials
   - Details and decorations
   - Texture and finish

[OBJECT DESCRIPTION]
${description}

[IMPORTANT]
This is a REFERENCE image. It will be used to maintain consistency when this object appears in panels.
Make every detail clear, distinct, and reproducible.`;
    parts.push({ text: textPrompt });
    
    if (styleReferences && styleReferences.length > 0) {
      parts.push({ text: `\n\n[ART STYLE REFERENCE - Use this style]` });
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
      throw new Error("No object reference generated");
    }
    
    console.log(`🔷 Object reference generated`);
    // Tamaño estándar para referencias de objetos
    const finalImage = await resizeAndCropToExactDimensions(generatedImage, 1024, 1024);
    return finalImage;
  });
};

/**
 * Genera una imagen de referencia de escenario/background
 */
export const generateBackgroundReference = async (
  description: string,
  styleReferences?: StyleReference[]
): Promise<string> => {
  return makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CRITICAL TASK: BACKGROUND/SCENARIO REFERENCE]
Create a professional background/environment reference image for a manhwa/webtoon.

[ABSOLUTE RULES]
1. **WIDE VIEW:** Show the environment clearly and completely
2. **DETAILED:** Include all important environmental details
3. **LANDSCAPE FORMAT:** Horizontal orientation for wide view
4. **MANHWA STYLE:** Modern professional manhwa/webtoon style
5. **HIGH QUALITY:** Maximum detail, atmospheric, immersive
6. **CONSISTENCY READY:** This will be used as reference, so be extremely consistent in:
   - Architecture and structures
   - Lighting and atmosphere
   - Color palette
   - Environmental details
   - Mood and tone

[ENVIRONMENT DESCRIPTION]
${description}

[IMPORTANT]
This is a REFERENCE image for a location/environment. It will be used to maintain consistency when this location appears in panels.
Make the environment distinctive, atmospheric, and reproducible.`;
    parts.push({ text: textPrompt });
    
    if (styleReferences && styleReferences.length > 0) {
      parts.push({ text: `\n\n[ART STYLE REFERENCE - Use this style]` });
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
      throw new Error("No background reference generated");
    }
    
    console.log(`🏞️ Background reference generated`);
    // Tamaño estándar para referencias de backgrounds (landscape)
    const finalImage = await resizeAndCropToExactDimensions(generatedImage, 1920, 1080);
    return finalImage;
  });
};

/**
 * Genera múltiples vistas de un personaje para mejor consistencia
 */
export const generateCharacterMultiView = async (
  description: string,
  styleReferences?: StyleReference[]
): Promise<{
  front: string;
  side: string;
  back: string;
  closeup: string;
}> => {
  console.log(`📸 Generating multi-view character reference...`);
  
  const views = {
    front: '',
    side: '',
    back: '',
    closeup: ''
  };
  
  // Vista frontal
  views.front = await makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CHARACTER REFERENCE - FRONT VIEW]
Create a front view character reference for a manhwa/webtoon.

RULES:
- Full body, standing straight, facing camera
- Arms slightly away from body
- Neutral expression
- All details clearly visible
- White background
- Portrait format
- Manhwa style

CHARACTER: ${description}`;
    parts.push({ text: textPrompt });
    
    if (styleReferences && styleReferences.length > 0) {
      for (const ref of styleReferences) {
        parts.push({ inlineData: parseDataUrl(ref.image) });
      }
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let img = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        img = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    return await resizeAndCropToExactDimensions(img, 1024, 1536);
  });
  
  console.log(`✅ Front view generated`);
  
  // Vista lateral (usando la frontal como referencia)
  views.side = await makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CHARACTER REFERENCE - SIDE VIEW]
Create a side view of the SAME character from the front view.

RULES:
- Same character, same clothing, same proportions
- Full body, standing straight, facing left
- Profile view
- White background
- Portrait format
- Manhwa style

FRONT VIEW REFERENCE (this is the same character):`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(views.front) });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let img = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        img = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    return await resizeAndCropToExactDimensions(img, 1024, 1536);
  });
  
  console.log(`✅ Side view generated`);
  
  // Vista trasera
  views.back = await makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CHARACTER REFERENCE - BACK VIEW]
Create a back view of the SAME character.

RULES:
- Same character, same clothing, same proportions
- Full body, standing straight, facing away
- Back view
- White background
- Portrait format
- Manhwa style

FRONT VIEW REFERENCE (this is the same character):`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(views.front) });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let img = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        img = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    return await resizeAndCropToExactDimensions(img, 1024, 1536);
  });
  
  console.log(`✅ Back view generated`);
  
  // Close-up facial
  views.closeup = await makeApiCallWithRetry(async () => {
    const ai = getAI();
    const parts: Part[] = [];
    
    const textPrompt = `[CHARACTER REFERENCE - FACE CLOSE-UP]
Create a close-up of the SAME character's face.

RULES:
- Same character, same facial features
- Head and shoulders only
- Neutral expression
- Maximum facial detail
- White background
- Square format
- Manhwa style

FULL BODY REFERENCE (this is the same character):`;
    parts.push({ text: textPrompt });
    parts.push({ inlineData: parseDataUrl(views.front) });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE] },
    });
    
    let img = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        img = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
    
    return await resizeAndCropToExactDimensions(img, 1024, 1024);
  });
  
  console.log(`✅ Close-up generated`);
  console.log(`🎉 Multi-view character reference complete!`);
  
  return views;
};
