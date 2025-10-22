
export interface SubPanel {
  id: string;
  prompt: string;
  characterIds: string[];
  styleReferenceIds?: string[];
  dialogueStyleIds?: string[];
  continuitySubPanelId?: string | null;
  imageUrl: string | null;
  content?: string; // For text bubbles, etc.
}

export interface DialogueBubble {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}


export interface Panel {
    id: string;
    layout: number[][]; 
    subPanels: SubPanel[];
    dialogueBubbles: DialogueBubble[];
}

export interface Chapter {
  id: string;
  title: string;
  panels: Panel[];
}

export interface Character {
  id:string;
  name: string;
  description: string;
  referenceImage: string; // base64
}

export interface StyleReference {
  id: string;
  name: string;
  image: string; // base64
}

export interface DialogueStyle {
  id: string;
  name: string;
  image: string; // base64
}

export interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
}

export interface Settings {
    pageWidth: number; // in pixels
    panelSpacing: number; // in pixels
}

export interface AgentFunctionCall {
    name: string;
    args: { [key: string]: any };
}

export type ContextPillItem = (Character & { type: 'character' }) | 
                             (StyleReference & { type: 'style' }) |
                             (DialogueStyle & { type: 'dialogue' }) |
                             (KnowledgeFile & { type: 'knowledge' });


export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    images?: string[]; // base64 encoded images for multimodal context
    contextPills?: ContextPillItem[];
    functionCall?: AgentFunctionCall;
}

export interface Project {
  id: string;
  title: string;
  coverImage: string; // Full 9:16 image
  coverImagePreview: string; // Cropped preview
  chapters: Chapter[];
  characters: Character[];
  styleReferences: StyleReference[];
  dialogueStyles: DialogueStyle[];
  knowledgeBase: KnowledgeFile[];
  settings: Settings;
  agentHistory: ChatMessage[];
  chatHistory: ChatMessage[];
}