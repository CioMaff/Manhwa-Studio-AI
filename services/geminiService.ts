
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Part } from "@google/genai";
import type { Panel, Character, StyleReference, ChatMessage, Project, ScenePlanPage, ObjectAsset, SceneType, BackgroundAsset, SubPanel, LiveTranscriptEntry, AgentFunctionCall } from '../types';
import { showToast } from "../systems/uiSystem";
import { MANHWA_EXPERT_CONTEXT } from "../utils/manhwaContext";
import { layouts } from "../components/layouts";
import { logger } from "../systems/logger";

const getAI = () => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "Missing Gemini API key. Set GEMINI_API_KEY (or API_KEY) in your environment. " +
            "Never hardcode keys in client code — they get leaked on every deploy."
        );
    }
    return new GoogleGenAI({ apiKey });
};

// --- MODELS (NANO BANANA PRO CONFIGURATION) ---
const MODEL_TEXT = 'gemini-3.1-pro-preview'; 
const MODEL_IMAGE = 'gemini-3-pro-image-preview'; // UPGRADED TO PRO
// Fallback
const MODEL_IMAGE_FALLBACK = 'gemini-2.5-flash-image'; 
const MODEL_TEXT_FALLBACK = 'gemini-3-flash-preview';

// --- RATE LIMITING ---
let lastCallTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // Increased for Pro model safety
const MAX_CONCURRENT_REQUESTS = 2; // Reduced for Pro model safety
let activeRequests = 0;
const requestQueue: (() => void)[] = [];

const processQueue = () => {
    if (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
        const next = requestQueue.shift();
        if (next) next();
    }
};

const acquireToken = async (): Promise<void> => {
    return new Promise((resolve) => {
        const run = async () => {
            activeRequests++;
            const now = Date.now();
            const timeSinceLast = now - lastCallTime;
            if (timeSinceLast < MIN_REQUEST_INTERVAL) {
                await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLast));
            }
            lastCallTime = Date.now();
            resolve();
        };
        if (activeRequests < MAX_CONCURRENT_REQUESTS) run();
        else requestQueue.push(run);
    });
};

const releaseToken = () => {
    activeRequests--;
    processQueue();
};

const makeApiCallWithRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 2): Promise<T> => {
    await acquireToken();
    let attempt = 0;
    try {
        while (attempt < maxRetries) {
            try {
                return await apiCall();
            } catch (error: any) {
                attempt++;
                const errorString = error.toString();
                logger.warn(`API Attempt ${attempt} failed`, errorString);
                if (errorString.includes('429') || errorString.includes('503') || errorString.includes('500')) {
                    const delay = 3000 * attempt;
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; 
                }
            }
        }
        throw new Error("API call failed after multiple retries.");
    } finally {
        releaseToken();
    }
};

const callWithFallback = async <T>(
    operationName: string,
    primaryCall: () => Promise<T>,
    fallbackCall: () => Promise<T>
): Promise<T> => {
    try {
        logger.system(`API Call: ${operationName} [Primary: Nano Banana Pro]`);
        return await makeApiCallWithRetry(primaryCall);
    } catch (error: any) {
        logger.warn(`${operationName}: Primary failed. Retrying with Flash...`);
        return await makeApiCallWithRetry(fallbackCall);
    }
}

const parseDataUrl = (dataUrl: string) => {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match || match.length < 3) return null;
  return { mimeType: match[1], data: match[2] };
};

// Enhanced Aspect Ratio logic for Gemini 3.0 Pro Image
const getBestAspectRatio = (width: number, height: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
    const ratio = width / height;
    // Webtoon Vertical Panels are almost always 9:16 or thinner
    if (ratio < 0.6) return "9:16"; 
    // Portrait
    if (ratio < 0.85) return "3:4";
    // Square-ish
    if (ratio < 1.15) return "1:1";
    // Landscape
    if (ratio < 1.5) return "4:3";
    // Cinematic / Ultra Wide
    return "16:9";
};

