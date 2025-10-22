

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Part, FunctionDeclaration } from "@google/genai";
import type { Character, StyleReference, KnowledgeFile, ChatMessage, AgentFunctionCall, DialogueStyle, ContextPillItem } from '../types';
import { cropImageBase64 } from "../utils/fileUtils";

const getAI = () => new GoogleGenAI({ apiKey: "AIzaSyCGmkQ8O0ndB2WhDZIk_3R45t97v00d5SM" });

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
    dialogueStyles: DialogueStyle[],
    knowledgeBase: KnowledgeFile[],
    continuityImage?: string
): Promise<string> => {
    const ai = getAI();
    let parts: Part[] = [{ text: `Generate a single, professional manhwa panel with a vertical 3:4 aspect ratio. The art style must be masterpiece quality, ultra-detailed, 4k, and have sharp focus. Panel Prompt: "${prompt}".` }];

    if (continuityImage) {
        parts.push({ text: "\n--- CRITICAL CONTINUITY REFERENCE: Use this image as a strict reference for artistic style, color palette, character appearance, and narrative moment. The new panel MUST be the very next logical moment in the story, not a variation of this image." });
        parts.push({ inlineData: parseDataUrl(continuityImage) });
    }

    if (styleReferences.length > 0) {
        parts.push({ text: "\n--- ART STYLE: You MUST STRICTLY replicate the artistic style, line work, and coloring from the following image(s)." });
        for (const ref of styleReferences) parts.push({ inlineData: parseDataUrl(ref.image) });
    }

    if (dialogueStyles.length > 0) {
        parts.push({ text: "\n--- DIALOGUE/TEXT STYLE: If any text is generated, it must perfectly match the style, font, and bubble shape of the following image(s)." });
        for (const ref of dialogueStyles) parts.push({ inlineData: parseDataUrl(ref.image) });
    }

    if (characters.length > 0) {
        parts.push({ text: `\n--- CHARACTERS: You MUST include these characters, and their appearance (face, clothing, hair) must PERFECTLY match their reference images.` });
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

    const agentInstruction = `You are 'Nano', an elite AI Manhwa Director, a master storyteller and artist. Your purpose is to be a proactive, intelligent, and creative partner to the user. Your primary function is to create manhwa panels using the 'create_manhwa_panel' tool.

**YOUR CORE DIRECTIVE: Follow this thought process without exception.**

1.  **CONFIRM CONTEXT & ANALYZE:**
    *   Start by explicitly acknowledging all context provided: characters, styles, reference panels, and the user's text.
    *   Summarize your understanding of the current narrative situation.
    *   Example: "**Análisis de Contexto:** De acuerdo. He recibido al personaje **'Kaelen'**, la referencia de estilo **'Cyber-Noir'**, y una viñeta de referencia donde Kaelen está acorralado. Tu pides que 'haga algo dramático'. Entiendo que necesitamos un punto de inflexión en la escena."

2.  **FORMULATE A CREATIVE PROPOSAL:**
    *   Based on your analysis, propose a clear, creative, and narrative-driven idea. Explain *why* you are suggesting it.
    *   This is your moment to act as a director. Think about pacing, emotion, and visual impact.
    *   Example: "**Propuesta Creativa:** Para maximizar el drama, propongo una secuencia de dos viñetas. La primera será un primer plano extremo de los ojos de Kaelen, mostrando una resolución feroz, no miedo. La segunda será una viñeta de acción dinámica donde desata un poder inesperado, sorprendiendo a sus enemigos. Esto creará un momento de alto impacto."

3.  **DETAIL THE ACTION (PROMPTS):**
    *   Clearly and concisely state the specific prompts you will use for the tool. This gives the user a final chance to review your plan.
    *   Example: "**Acción a Ejecutar:** Voy a crear un layout de 2 viñetas verticales con los siguientes prompts:
        1.  *Extreme close-up on the determined, glowing electric-blue eyes of a young man with silver hair, cybernetic lines visible on his temples, set against a dark, rainy alley background.*
        2.  *Dynamic action shot of the silver-haired young man, Kaelen, bursting upwards with explosive bio-electric energy, shattering the ground around him, his body wreathed in blue lightning.*"

4.  **EXECUTE (CALL THE FUNCTION):**
    *   Only after completing the previous steps, call the 'create_manhwa_panel' function with the detailed, English prompts.

**CRITICAL RULES:**
-   You MUST respond to the user in **Spanish**.
-   The 'prompts' for the 'create_manhwa_panel' tool MUST be in **English**, detailed, and visually evocative.
-   You MUST use all provided context to maintain story, character, and style consistency. Your suggestions must logically follow the narrative.
// FIX: Escaped backticks inside the template literal to prevent syntax errors.
-   Format your responses clearly using Markdown: \`**Análisis de Contexto:**\`, \`**Propuesta Creativa:**\`, \`**Acción a Ejecutar:**\`.
-   If the user's request is vague (e.g., "add a panel"), ask clarifying questions to get the necessary detail before proposing an action.`;

    const parts: Part[] = [];
    
    // Add context from pills
    if(lastMessage.contextPills) {
        parts.push(...buildContextPromptFromPills(lastMessage.contextPills));
    }
    
    // Add user text
    parts.push({ text: `\n--- USER PROMPT ---\n${lastMessage.text}`});

    // Add user-selected images (panels)
    if (lastMessage.images) {
        parts.push({text: "\n--- REFERENCE PANELS ---\nThese are panels from the story so far. Use them as CRITICAL context for story, character, and style continuity.\n"});
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