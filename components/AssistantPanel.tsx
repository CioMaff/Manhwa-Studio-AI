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
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return (<p className="whitespace-pre-wrap">{parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
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
            // You can add objects, backgrounds etc. here too if needed
            setContextPills(pills);
            setInput("Continue the scene from this panel. I want to...");
            
            // Focus the input to streamline user workflow
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
            text: `${input}`,
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
            
            // FIX: The `chatWithAgent` service already cleans the response text of the model's internal monologue.
            // This redundant `.replace()` call is unnecessary.
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
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-purple-600' : 'bg-gray-700'}`}>
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
                        <button title="Select a sub-panel on the canvas to give it to the agent as context." className={`px-2 py-1 rounded-md ${selectedSubPanelIds.length > 0 ? 'bg-purple-600/50 text-purple-300' : 'bg-gray-700 hover:bg-gray-600'}`}>
                            {selectedSubPanelIds.length > 0 ? `${selectedSubPanelIds.length} Viñeta(s) Seleccionada(s)` : '+ Viñeta'}
                        </button>
                    </div>
                 )}
                 {contextPicker && <ContextPicker items={contextPicker.items} onSelect={(item) => handleContextSelect(item, contextPicker.type)} onClose={() => setContextPicker(null)}/>}
                <div className="flex items-center justify-between gap-4">
                    <button onClick={handleNewConversation} title="New Conversation" className="p-2 rounded-full hover:bg-gray-700"><TrashIcon className="w-4 h-4 text-gray-400" /></button>
                    <div className="flex items-center justify-center gap-4"><span className={`text-sm ${!isAgentMode ? 'text-white' : 'text-gray-500'}`}>Chat</span><button onClick={() => setIsAgentMode(!isAgentMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${isAgentMode ? 'bg-purple-600' : 'bg-gray-600'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAgentMode ? 'translate-x-6' : 'translate-x-1'}`} /></button><span className={`text-sm ${isAgentMode ? 'text-white' : 'text-gray-500'}`}>Agente</span></div>
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
                            <button onClick={toggleListening} title="Use voice input" className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/30 text-red-300 animate-pulse' : 'hover:bg-gray-600'}`}>
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