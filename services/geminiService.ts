import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Part, FunctionDeclaration } from "@google/genai";
import type { Panel, Character, StyleReference, KnowledgeFile, ChatMessage, AgentFunctionCall, DialogueStyle, ContextPillItem, Project, ScenePlanPage, ObjectAsset, SceneType, BackgroundAsset, NewEntityAnalysis, NewObjectEntity, CharacterAnalysis, LiveTranscriptEntry, SubPanel } from '../types';
import { compressImageBase64, cropImageBase64 } from "../utils/fileUtils";
import { showToast } from "../systems/uiSystem";
import { SOURCE_CODE_CONTEXT } from "../utils/codeContext";
import { MANHWA_EXPERT_CONTEXT } from "../utils/manhwaContext";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- MODELS ---
// Explicitly using Gemini 3.0 Pro (Nano Banana Pro)
const MODEL_TEXT = 'gemini-3-pro-preview';
const MODEL_IMAGE = 'gemini-3-pro-image-preview';

// Fallbacks only used in dire cases (404/403 if Pro fails completely)
const MODEL_TEXT_FALLBACK = 'gemini-2.5-flash';
const MODEL_IMAGE_FALLBACK = 'gemini-2.5-flash-image';

// --- RATE LIMITING & THROTTLING ---
// Global variables to manage request traffic
let lastCallTime = 0;
const MIN_REQUEST_INTERVAL = 1200; // ms between API calls to prevent burst rate limits
const MAX_CONCURRENT_REQUESTS = 3; // Hard limit on internal active requests
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
            // Throttle: Wait if the last call was too recent
            const now = Date.now();
            const timeSinceLast = now - lastCallTime;
            if (timeSinceLast < MIN_REQUEST_INTERVAL) {
                await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLast));
            }
            lastCallTime = Date.now();
            resolve();
        };

        if (activeRequests < MAX_CONCURRENT_REQUESTS) {
            run();
        } else {
            requestQueue.push(run);
        }
    });
};

const releaseToken = () => {
    activeRequests--;
    processQueue();
};

declare global {
    interface Window {
        hasShownFallbackToast?: boolean;
    }
}

// Retry logic for robust API calls
const makeApiCallWithRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 4): Promise<T> => {
    await acquireToken();
    
    let attempt = 0;
    try {
        while (attempt < maxRetries) {
            try {
                const result = await apiCall();
                return result;
            } catch (error: any) {
                attempt++;
                const errorString = error.toString();
                
                // Check for Rate Limits (429) or Overloaded (503)
                const isRateLimit = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');
                const isOverloaded = errorString.includes('503') || errorString.toLowerCase().includes('overloaded');
                
                // Fail fast on Permission Denied or Not Found (unless we want fallback to handle it)
                if (errorString.includes('403') || errorString.includes('PERMISSION_DENIED')) {
                    throw new Error("Permission Denied: Access to Gemini 3.0 Pro models is restricted. Please verify your API Key billing status.");
                }
                
                if (errorString.includes('404') || errorString.includes('NOT_FOUND')) {
                     throw new Error("Model Not Found: The requested Pro model is not available for this API key.");
                }

                const isRetryable = isRateLimit || isOverloaded || errorString.includes('500') || errorString.includes('Deadline expired');

                if (isRetryable && attempt < maxRetries) {
                    // Exponential Backoff with Jitter: 2s, 4s, 8s...
                    const baseDelay = isRateLimit ? 3000 : 1000; // Longer wait for rate limits
                    const delay = (baseDelay * Math.pow(2, attempt - 1)) + (Math.random() * 1000);
                    
                    const attemptMsg = `Nano Pro is busy. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${maxRetries})`;
                    console.warn(attemptMsg);
                    // Only show toast on the first retry to avoid spam
                    if (attempt === 1) showToast(attemptMsg, 'info');
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    if (errorString.includes('400')) {
                        console.error("Bad Request (400). Check input image formats.");
                        throw new Error(`Generation failed: Invalid input or blocked content. (${error.message})`);
                    }
                    throw error; 
                }
            }
        }
        throw new Error("API call failed after multiple retries.");
    } finally {
        releaseToken();
    }
};

