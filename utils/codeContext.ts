export const SOURCE_CODE_CONTEXT = `
// FILE: App.tsx
// ---
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Studio } from './components/Studio';
import { Auth } from './components/Auth';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ProjectProvider } from './contexts/ProjectContext';
import type { Project } from './types';
import { getDefaultProject, loadProjectFromStorage } from './utils/storage';
import { showConfirmation, handleConfirmation } from './systems/uiSystem';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string;
}

const ToastMessage: React.FC<{ toast: Toast; onRemove: (id: number) => void }> = ({ toast, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    const baseClasses = "flex items-center w-full max-w-xs p-4 mb-4 text-gray-200 bg-gray-800 rounded-lg shadow-lg border";
    const typeClasses = {
        success: "border-green-500/50",
        error: "border-red-500/50",
        info: "border-blue-500/50",
    };
    const Icon = {
        success: () => <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>,
        error: () => <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>,
        info: () => <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>,
    };

    return (
        <div className={\`\\\${baseClasses} \\\${typeClasses[toast.type]}\`} role="alert">
            <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg">
                {Icon[toast.type]()}
            </div>
            <div className="ml-3 text-sm font-normal">{toast.message}</div>
            <button type="button" className="ml-auto -mx-1.5 -my-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-700 inline-flex h-8 w-8" onClick={() => onRemove(toast.id)}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.697a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
        </div>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div className="fixed top-5 right-5 z-[100]">
        {toasts.map((toast) => (
            <ToastMessage key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
    </div>
);

function App() {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('gemini-manhwa-user'));
  const [project, setProject] = useState<Project | null>(null);
  const [projectTitle, setProjectTitle] = useState('Gemini Manhwa Studio');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmationProps, setConfirmationProps] = useState<ConfirmationOptions & { isOpen: boolean }>({
    isOpen: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    if (user) {
        let loadedProject = loadProjectFromStorage(user) || getDefaultProject(user);
        if (loadedProject.chapters.length === 0) {
            loadedProject.chapters = getDefaultProject(user).chapters;
        }
        setProject(loadedProject);
    } else {
        setProject(null);
    }
  }, [user]);

  const updateProject = useCallback((updater: (p: Project) => Project) => {
      setProject(prev => {
          if (!prev) return null;
          const newProject = updater(prev);
          return newProject;
      });
  }, []);

  const providerValue = useMemo(() => (project ? { project, updateProject } : null), [project, updateProject]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const onConfirm = () => {
    handleConfirmation(true);
    setConfirmationProps({ ...confirmationProps, isOpen: false });
  };

  const onCancel = () => {
    handleConfirmation(false);
    setConfirmationProps({ ...confirmationProps, isOpen: false });
  };

  useEffect(() => {
    const handleShowToast = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        addToast(detail.message, detail.type);
    };
    const handleShowConfirmation = (e: Event) => {
        const detail = (e as CustomEvent).detail.detail;
        setConfirmationProps({ ...detail, isOpen: true });
    };
    window.addEventListener('show-toast', handleShowToast);
    window.addEventListener('show-confirmation', handleShowConfirmation);
    return () => {
        window.removeEventListener('show-toast', handleShowToast);
        window.removeEventListener('show-confirmation', handleShowConfirmation);
    };
  }, [addToast]);
  
  const handleLogin = (username: string) => {
      localStorage.setItem('gemini-manhwa-user', username);
      setUser(username);
  };

  const handleLogout = async () => {
      const confirmed = await showConfirmation({
        title: 'Confirm Logout',
        message: 'Are you sure you want to logout? Your work is saved in this browser.',
        confirmButtonClass: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
      });
      if (confirmed) {
        localStorage.removeItem('gemini-manhwa-user');
        setUser(null);
        setProjectTitle('Gemini Manhwa Studio');
      }
  };

  return (
    <div className="h-full bg-gray-900 font-sans flex flex-col">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmationModal
        isOpen={confirmationProps.isOpen}
        onClose={onCancel}
        onConfirm={onConfirm}
        title={confirmationProps.title}
        message={confirmationProps.message}
        confirmText={confirmationProps.confirmText}
        cancelText={confirmationProps.cancelText}
        confirmButtonClass={confirmationProps.confirmButtonClass}
      />
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg flex justify-between items-center z-20 flex-shrink-0">
        <h1 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 truncate">
          {projectTitle}
        </h1>
        {user && (
            <button onClick={handleLogout} className="bg-red-600 text-white font-bold py-1 px-3 rounded-md hover:bg-red-700 transition-colors text-sm">
                Logout
            </button>
        )}
      </header>
      <main className="flex-1 overflow-y-auto">
         {user && providerValue ? (
            <ProjectProvider value={providerValue}>
                <Studio username={user} setProjectTitle={setProjectTitle} />
            </ProjectProvider>
         ) : user ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading Project...</div>
         ) : (
            <Auth onLogin={handleLogin} />
         )}
      </main>
    </div>
  );
}
---
// FILE: components/AssistantPanel.tsx
// ---
import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import type { ChatMessage, AgentFunctionCall, ContextPillItem, SubPanel } from '../types';
import { chatWithAgent } from '../services/geminiService';
import { ContextPicker } from './ContextPicker';
import { ContextPill } from './ContextPill';
import { TrashIcon } from './icons/TrashIcon';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { MicIcon } from './icons/MicIcon';
import { showConfirmation } from '../systems/uiSystem';
import { useProject } from '../contexts/ProjectContext';

interface AssistantPanelProps {
    isAgentMode: boolean;
    setIsAgentMode: (isAgent: boolean) => void;
    selectedSubPanelIds: string[];
    setSelectedSubPanelIds: (ids: string[]) => void;
    onExecuteAction: (action: AgentFunctionCall) => void;
    updateHistory: (mode: 'agent' | 'chat', history: ChatMessage[]) => void;
}

const BoldRenderer = ({ text }: { text: string }) => {
    const parts = text.split(/(\\*{2}.*?\\*{2}|\\*.*?\\*|\\\`.*?\\\`)/g);
    return (<p className="whitespace-pre-wrap">{parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('\\\`') && part.endsWith('\\\`')) {
            return <code key={index} className="bg-gray-900/50 text-purple-300 text-xs p-1 rounded-md">{part.slice(1, -1)}</code>
        }
        return part;
    })}</p>);
};

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ isAgentMode, setIsAgentMode, selectedSubPanelIds, setSelectedSubPanelIds, onExecuteAction, updateHistory }) => {
    const { project } = useProject();
    const [input, setInput] = useState('');
    const [contextPills, setContextPills] = useState<ContextPillItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [contextPicker, setContextPicker] = useState<{ type: 'character' | 'style' | 'knowledge' | 'dialogue' | 'object', items: any[] } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const onSpeechResult = useCallback((transcript: string) => {
        setInput(prev => (prev ? prev + ' ' + transcript : transcript).trim());
    }, []);

    const { isListening, toggleListening, supported: speechSupported } = useSpeechRecognition(onSpeechResult);

    const messages = isAgentMode ? project.agentHistory : project.chatHistory;
    const setMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        updateHistory(isAgentMode ? 'agent' : 'chat', updater(messages));
    };

    useLayoutEffect(() => {
        const chatContainer = chatContainerRef.current;
        if (chatContainer) {
            const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 50; // Add tolerance
            if (isScrolledToBottom) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
    }, [messages]);
    
    useEffect(() => {
        const handlePrepopulate = (e: Event) => {
            const subPanel = (e as CustomEvent).detail as SubPanel;
            
            setIsAgentMode(true);
            setSelectedSubPanelIds([subPanel.id]);
            
            const pills: ContextPillItem[] = [];
            if (subPanel.characterIds) {
                project.characters.forEach(c => {
                    if (subPanel.characterIds.includes(c.id)) pills.push({ ...c, type: 'character' });
                });
            }
             if (subPanel.styleReferenceIds) {
                 project.styleReferences.forEach(s => {
                    if (subPanel.styleReferenceIds?.includes(s.id)) pills.push({ ...s, type: 'style' });
                });
            }
            setContextPills(pills);
            setInput("Continue the scene from this panel. I want to...");
            
            setTimeout(() => inputRef.current?.focus(), 100);
        };
        
        window.addEventListener('prepopulate-agent', handlePrepopulate);
        return () => window.removeEventListener('prepopulate-agent', handlePrepopulate);
    }, [project, setIsAgentMode, setSelectedSubPanelIds]);

    const handleSendMessage = async () => {
        if ((!input.trim() && contextPills.length === 0) || isLoading) return;
        
        const allSubPanels = project.chapters.flatMap(c => c.panels).flatMap(p => p.subPanels);
        const selectedSubPanels = allSubPanels.filter(sp => selectedSubPanelIds.includes(sp.id));

        const userMessage: ChatMessage = { 
            id: Date.now().toString(), 
            role: 'user', 
// Fix: Corrected the unescaped template literal within the SOURCE_CODE_CONTEXT string.
            text: input,
            contextPills: contextPills,
            images: isAgentMode ? selectedSubPanels.filter(sp => sp.imageUrl).map(sp => sp.imageUrl!) : [],
            selectedSubPanelIds: isAgentMode ? selectedSubPanelIds : undefined,
        };
        
        const newMessages = [...messages, userMessage];
        setMessages(() => newMessages);
        setInput('');
        setContextPills([]);
        setIsLoading(true);

        try {
            const { text, functionCall } = await chatWithAgent(newMessages, project);
            
// Fix: Corrected a corrupted regex and redundant logic. The \`chatWithAgent\` service already cleans the response text, so this complex replace call is unnecessary and was syntactically incorrect within the template string.
            const cleanText = text;
            
            const modelMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: cleanText, functionCall };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: "Lo siento, he encontrado un error. Por favor, revisa la consola para más detalles." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleContextSelect = (item: any, type: string) => {
        setContextPills(prev => [...prev, { ...item, type }]);
        setContextPicker(null);
    }
    
    const removeContextPill = (id: string) => {
        setContextPills(prev => prev.filter(p => p.id !== id));
    };

    const openContextPicker = (type: 'character' | 'style' | 'knowledge' | 'dialogue' | 'object') => {
        let items: any[] = [];
        if (type === 'character') items = project.characters;
        if (type === 'style') items = project.styleReferences;
        if (type === 'knowledge') items = project.knowledgeBase;
        if (type === 'dialogue') items = project.dialogueStyles;
        if (type === 'object') items = project.objects;
        setContextPicker({ type, items });
    };

    const handleNewConversation = async () => {
        const confirmed = await showConfirmation({
            title: "New Conversation",
            message: "Are you sure you want to start a new conversation? The current chat history will be cleared."
        });
        if (confirmed) {
            setMessages(() => []);
        }
    };

    return (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 h-full flex flex-col">
            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4 scroll-smooth">
                {messages.map(msg => (
                    <div key={msg.id} className={\`flex \\\${msg.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
                        <div className={\`p-3 rounded-lg max-w-lg \\\${msg.role === 'user' ? 'bg-purple-600' : 'bg-gray-700'}\`}>
                           <BoldRenderer text={msg.text} />
                           {msg.functionCall && (
                               <div className="mt-2 pt-2 border-t border-purple-400/50">
                                   <p className="text-xs text-purple-200 mb-2">Sugerencia del Agente:</p>
                                   <button onClick={() => onExecuteAction(msg.functionCall!)} className="w-full bg-purple-500 text-white font-bold py-2 px-3 rounded-md text-sm hover:bg-purple-400 transition-colors">
                                       Ejecutar: {msg.functionCall.name}
                                   </button>
                               </div>
                           )}
                        </div>
                    </div>
                ))}
                {isLoading && (<div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-700"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div><div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.2s]"></div><div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.4s]"></div></div></div></div>)}
                {messages.length === 0 && !isLoading && (<div className="text-center text-gray-500 pt-10"><p>Modo {isAgentMode ? 'Agente' : 'Chat'} activado.</p><p className="text-sm mt-2">{isAgentMode ? 'Selecciona una viñeta y pídeme ayuda.' : 'Pregúntame cualquier cosa.'}</p></div>)}
            </div>

            <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-3 relative">
                 {isAgentMode && (
                    <div className="flex flex-wrap gap-2 text-xs">
                        <button onClick={() => openContextPicker('character')} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md">+ Personaje</button>
                        <button onClick={() => openContextPicker('object')} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md">+ Objeto</button>
                        <button onClick={() => openContextPicker('style')} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md">+ Estilo</button>
                        <button onClick={() => openContextPicker('dialogue')} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md">+ Diálogo</button>
                        <button onClick={() => openContextPicker('knowledge')} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md">+ Knowledge</button>
                        <button title="Select a sub-panel on the canvas to give it to the agent as context." className={\`px-2 py-1 rounded-md \\\${selectedSubPanelIds.length > 0 ? 'bg-purple-600/50 text-purple-300' : 'bg-gray-700 hover:bg-gray-600'}\`}>
                            {selectedSubPanelIds.length > 0 ? \`\\\${selectedSubPanelIds.length} Viñeta(s) Seleccionada(s)\` : '+ Viñeta'}
                        </button>
                    </div>
                 )}
                 {contextPicker && <ContextPicker items={contextPicker.items} onSelect={(item) => handleContextSelect(item, contextPicker.type)} onClose={() => setContextPicker(null)}/>}
                <div className="flex items-center justify-between gap-4">
                    <button onClick={handleNewConversation} title="New Conversation" className="p-2 rounded-full hover:bg-gray-700"><TrashIcon className="w-4 h-4 text-gray-400" /></button>
                    <div className="flex items-center justify-center gap-4"><span className={\`text-sm \\\${!isAgentMode ? 'text-white' : 'text-gray-500'}\`}>Chat</span><button onClick={() => setIsAgentMode(!isAgentMode)} className={\`relative inline-flex h-6 w-11 items-center rounded-full \\\${isAgentMode ? 'bg-purple-600' : 'bg-gray-600'}\`}><span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \\\${isAgentMode ? 'translate-x-6' : 'translate-x-1'}\`} /></button><span className={\`text-sm \\\${isAgentMode ? 'text-white' : 'text-gray-500'}\`}>Agente</span></div>
                    <div className="w-8"></div>
                </div>
                <div className="bg-gray-700 rounded-md border border-gray-600 p-2">
                    {contextPills.length > 0 && 
                        <div className="flex flex-wrap gap-1 mb-2">
                            {contextPills.map(pill => <ContextPill key={pill.id} item={pill} onRemove={removeContextPill} />)}
                        </div>
                    }
                    <div className="flex items-center gap-2">
                         {speechSupported && (
                            <button onClick={toggleListening} title="Use voice input" className={\`p-2 rounded-full transition-colors \\\${isListening ? 'bg-red-500/30 text-red-300 animate-pulse' : 'hover:bg-gray-600'}\`}>
                                <MicIcon className="w-5 h-5" />
                            </button>
                        )}
                        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={isAgentMode ? 'Pide ayuda a tu agente...' : 'Habla con Nano...'} className="w-full bg-transparent focus:outline-none" disabled={isLoading} />
                        <button onClick={() => handleSendMessage()} disabled={(!input.trim() && contextPills.length === 0) || isLoading} className="bg-purple-600 px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Send</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
---
// FILE: components/Studio.tsx
// ---
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Chapter, AgentFunctionCall, Panel, ChatMessage, SubPanel, Character, ScenePlanPage, StyleReference, ObjectAsset, SceneType, BackgroundAsset } from '../types';
import { AssetManager, type AssetManagerProps } from './AssetManager';
import { AssistantPanel } from './AssistantPanel';
import { Canvas } from './Canvas';
import { ImageViewerModal } from './ImageViewerModal';
import { Modal } from './Modal';
import { SettingsModal } from './SettingsModal';
import { generateCoverArt, editPanelImage } from '../services/geminiService';
import { saveProjectToStorage } from '../utils/storage';
import { showToast, showConfirmation } from '../systems/uiSystem';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { compressImageBase64, downloadBase64Image } from '../utils/fileUtils';
import { useProject } from '../contexts/ProjectContext';
import { WhatsNewModal } from './WhatsNewModal';
import { CharacterEditorModal } from './CharacterEditorModal';
import { Loader } from './Loader';
import { layouts } from './layouts';
import { NanoReport } from './NanoReport';
import { ExtractAssetModal } from './ExtractAssetModal';
import { CharacterSelectionModal } from './CharacterSelectionModal';
import { analyzePanelForCharacters, extractAssetFromImage } from '../services/geminiService';
import type { CharacterInPanel } from '../types';
import { ImageGeneratorModal } from './ImageGeneratorModal';
import { ImageAnalyzerModal } from './ImageAnalyzerModal';
import { LiveAssistant } from './LiveAssistant';
import { ImageIcon } from './icons/ImageIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { AssistantIcon } from './icons/AssistantIcon';
import { DownloadIcon } from './icons/DownloadIcon';

// ... (rest of Studio.tsx)
`;