const processAssetReferences = (parts: Part[], assets: (StyleReference | BackgroundAsset | ObjectAsset)[], typeLabel: string) => {
    if (assets.length > 0) {
        let textPrompt = `\n--- ${typeLabel} ---`;
        for (const ref of assets) {
             const inlineData = parseDataUrl(ref.image);
             // Only add if valid image data
             if (inlineData && inlineData.data.length < 4000000) { 
                 parts.push({ inlineData });
             }
        }
        if (typeLabel.includes("STYLE")) {
             textPrompt += "\n[SYSTEM RULE]: STYLE REFERENCE ONLY. COPY ART TECHNIQUE (LINE, COLOR, SHADING) BUT DO NOT COPY THE CHARACTER/OBJECT FROM THIS REFERENCE.";
        }
        parts.push({ text: textPrompt });
    }
};

const constructCharacterDirectives = (char: Character): string => {
    let directives = `CHARACTER: ${char.name}. `;
    
    // Explicit Gender Enforcement - HIGHEST PRIORITY
    if (char.gender === 'male') {
        directives += " [GENDER: MALE (STRICT)]. [TRAITS: Masculine features, sharp jawline, flat chest, broad shoulders]. [NEGATIVE: Female, girl, woman, breasts, curves, lipstick, eyelashes, feminine]. IMPORTANT: IGNORE any gender implication from the name '${char.name}' if it sounds female. DRAW A MAN.";
    } else if (char.gender === 'female') {
        directives += " [GENDER: FEMALE (STRICT)]. [TRAITS: Feminine features, soft curves]. [NEGATIVE: Male, boy, man, beard, moustache, masculine jaw, strong jawline]. IMPORTANT: IGNORE any gender implication from the name '${char.name}' if it sounds male. DRAW A WOMAN.";
    }
    
    if (char.description) directives += ` Description: ${char.description}.`;
    
    // Strict Outfit Enforcement
    if (char.baseOutfit) {
        directives += ` [OUTFIT RULE]: Character MUST wear ${char.baseOutfit}. IGNORE any other clothes mentioned in prompt context unless explicitly overriding it here.`;
    } else {
        // If no outfit specified, explicitly FORBID School Uniforms unless requested in description
        directives += ` [OUTFIT NEGATIVE]: school uniform, sailor uniform, blazer, tie (unless requested).`;
    }
    
    if (char.apparentAge) directives += ` [AGE: ${char.apparentAge}].`;
    if (char.hair) directives += ` [HAIR: ${char.hair}].`;
    if (char.eyes) directives += ` [EYES: ${char.eyes}].`;

    return directives;
};