// Helper to handle Pro -> Flash fallback
const callWithFallback = async <T>(
    operationName: string,
    primaryCall: () => Promise<T>,
    fallbackCall: () => Promise<T>
): Promise<T> => {
    try {
        return await makeApiCallWithRetry(primaryCall);
    } catch (error: any) {
        const isPermissionError = error.message.includes('Permission Denied') || error.message.includes('403') || error.message.includes('Model Not Found') || error.message.includes('404');
        
        if (isPermissionError) {
            if (!window.hasShownFallbackToast) {
                 showToast("Nano Pro unavailable (Access Denied). Falling back to standard mode.", 'info');
                 window.hasShownFallbackToast = true;
                 setTimeout(() => { window.hasShownFallbackToast = false; }, 5000);
            }
            console.warn(`${operationName}: Pro model failed. Falling back to Flash models.`);
            return await makeApiCallWithRetry(fallbackCall);
        }
        throw error;
    }
}

const parseDataUrl = (dataUrl: string) => {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
      if (dataUrl && (dataUrl.startsWith('PLACEHOLDER:') || dataUrl.includes('svg+xml'))) return null;
      return null; 
  }
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match || match.length < 3) {
       return null;
  }
  return { mimeType: match[1], data: match[2] };
};

const getBestAspectRatio = (width: number, height: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
    const ratio = width / height;
    if (ratio >= 1.7) return "16:9"; 
    if (ratio >= 1.3) return "4:3";  
    if (ratio >= 0.9 && ratio <= 1.1) return "1:1"; 
    if (ratio <= 0.6) return "9:16"; 
    return "3:4"; 
};

export const generateSpeech = async (text: string): Promise<string> => {
    return makeApiCallWithRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts', 
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio generated from TTS service.");
        }
        return base64Audio;
    });
};

const characterToPromptString = (character: Character): string => {
    const parts: string[] = [character.description];
    if (character.apparentAge) parts.push(`- Apparent Age: ${character.apparentAge}`);
    if (character.heightAndComplexion) parts.push(`- Height & Complexion: ${character.heightAndComplexion}`);
    if (character.face) parts.push(`- Face: ${character.face}`);
    if (character.eyes) parts.push(`- Eyes: ${character.eyes}`);
    if (character.hair) parts.push(`- Hair: ${character.hair}`);
    if (character.skin) parts.push(`- Skin: ${character.skin}`);
    if (character.uniqueFeatures) parts.push(`- Unique Features: ${character.uniqueFeatures}`);
    if (character.baseOutfit) parts.push(`- Base Outfit: ${character.baseOutfit}`);
    if (character.accessories) parts.push(`- Accessories: ${character.accessories}`);
    return parts.join('\n');
}

