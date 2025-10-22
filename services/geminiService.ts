
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Part, FunctionDeclaration } from "@google/genai";
import type { Character, StyleReference, KnowledgeFile, ChatMessage, AgentFunctionCall, DialogueStyle, ContextPillItem } from '../types';
import { cropImageBase64 } from "../utils/fileUtils";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match || match.length < 3) throw new Error("Invalid data URL");
  return { mimeType: match[1], data: match[2] };
};

const buildContextPromptFromPills = (pills: ContextPillItem[]): Part[] => {
    const parts: Part[] = [];
    if (pills.length === 0) return parts;
    
    parts.push({text: "\n--- CONTEXTUAL REFERENCES ---\n"});
    for (const pill of pills) {
        switch (pill.type) {
            case 'character':
                parts.push({text: `Character Name: ${pill.name}\nDescription: ${pill.description}\n`});
                parts.push({inlineData: parseDataUrl(pill.referenceImage)});
                break;
            case 'style':
                parts.push({text: `Art Style Reference: ${pill.name}\n`});
                parts.push({inlineData: parseDataUrl(pill.image)});
                break;
            case 'dialogue':
                 parts.push({text: `Dialogue/Text Style Reference: ${pill.name}\n`});
                 parts.push({inlineData: parseDataUrl(pill.image)});
                 break;
            case 'knowledge':
                parts.push({text: `Knowledge File: ${pill.name}\nContent: ${pill.content}\n`});
                break;
        }
    }
    parts.push({text: "\n--- END CONTEXT ---\n"});
    return parts;
};

export const generateManhwaPanel = async (
    prompt: string,
    styleReferences: StyleReference[],
    characters: Character[],
    knowledgeBase: KnowledgeFile[]
): Promise<string> => {
    const ai = getAI();
    let parts: Part[] = [{ text: `Generate a single, dynamic manhwa panel. Style: masterpiece quality, ultra-detailed, 4k, sharp focus, professional manhwa art. Prompt: "${prompt}".` }];

    if (styleReferences.length > 0) {
        parts.push({ text: "\n--- ART STYLE: Strictly match the style of the following image(s)." });
        for (const ref of styleReferences) parts.push({ inlineData: parseDataUrl(ref.image) });
    }

    if (characters.length > 0) {
        parts.push({ text: `\n--- CHARACTERS: Include these characters, matching their appearance from the references.` });
        for (const char of characters) {
            parts.push({ text: `Character: ${char.name} (${char.description})` });
            parts.push({ inlineData: parseDataUrl(char.referenceImage) });
        }
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated");
};

export const generateCharacterImage = async (description: string, refImg: string): Promise<string> => {
    const ai = getAI();
    const parts: Part[] = [
        { inlineData: parseDataUrl(refImg) },
        { text: `Use the provided image as a strict reference for the character's appearance, face, and clothing, to generate a professional, masterpiece quality, ultra-detailed, 4k manhwa-style 360-degree character turnaround sheet (front, 3/4, side, back views). Style: Clean, modern manhwa, sharp details. Background: plain white. Description: "${description}"` }
    ];
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No character image generated");
};

const createPanelTool: FunctionDeclaration = {
    name: 'create_manhwa_panel',
    description: 'Creates a new manhwa panel or a layout of panels and adds it to the current chapter. This is the only way to create new images.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            layout_type: { type: Type.STRING, enum: ['1', '2v', '2h', '3v', '3s', '4g'], description: "Type of panel layout. '1' for single panel, '2v' for 2 vertical, '2h' for 2 horizontal, etc. Defaults to '1'."},
            prompts: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'One or more detailed, vivid descriptions for each sub-panel in the layout. Must be in English.' },
            character_names: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Names of characters present in the panel(s).' },
        },
        required: ['prompts'],
    },
};

export const chatWithAgent = async (
    history: ChatMessage[],
    isAgentMode: boolean,
): Promise<{ text: string; functionCall?: AgentFunctionCall }> => {
    const ai = getAI();
    const lastMessage = history[history.length - 1];
    
    if (!isAgentMode) {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: lastMessage.text }] },
            config: { systemInstruction: `You are 'Nano', a friendly AI assistant in a manhwa creation app. Chat casually and briefly with the user. Respond in Spanish.` }
        });
        return { text: response.text };
    }

    const agentInstruction = `You are 'Nano', an expert AI manhwa editor. Your purpose is to help the user create their story. You are proactive and creative.
- The user will provide you with text, images of previous panels, and context about their project via context pills.
- Analyze everything to understand the story, characters, and style.
- Your main tool is 'create_manhwa_panel'. You can and should call this function to suggest and create new panels that logically continue the story.
- When you propose a new panel, first describe your idea, then call the function. The prompts for the function MUST be in English and very descriptive.
- All your responses MUST be in Spanish. Format important terms in **bold** markdown.
- When the user provides context (e.g., from a Character pill), acknowledge you have received it and will use it.`;

    const parts: Part[] = [];
    
    // Add context from pills
    if(lastMessage.contextPills) {
        parts.push(...buildContextPromptFromPills(lastMessage.contextPills));
    }
    
    // Add user text
    parts.push({ text: `\n--- USER PROMPT ---\n${lastMessage.text}`});

    // Add user-selected images (panels)
    if (lastMessage.images) {
        parts.push({text: "\n--- REFERENCE PANELS ---\n"});
        for (const imgBase64 of lastMessage.images) {
            parts.push({ inlineData: parseDataUrl(imgBase64) });
        }
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts },
        config: {
            systemInstruction: agentInstruction,
            tools: [{ functionDeclarations: [createPanelTool] }]
        }
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) return { text: "No response from model." };

    let text = "";
    let functionCall: AgentFunctionCall | undefined = undefined;

    for(const part of candidate.content.parts) {
        if(part.text) text += part.text;
        if(part.functionCall) {
            functionCall = { name: part.functionCall.name, args: part.functionCall.args };
        }
    }
    
    return { text, functionCall };
};

export const generateCoverArt = async (
    prompt: string,
    characters: Character[],
    styleReferences: StyleReference[]
): Promise<{ full: string; preview: string }> => {
    const ai = getAI();
    const parts: Part[] = [{ text: `Create a professional, masterpiece quality, ultra-detailed, 4k, 9:16 vertical manhwa cover art with sharp details. The title of the manhwa is optional but can be included. Prompt: "${prompt}"` }];

    if (styleReferences.length > 0) {
        parts.push({ text: "\n--- ART STYLE: Strictly match the style of the following image(s)." });
        for (const ref of styleReferences) parts.push({ inlineData: parseDataUrl(ref.image) });
    }
    
    if (characters.length > 0) {
        parts.push({ text: `\n--- CHARACTERS: Base the characters' appearance STRICTLY on these references.` });
        for (const char of characters) {
            parts.push({ text: `Character: ${char.name}` });
            parts.push({ inlineData: parseDataUrl(char.referenceImage) });
        }
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            const fullImage = `data:image/png;base64,${part.inlineData.data}`;
            const previewImage = await cropImageBase64(fullImage, 3 / 4);
            return { full: fullImage, preview: previewImage };
        }
    }
    throw new Error("No cover art generated");
};