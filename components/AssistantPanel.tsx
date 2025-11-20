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
    return (<p className="whitespace-pre-wrap leading-relaxed">{parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index} className="text-gray-300">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={index} className="bg-black/30 text-violet-200 text-xs p-1 rounded font-mono border border-violet-500/20">{part.slice(1, -1)}</code>
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
        <div className="h-full flex flex-col">
            {/* Mode Toggler */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-3 bg-black/40 p-1 rounded-full border border-white/5">
                    <button 
                        onClick={() => setIsAgentMode(false)} 
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${!isAgentMode ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Chat
                    </button>
                    <button 
                        onClick={() => setIsAgentMode(true)} 
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${isAgentMode ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Agente
                    </button>
                </div>
                <button onClick={handleNewConversation} title="Clear Chat" className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Chat Area */}
            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4 scroll-smooth custom-scrollbar">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-2xl max-w-[90%] text-sm shadow-lg backdrop-blur-sm border ${msg.role === 'user' ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-500/30 rounded-br-sm' : 'bg-zinc-800/90 text-gray-200 border-white/5 rounded-bl-sm'}`}>
                           <BoldRenderer text={msg.text} />
                           {msg.functionCall && (
                               <div className="mt-2 pt-2 border-t border-white/10">
                                   <p className="text-[10px] text-violet-300 mb-2 font-semibold uppercase tracking-wider">Sugerencia del Agente:</p>
                                   <button onClick={() => onExecuteAction(msg.functionCall!)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors border border-white/5 flex items-center justify-center gap-2">
                                       <span>⚡ Ejecutar:</span> {msg.functionCall.name}
                                   </button>
                               </div>
                           )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="p-3 rounded-2xl rounded-bl-sm bg-zinc-800/80 border border-white/5">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            </div>
                        </div>
                    </div>
                )}
                {messages.length === 0 && !isLoading && (
                    <div className="text-center pt-10 px-6 opacity-50">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                            {isAgentMode ? (
                                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            ) : (
                                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            )}
                        </div>
                        <p className="text-sm font-medium text-gray-300">Modo {isAgentMode ? 'Agente' : 'Chat'} listo</p>
                        <p className="text-xs mt-1">{isAgentMode ? 'Selecciona una viñeta y pídeme que la edite o continúe.' : 'Pregúntame ideas para tu historia.'}</p>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 pt-2 flex-shrink-0 space-y-3 relative z-20">
                 {isAgentMode && (
                    <div className="flex flex-wrap gap-2 text-[10px] font-semibold scrollbar-hide overflow-x-auto pb-1">
                        <button onClick={() => openContextPicker('character')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-2 py-1 rounded-md whitespace-nowrap transition-colors">+ Personaje</button>
                        <button onClick={() => openContextPicker('style')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-2 py-1 rounded-md whitespace-nowrap transition-colors">+ Estilo</button>
                        <button title="Select a sub-panel on the canvas to give it to the agent as context." className={`px-2 py-1 rounded-md whitespace-nowrap transition-all border ${selectedSubPanelIds.length > 0 ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'}`}>
                            {selectedSubPanelIds.length > 0 ? `${selectedSubPanelIds.length} Viñeta(s)` : '+ Viñeta'}
                        </button>
                        <button onClick={() => openContextPicker('object')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-2 py-1 rounded-md whitespace-nowrap transition-colors">More...</button>
                    </div>
                 )}
                 {contextPicker && <ContextPicker items={contextPicker.items} onSelect={(item) => handleContextSelect(item, contextPicker.type)} onClose={() => setContextPicker(null)}/>}
                
                <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 p-1 shadow-lg focus-within:ring-1 focus-within:ring-violet-500/50 transition-all">
                    {contextPills.length > 0 && 
                        <div className="flex flex-wrap gap-1 mb-1 px-2 pt-2">
                            {contextPills.map(pill => <ContextPill key={pill.id} item={pill} onRemove={removeContextPill} />)}
                        </div>
                    }
                    <div className="flex items-end gap-2 p-1">
                         {speechSupported && (
                            <button onClick={toggleListening} title="Use voice input" className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}>
                                <MicIcon className="w-5 h-5" />
                            </button>
                        )}
                        <textarea 
                            ref={inputRef as any} 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} 
                            placeholder={isAgentMode ? 'Instruye al Agente...' : 'Escribe aquí...'} 
                            className="w-full bg-transparent focus:outline-none text-sm text-gray-200 placeholder-gray-600 resize-none max-h-24 py-2" 
                            rows={1}
                        />
                        <button 
                            onClick={() => handleSendMessage()} 
                            disabled={(!input.trim() && contextPills.length === 0) || isLoading} 
                            className="bg-violet-600 p-2 rounded-lg hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white transition-all shadow-lg active:scale-95"
                        >
                            <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};