const processAssetReferences = (parts: Part[], assets: (StyleReference | BackgroundAsset | ObjectAsset)[], typeLabel: string) => {
    if (assets.length > 0) {
        let textPrompt = `\n--- ${typeLabel} ---`;
        let hasVisuals = false;
        
        for (const ref of assets) {
            if (ref.image.startsWith('PLACEHOLDER:')) {
                const styleName = ref.image.split(':')[1].replace(/_/g, ' ');
                textPrompt += `\n- Apply the visual style of: ${styleName}`;
            } else {
                const inlineData = parseDataUrl(ref.image);
                if (inlineData) {
                    parts.push({ inlineData });
                    hasVisuals = true;
                }
            }
        }
        
        if (typeLabel.includes("STYLE")) {
             textPrompt += "\n[NEGATIVE CONSTRAINT]: These images are for ART STYLE ONLY (line weight, shading, coloring). DO NOT copy the characters, people, composition, or objects from these reference images. Create COMPLETELY NEW content based on the text prompt, but rendered in this art style.";
        }
        
        parts.push({ text: textPrompt + (hasVisuals ? "\n(Use the attached images as visual reference)" : "") });
    }
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
    continuityImage?: string
): Promise<string> => {
    const targetAspectRatio = getBestAspectRatio(width, height);
    const styleKeywords = "Modern professional manhwa/webtoon style. High quality, clean line art, detailed facial features, masterpiece, ultra-detailed, 4k, sharp focus.";

    let promptDetails = `[SCENE ACTION] ${subPanel.prompt}`;
    if (subPanel.shotType) promptDetails = `[SHOT TYPE] ${subPanel.shotType}, ` + promptDetails;
    if (subPanel.cameraAngle) promptDetails = `[CAMERA ANGLE] ${subPanel.cameraAngle}, ` + promptDetails;

    const parts: Part[] = [];
    
    if (continuityImage) {
         const inline = parseDataUrl(continuityImage);
         if(inline) {
             parts.push({ inlineData: inline });
             parts.push({ text: "[VISUAL CONTINUITY] The image above is the PREVIOUS panel. The new image must follow this scene visually. Maintain character appearance and environmental consistency exactly, but progress the action according to the prompt." });
         }
    }

    if (previousPanelsContext) {
        parts.push({ text: `[STORY MEMORY] Previous events:\n${previousPanelsContext}` });
    }

    let corePrompt = `[TASK] Create a manhwa sub-panel. \n[TARGET STYLE] ${styleKeywords}\n[CURRENT PANEL PROMPT] ${promptDetails}`;
    parts.push({ text: corePrompt });

    processAssetReferences(parts, backgrounds, "BACKGROUND / SETTING");
    processAssetReferences(parts, styleReferences, "ART STYLE REFERENCE");
    
    if (characters.length > 0) {
        parts.push({ text: `\n--- ACTIVE CHARACTERS ---` });
        for (const char of characters) {
            parts.push({ text: `\n[CHARACTER]: ${char.name}\n${characterToPromptString(char)}` });
            if (!char.referenceImage.startsWith('PLACEHOLDER:')) {
                 const inline = parseDataUrl(char.referenceImage);
                 if(inline) parts.push({ inlineData: inline });
            }
        }
    }

    return callWithFallback(
        'generateSubPanelImage',
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE,
                contents: { parts },
                config: { 
                    responseModalities: [Modality.IMAGE],
                    imageConfig: { aspectRatio: targetAspectRatio, imageSize: '2K' }
                },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No image generated by Gemini 3.0 Pro.");
        },
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE_FALLBACK,
                contents: { parts },
                config: { 
                    responseModalities: [Modality.IMAGE],
                    imageConfig: { aspectRatio: targetAspectRatio }
                },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No image generated by Gemini 2.5 Flash.");
        }
    );
};

export const editPanelImage = async (base64Image: string, prompt: string): Promise<string> => {
    const inlineData = parseDataUrl(base64Image);
    if (!inlineData) throw new Error("Invalid base image for editing.");

    const parts: Part[] = [
        { inlineData },
        { text: `Edit instructions: ${prompt}. Maintain the original style and characters.` }
    ];

    return callWithFallback(
        'editPanelImage',
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { imageSize: '2K' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No edited image generated by Gemini 3.0 Pro.");
        },
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE_FALLBACK,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE] },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No edited image generated by Gemini 2.5 Flash.");
        }
    );
};

export const describeImage = async (base64Image: string, contextPrompt?: string): Promise<string> => {
    const inlineData = parseDataUrl(base64Image);
    if (!inlineData) throw new Error("Invalid base image for analysis.");

    const parts: Part[] = [
        { inlineData },
        { text: contextPrompt || "Describe this image." }
    ];

    return callWithFallback(
        'describeImage',
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_TEXT,
                contents: { parts },
            });
            return response.text || "";
        },
        async () => {
             const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_TEXT_FALLBACK,
                contents: { parts },
            });
            return response.text || "";
        }
    );
};

export const generateCharacterSheetView = async (characterImage: string, view: 'front' | 'side' | 't_pose' | 'face' | 'accessories'): Promise<string> => {
    const viewDescriptions: Record<typeof view, string> = {
        front: 'Full-body front view.',
        side: 'Full-body side view.',
        t_pose: 'Full-body T-pose.',
        face: "Detailed face close-up.",
        accessories: "Accessories view."
    };

    const prompt = `Generate the '${view}' view. ${viewDescriptions[view]} Style: Manhwa character sheet. White background.`;
    const parts: Part[] = [ { text: prompt } ];
    
    const inline = parseDataUrl(characterImage);
    if(inline) parts.push({ inlineData: inline });

    return callWithFallback(
        'generateCharacterSheetView',
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { imageSize: '2K', aspectRatio: '3:4' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No character sheet view generated.");
        },
        async () => {
             const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE_FALLBACK,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: '3:4' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No character sheet view generated.");
        }
    );
};