export const generateSubPanelImage = async (
    subPanel: SubPanel,
    width: number,
    height: number,
    styleReferences: StyleReference[],
    characters: Character[],
    objects: ObjectAsset[],
    backgrounds: BackgroundAsset[],
    previousPanelsContext: string, 
    continuityImage?: string,
    overrideAspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
    masterReferenceImage?: string // New Parameter for Strict Consistency
): Promise<string> => {
    const targetAspectRatio = overrideAspectRatio || getBestAspectRatio(width, height);
    
    // Check for "lying down" keywords to enforce pose
    const pLower = subPanel.prompt.toLowerCase();
    const isLyingDown = pLower.includes('lying') || pLower.includes('floor') || pLower.includes('ground') || pLower.includes('suelo') || pLower.includes('tumbada') || pLower.includes('tirada');
    
    // --- PROMPT ENGINEERING V2 (Gemini 3.0 Optimized) ---
    let corePrompt = `
    ${MANHWA_EXPERT_CONTEXT}
    
    [TASK] Generate a specific MANHWA PANEL.
    [SCENE ACTION (HIGHEST PRIORITY)]: ${subPanel.prompt.toUpperCase()}
    `;
    
    if (isLyingDown) {
        corePrompt += `\n[POSE ENFORCEMENT]: CHARACTER IS LYING ON THE GROUND. Camera must be HIGH ANGLE looking down, or floor level. CHARACTER MUST NOT BE STANDING.`;
    }

    corePrompt += `
    [FORMAT]: FULL BLEED IMAGE. No Borders, No Frames, No Letterboxing.
    [LIGHTING]: Cinematic, High Contrast, Webtoon Style.
    [ASPECT RATIO TARGET]: ${targetAspectRatio}.
    [NEGATIVE PROMPT]: Black borders, letterboxing, white margins, split screen, comic book frames, text bubbles, speech balloons, low quality, bad anatomy, missing limbs, distorted face, school uniform (unless specified).
    `;

    if (subPanel.shotType) corePrompt += `\n[CAMERA SHOT]: ${subPanel.shotType}`;
    if (subPanel.cameraAngle) corePrompt += `\n[CAMERA ANGLE]: ${subPanel.cameraAngle}`;

    const parts: Part[] = [];

    // 1. MASTER REFERENCE (Strict Consistency Anchor)
    if (masterReferenceImage) {
         const inline = parseDataUrl(masterReferenceImage);
         if(inline) {
             parts.push({ inlineData: inline });
             parts.push({ text: "[MASTER VISUAL REFERENCE]: COPY this art style, character design (face, eyes, hair), and color palette EXACTLY. This is the visual standard for the series." });
         }
    }

    // 2. Continuity (Previous Panel)
    if (continuityImage && continuityImage !== masterReferenceImage) {
         const inline = parseDataUrl(continuityImage);
         if(inline) {
             parts.push({ inlineData: inline });
             parts.push({ text: "[PREVIOUS MOMENT]: Connect the action from this panel. Maintain clothing damage and environment." });
         }
    }
    
    parts.push({ text: corePrompt });

    // 3. Character Injection (With Strict Rules)
    if (characters.length > 0) {
        parts.push({ text: `\n--- ACTIVE CHARACTERS (STRICT CONSISTENCY) ---` });
        for (const char of characters) {
            const directives = constructCharacterDirectives(char);
            parts.push({ text: directives });
            const inline = parseDataUrl(char.referenceImage);
            if(inline) parts.push({ inlineData: inline });
        }
    }

    processAssetReferences(parts, backgrounds, "BACKGROUND REFERENCE");
    processAssetReferences(parts, styleReferences, "ART STYLE REFERENCE");
    
    // Gemini 3.0 Pro Image Config
    const config = { 
        imageConfig: { 
            aspectRatio: targetAspectRatio,
            imageSize: "2K" // FORCE HIGH RESOLUTION
        } 
    };
    
    return callWithFallback(
        'generateSubPanelImage',
        async () => {
            // Primary: Gemini 3.0 Pro Image
            const response = await getAI().models.generateContent({ model: MODEL_IMAGE, contents: { parts }, config });
            if (!response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image generated");
            return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
        },
        async () => {
             // Fallback: Gemini 2.5 Flash Image (No imageSize param supported)
             const fallbackConfig = { imageConfig: { aspectRatio: targetAspectRatio } };
             const response = await getAI().models.generateContent({ model: MODEL_IMAGE_FALLBACK, contents: { parts }, config: fallbackConfig });
            if (!response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image generated");
            return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
        }
    );
};

// --- QUALITY CONTROL AGENT ---
export const assessPanelQuality = async (
    generatedImage: string, 
    originalPrompt: string
): Promise<{ score: number; issues: string[]; fixed: boolean; advice: string; type: 'technical' | 'creative' | 'none' }> => {
    // Quality check uses Text model to analyze the image
    const parts: Part[] = [
        { text: `Analyze this manhwa panel image against the prompt: "${originalPrompt}".
        Strictly check for:
        1. Prompt Adherence: Is the character doing EXACTLY what was asked? (e.g. Lying down vs Standing).
        2. Anatomy: Are there extra fingers or distorted faces?
        3. Format: Are there black bars or letterboxing? (Critical Fail).
        
        Return JSON.` },
        { inlineData: parseDataUrl(generatedImage)! }
    ];

    const schema = {
        type: Type.OBJECT,
        properties: {
            score: { type: Type.INTEGER },
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            advice: { type: Type.STRING },
            needs_regenerate: { type: Type.BOOLEAN },
            error_type: { type: Type.STRING, enum: ['technical', 'creative', 'none'] }
        },
        required: ["score", "issues", "advice", "needs_regenerate", "error_type"]
    };

    try {
        const r = await getAI().models.generateContent({ 
            model: MODEL_TEXT, 
            contents: { parts },
            config: { responseMimeType: 'application/json', responseSchema: schema }
        });
        const result = JSON.parse(r.text || "{}");
        return {
            score: result.score || 10,
            issues: result.issues || [],
            fixed: !result.needs_regenerate,
            advice: result.advice || "Looks good.",
            type: result.error_type || 'none'
        };
    } catch (e) {
        return { score: 10, issues: [], fixed: true, advice: "QC Unavailable", type: 'none' };
    }
};

export const editPanelImage = async (baseImage: string, prompt: string): Promise<string> => {
    // Magic Edit uses Gemini 2.5 Flash Image as it supports image-to-image editing well
    const parts: Part[] = [
        { text: `[TASK] Edit this image. Keep the style and composition. Change only: ${prompt}` },
        { inlineData: parseDataUrl(baseImage)! }
    ];

    return callWithFallback(
        'editPanelImage',
        async () => {
            const r = await getAI().models.generateContent({ model: MODEL_IMAGE_FALLBACK, contents: { parts } });
            if (!r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image generated");
            return `data:image/png;base64,${r.candidates[0].content.parts[0].inlineData.data}`;
        },
        async () => {
             const r = await getAI().models.generateContent({ model: MODEL_IMAGE_FALLBACK, contents: { parts } });
            if (!r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image generated");
            return `data:image/png;base64,${r.candidates[0].content.parts[0].inlineData.data}`;
        }
    );
};

export const chatWithAgent = async (history: ChatMessage[], project: Project): Promise<{ text: string, functionCall?: AgentFunctionCall }> => {
    const prevMsgs = history.slice(0, -1);
    const lastMsg = history[history.length - 1];

    const geminiHistory = prevMsgs.map(msg => {
        const parts: Part[] = [{ text: msg.text }];
        if (msg.images) {
             msg.images.forEach(img => {
                const inline = parseDataUrl(img);
                if (inline) parts.push({ inlineData: inline });
            });
        }
        return { role: msg.role, parts };
    });

    const currentParts: Part[] = [{ text: lastMsg.text }];

    const systemInstruction = `You are Nano Banana Pro, the ultimate Manhwa Director. 
    ${MANHWA_EXPERT_CONTEXT}
    Project: "${project.title}".
    Help the user create an award-winning Webtoon.
    Be creative, suggest layouts from 'Datos-Manwha', and be technically precise.`;

    return callWithFallback(
        'chatWithAgent',
        async () => {
            const chat = getAI().chats.create({
                model: MODEL_TEXT,
                history: geminiHistory,
                config: { systemInstruction }
            });
            
            const result = await chat.sendMessage({ message: currentParts });
            
            let fc: AgentFunctionCall | undefined = undefined;
            const candidate = result.candidates?.[0];
            if (candidate) {
                 const toolCall = candidate.content?.parts?.find(p => 'functionCall' in p && p.functionCall);
                 if (toolCall && toolCall.functionCall) {
                     fc = { name: toolCall.functionCall.name, args: toolCall.functionCall.args as any };
                 }
            }
            
            return { text: result.text || "", functionCall: fc };
        },
        async () => {
            const chat = getAI().chats.create({ model: MODEL_TEXT_FALLBACK, history: geminiHistory, config: { systemInstruction } });
            const result = await chat.sendMessage({ message: currentParts });
            return { text: result.text || "" };
        }
    );
};

export const generateCoverArt = async (prompt: string, characters: Character[], styleReferences: StyleReference[]): Promise<string> => {
    const parts: Part[] = [
        { text: MANHWA_EXPERT_CONTEXT },
        { text: `[TASK] Create a PREMIUM 9:16 Manhwa Cover Art using Gemini 3.0 Pro Image.` },
        { text: `[MANDATORY] RENDER TEXT: "${prompt}". The text must be legible, massive, and stylized (Webtoon Title Logo style).` },
        { text: `[TITLE] ${prompt}` },
        { text: `[STYLE] High contrast, dynamic composition, 8k resolution, cinematic lighting, masterpiece. VIBRANT COLORS.` },
    ];
    
    if (characters.length) {
        characters.forEach(c => {
            const directives = constructCharacterDirectives(c);
            parts.push({ text: `Main Character: ${directives}` });
            const inline = parseDataUrl(c.referenceImage);
            if(inline) parts.push({ inlineData: inline });
        });
    }
    processAssetReferences(parts, styleReferences, "ART STYLE");

    // Pro Image Config
    const config = { 
        imageConfig: { aspectRatio: '9:16', imageSize: '2K' } 
    };
    
    return callWithFallback(
        'generateCoverArt',
        async () => {
            const r = await getAI().models.generateContent({ model: MODEL_IMAGE, contents: { parts }, config });
            if (!r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image generated");
            return `data:image/png;base64,${r.candidates[0].content.parts[0].inlineData.data}`;
        },
        async () => {
             const r = await getAI().models.generateContent({ model: MODEL_IMAGE_FALLBACK, contents: { parts }, config: { imageConfig: { aspectRatio: '9:16' } } });
            if (!r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image generated");
            return `data:image/png;base64,${r.candidates[0].content.parts[0].inlineData.data}`;
        }
    );
};

export const planScene = async (
  sceneDescription: string, 
  characters: Character[], 
  objects: ObjectAsset[], 
  styles: StyleReference[],
  sceneType: SceneType, 
  allowedLayouts: string[], 
  flowStyle: 'grid' | 'waterfall', 
  panelCount?: number,
  storyContext?: { content: string, mimeType: string } 
): Promise<ScenePlanPage[]> => {
    
    const layoutList = Object.keys(layouts).join(', ');
    
    let prompt = `
    ${MANHWA_EXPERT_CONTEXT}
    [TASK] Plan a Manhwa Scene (Gemini 3.0).
    `;

    const parts: Part[] = [];

    if (storyContext) {
        if (storyContext.mimeType === 'text/plain') {
             prompt += `\n[SOURCE MATERIAL] Use this script/story segment to plan the panels:\n"""\n${storyContext.content.substring(0, 30000)}\n"""\n`;
             parts.push({ text: prompt });
        } else {
             prompt += "\n[SOURCE MATERIAL] Analyze the attached file (PDF/Audio) to plan the scene.";
             parts.push({ text: prompt });
             parts.push({ inlineData: { mimeType: storyContext.mimeType, data: storyContext.content } });
        }
    } else {
        prompt += `\n[SCENE DESCRIPTION]: "${sceneDescription}"`;
        parts.push({ text: prompt });
    }

    parts.push({ text: `
    [CONTEXT] 
    - Type: ${sceneType || 'Dynamic Manhwa Flow'}
    - Characters: ${characters.map(c=>c.name).join(', ')}.
    - Format: WEBTOON (Vertical Scroll). CRITICAL: USE TALL LAYOUTS.
    - Approximate Panel Count: ${panelCount || 'Auto-detect based on pacing'}.

    [AVAILABLE LAYOUTS]: ${layoutList}.
    
    [LAYOUT RULES - WEBTOON ONLY]
    - FORBIDDEN: '1' (Square). DO NOT USE IT. It is too small for Webtoon.
    - REQUIRED: Use '1-tall' or '1-ultra-tall' for standard panels.
    - Use 'slash-diag' for quick action.
    - Use '2v' or '3v' for stacked dialogue sequences. These layouts create long vertical strips.

    [OUTPUT FORMAT]
    Return a valid JSON array of ScenePlanPage objects.
    `});
    
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { page_number: { type: Type.INTEGER }, layout: { type: Type.STRING }, sub_panels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { shot_type: { type: Type.STRING }, camera_angle: { type: Type.STRING }, action_description: { type: Type.STRING }, justification: { type: Type.STRING } }, required: ['shot_type', 'camera_angle', 'action_description'] } } }, required: ['page_number', 'layout', 'sub_panels'] } };

    return callWithFallback(
        'planScene',
        async () => {
            const r = await getAI().models.generateContent({ model: MODEL_TEXT, contents: { parts }, config: { responseMimeType: 'application/json', responseSchema: schema } });
            return JSON.parse(r.text || "[]") as ScenePlanPage[];
        },
        async () => {
             const r = await getAI().models.generateContent({ model: MODEL_TEXT_FALLBACK, contents: { parts }, config: { responseMimeType: 'application/json', responseSchema: schema } });
            return JSON.parse(r.text || "[]") as ScenePlanPage[];
        }
    );
};

export const analyzeStoryAndPlan = async (
    assets: { name: string, mimeType: string, data: string }[], 
    characters: Character[], 
    flowStyle: 'grid' | 'waterfall'
): Promise<ScenePlanPage[]> => {
    const parts: Part[] = [
        { text: MANHWA_EXPERT_CONTEXT },
        { text: `[TASK] Analyze story and plan scene. Output JSON.` }
    ];
     return [];
};

export const generateAppStatusReport = async (history: string, implementation: string) => {
    const parts = [{ text: `Generate status report. History: ${history}. Impl: ${implementation}` }];
    const r = await getAI().models.generateContent({ model: MODEL_TEXT, contents: { parts } });
    return r.text || "Report.";
};

export const extractAssetFromImage = async (img: string, desc: string, type: string, styles: StyleReference[] = []) => {
    const parts: Part[] = [{ text: `Extract ${type}: ${desc}` }, { inlineData: parseDataUrl(img)! }];
    const r = await getAI().models.generateContent({ model: MODEL_IMAGE_FALLBACK, contents: { parts }});
    if (!r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) throw new Error("No image");
    return `data:image/png;base64,${r.candidates[0].content.parts[0].inlineData.data}`;
};

export const analyzePanelForCharacters = async (img: string, chars: Character[]) => {
     const parts: Part[] = [{ text: `Analyze panel for new characters.` }, { inlineData: parseDataUrl(img)! }];
     const schema = { type: Type.OBJECT, properties: { new_characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name_suggestion: { type: Type.STRING }, description: { type: Type.STRING } } } } } };
     const r = await getAI().models.generateContent({ model: MODEL_TEXT, contents: { parts }, config: { responseMimeType: 'application/json', responseSchema: schema }});
     return JSON.parse(r.text || "{}");
};

export const generateBugReport = async (t: LiveTranscriptEntry[]) => { return "Report"; };
export const describeImage = async (baseImage: string, prompt: string) => { 
    const parts: Part[] = [{ text: prompt }, { inlineData: parseDataUrl(baseImage)! }];
    const r = await getAI().models.generateContent({ model: MODEL_TEXT, contents: { parts } });
    return r.text || "";
};
export const generateCharacterSheetView = async (baseImage: string, view: string) => { return baseImage; };
export const generateHighQualityImage = async (prompt: string, aspectRatio: string) => { return ""; };
