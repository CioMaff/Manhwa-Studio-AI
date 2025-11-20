
export interface SubPanel {
  id: string;
  prompt: string;
  characterIds: string[];
  styleReferenceIds?: string[];
  dialogueStyleIds?: string[];
  backgroundIds?: string[];
  continuitySubPanelId?: string | null;
  imageUrl: string | null;
  content?: string; // For text bubbles, etc.
  generatedDescription?: string;
  shotType?: string;
  cameraAngle?: string;
  generationMode?: 'page' | 'sequential';
}

export interface DialogueBubble {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    styleId?: string; // Link to a DialogueStyle asset
}


export interface Panel {
    id:string;
    layout: number[][]; 
    subPanels: SubPanel[];
    dialogueBubbles: DialogueBubble[];
    imageUrl?: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  panels: Panel[];
}

export interface Character {
  id:string;
  name: string;
  description: string; // The primary, most detailed description for the AI.
  
  // Detailed fields from the document for UI organization
  apparentAge?: string;
  heightAndComplexion?: string;
  face?: string;
  eyes?: string;
  hair?: string;
  skin?: string;
  uniqueFeatures?: string;
  baseOutfit?: string;
  accessories?: string;
  outfitVariations?: string;
  bodyLanguage?: string;
  facialExpressions?: string;
  artStyle?: string;

  referenceImage: string; // base64
}

export interface StyleReference {
  id: string;
  name: string;
  image: string; // base64
}

// New type for objects
export interface ObjectAsset {
  id: string;
  name: string;
  image: string; // base64
  ownerInfo?: {
    type: 'character' | 'background' | 'various';
    name: string; // e.g. Character name, or 'Various'
  };
}

export interface BackgroundAsset {
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
    maxConcurrentGenerations: number;
}

export interface AgentFunctionCall {
    name: string;
    args: { [key: string]: any };
}

export type ContextPillItem = (Character & { type: 'character' }) | 
                             (StyleReference & { type: 'style' }) |
                             (ObjectAsset & { type: 'object' }) |
                             (DialogueStyle & { type: 'dialogue' }) |
                             (KnowledgeFile & { type: 'knowledge' });


export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    images?: string[]; // base64 encoded images for multimodal context
    contextPills?: ContextPillItem[];
    functionCall?: AgentFunctionCall;
    selectedSubPanelIds?: string[];
}

export interface Project {
  id: string;
  title: string;
  coverImage: string; // Full 9:16 image
  coverImagePreview: string; // Cropped 9:16 preview
  chapters: Chapter[];
  characters: Character[];
  objects: ObjectAsset[]; // Add objects to project
  backgrounds: BackgroundAsset[]; // Add backgrounds to project
  styleReferences: StyleReference[];
  dialogueStyles: DialogueStyle[];
  knowledgeBase: KnowledgeFile[];
  settings: Settings;
  agentHistory: ChatMessage[];
  chatHistory: ChatMessage[];
  // Internal state for the App routing
  viewMode?: 'dashboard' | 'landing' | 'editor' | 'reader'; 
}

export interface SubPanelPlan {
  shot_type: string;
  camera_angle: string;
  action_description: string;
  justification: string;
}

export interface ScenePlanPage {
  page_number: number;
  layout: string; 
  sub_panels: SubPanelPlan[];
}

export type SceneType = 'dialogue' | 'action' | 'emotional' | 'establishment' | '';

export interface NewCharacterEntity {
  name_suggestion: string;
  description: string;
}
export interface NewObjectEntity {
  name_suggestion: string;
  description: string;
  owner_suggestion: string; // Name of the character who owns it, or 'Various'
}
export interface NewEntityAnalysis {
  new_characters: NewCharacterEntity[];
  new_objects: NewObjectEntity[];
}

export interface CharacterInPanel {
    name_suggestion: string;
    description: string;
}
export interface CharacterAnalysis {
    new_characters: CharacterInPanel[];
}

export interface LiveTranscriptEntry {
    id: string;
    source: 'user' | 'model' | 'system';
    text?: string;
    image?: string; // base64 for screenshots or uploaded images
    timestamp: number;
}