// --- AGENT TOOLS ---
const createPanelTool: FunctionDeclaration = {
    name: 'create_manhwa_panel',
    description: "Creates a new manhwa panel layout.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            layout_type: { type: Type.STRING, enum: ['1', '2v', '2h', '3v', '3h', '4g', 'l-shape', 'reverse-l', '1-top-3-bottom', '1-left-3-right', 'complex-5'] },
            prompts: { type: Type.ARRAY, items: { type: Type.STRING } },
            character_names: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['layout_type', 'prompts'],
    },
};

const fillPanelsTool: FunctionDeclaration = {
    name: 'fill_manhwa_panels',
    description: 'Generates content for existing empty panels.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            targets: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        sub_panel_id: { type: Type.STRING },
                        prompt: { type: Type.STRING },
                        shot_type: { type: Type.STRING, enum: ["Establishing Shot", "Full Shot", "Medium Shot", "Close-up", "Extreme Close-up"] },
                        camera_angle: { type: Type.STRING, enum: ["Normal Angle", "High Angle", "Low Angle", "Dutch Angle"] },
                    },
                    required: ['sub_panel_id', 'prompt'],
                }
            },
            character_names: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['targets'],
    },
};

const editPanelTool: FunctionDeclaration = {
    name: 'edit_panel_image',
    description: 'Edits a panel image.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            sub_panel_id: { type: Type.STRING },
            edit_prompt: { type: Type.STRING },
        },
        required: ['sub_panel_id', 'edit_prompt'],
    },
};

export const chatWithAgent = async (
    history: ChatMessage[],
    project: Project,
): Promise<{ text: string; functionCall?: AgentFunctionCall }> => {
    const lastMessage = history[history.length - 1];
    const parts: Part[] = [{ text: `System: ${MANHWA_EXPERT_CONTEXT}` }];
    
    parts.push({text: `Project: ${project.title}`});
    project.characters.forEach(c => parts.push({text: `Char: ${c.name}, ${c.description}`}));
    parts.push({text: `User: ${lastMessage.text}`});

    if (lastMessage.images && lastMessage.images.length > 0) {
        lastMessage.images.forEach(img => {
             const inline = parseDataUrl(img);
             if(inline) parts.push({ inlineData: inline });
        });
    }

    const processResponse = (response: any) => {
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) return { text: "No response." };
        let text = "";
        let functionCall;
        for(const part of candidate.content.parts) {
            if(part.text) text += part.text;
            if(part.functionCall) functionCall = { name: part.functionCall.name, args: part.functionCall.args };
        }
        return { text, functionCall };
    };

    return callWithFallback(
        'chatWithAgent',
        async () => {
            const ai = getAI();
             const response = await ai.models.generateContent({
                model: MODEL_TEXT,
                contents: { parts },
                config: {
                    systemInstruction: "You are Nano Banana Pro, an expert manhwa assistant using Gemini 3.0 Pro. Respond in Spanish.",
                    tools: [{ functionDeclarations: [createPanelTool, fillPanelsTool, editPanelTool] }],
                }
            });
            return processResponse(response);
        },
        async () => {
             const ai = getAI();
             const response = await ai.models.generateContent({
                model: MODEL_TEXT_FALLBACK,
                contents: { parts },
                config: {
                    systemInstruction: "You are Nano (Standard), an expert manhwa assistant. Respond in Spanish.",
                    tools: [{ functionDeclarations: [createPanelTool, fillPanelsTool, editPanelTool] }],
                }
            });
            return processResponse(response);
        }
    );
};

export const generateCoverArt = async (
    prompt: string,
    characters: Character[],
    styleReferences: StyleReference[],
): Promise<string> => {
    const parts: Part[] = [{ text: `Create a 9:16 manhwa cover art. ${prompt} Style: Professional Manhwa.` }];
    
    if (characters.length > 0) {
        parts.push({ text: `\n--- CHARACTERS TO FEATURE ---` });
        for (const char of characters) {
            parts.push({ text: `\n[CHARACTER]: ${char.name}\n${char.description}` });
            if (!char.referenceImage.startsWith('PLACEHOLDER:')) {
                 const inline = parseDataUrl(char.referenceImage);
                 if(inline) parts.push({ inlineData: inline });
            }
        }
    }

    processAssetReferences(parts, styleReferences, "STYLE");
    
    return callWithFallback(
        'generateCoverArt',
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: '9:16', imageSize: '2K' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No cover art generated.");
        },
        async () => {
             const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_IMAGE_FALLBACK,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: '9:16' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            throw new Error("No cover art generated.");
        }
    );
};

export const planScene = async (
  sceneDescription: string,
  characters: Character[],
  objects: ObjectAsset[],
  styleReferences: StyleReference[],
  sceneType: SceneType,
  allowedLayouts: string[],
  flowStyle: 'grid' | 'waterfall',
  panelCount?: number
): Promise<ScenePlanPage[]> => {
    const prompt = `Plan a scene: "${sceneDescription}". Type: ${sceneType}. Characters: ${characters.map(c=>c.name).join(', ')}. Return JSON array of pages with layouts and subpanels.`;
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                page_number: { type: Type.INTEGER },
                layout: { type: Type.STRING },
                sub_panels: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            shot_type: { type: Type.STRING },
                            camera_angle: { type: Type.STRING },
                            action_description: { type: Type.STRING },
                            justification: { type: Type.STRING },
                        },
                        required: ['shot_type', 'camera_angle', 'action_description', 'justification'],
                    },
                },
            },
            required: ['page_number', 'layout', 'sub_panels'],
        },
    };

     return callWithFallback(
         'planScene',
        async () => {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_TEXT,
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                }
            });
            return JSON.parse(response.text) as ScenePlanPage[];
         },
         async () => {
             const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_TEXT_FALLBACK,
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                }
            });
            return JSON.parse(response.text) as ScenePlanPage[];
         }
     );
};

export const analyzeStoryAndPlan = async (
    storyAssets: { mimeType: string; data: string }[],
    characters: Character[],
    flowStyle: 'grid' | 'waterfall'
): Promise<ScenePlanPage[]> => {
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                page_number: { type: Type.INTEGER },
                layout: { type: Type.STRING },
                sub_panels: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            shot_type: { type: Type.STRING },
                            camera_angle: { type: Type.STRING },
                            action_description: { type: Type.STRING },
                            justification: { type: Type.STRING },
                        },
                        required: ['shot_type', 'camera_angle', 'action_description', 'justification'],
                    },
                },
            },
            required: ['page_number', 'layout', 'sub_panels'],
        },
    };

    const parts: Part[] = [
        { text: `You are a professional Manhwa Director. Analyze the provided story materials (text, audio scripts, or storyboard sketches). 
        
        Create a complete visual plan for this chapter.
        1. Identify which known characters appear (Known Characters: ${characters.map(c => c.name).join(', ')}).
        2. Structure the story into pages/panels using the ${flowStyle} flow.
        3. If audio is provided, transcribe the key plot points and convert them into visual scenes.
        ` }
    ];

    // Add multimodal assets (PDF pages, Audio clips, Images)
    storyAssets.forEach(asset => {
        parts.push({ inlineData: { mimeType: asset.mimeType, data: asset.data } });
    });

    return callWithFallback(
        'analyzeStoryAndPlan',
        async () => {
             const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_TEXT,
                contents: { parts },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                }
            });
            return JSON.parse(response.text) as ScenePlanPage[];
        },
        async () => {
             // Fallback likely won't handle heavy multimodal well, but we try.
             const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_TEXT_FALLBACK,
                contents: { parts },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                }
            });
            return JSON.parse(response.text) as ScenePlanPage[];
        }
    );
};


export const generateAppStatusReport = async (a: string, b: string) => "Report generated.";
export const analyzePanelForNewEntities = async (a: string, b: string, c: Character[], d: ObjectAsset[]) => ({new_characters: [], new_objects: []});
export const extractAssetFromImage = async (img: string, desc: string, type: string, styles: StyleReference[] = []) => img;
export const analyzePanelForCharacters = async (img: string, chars: Character[]) => ({new_characters: []});
export const generateBugReport = async (t: LiveTranscriptEntry[]) => "Bug report.";

export const generateHighQualityImage = async (prompt: string, ar: string) => {
    const parts: Part[] = [{ text: `Create image: ${prompt}. Aspect Ratio: ${ar}` }];
    return callWithFallback(
        'generateHighQualityImage',
        async () => {
             const ai = getAI();
             const response = await ai.models.generateContent({
                model: MODEL_IMAGE,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { imageSize: '2K', aspectRatio: ar === '1:1' ? '1:1' : '3:4' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            return "";
        },
        async () => {
             const ai = getAI();
             const response = await ai.models.generateContent({
                model: MODEL_IMAGE_FALLBACK,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: ar === '1:1' ? '1:1' : '3:4' } },
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
            return "";
        }
    );
};