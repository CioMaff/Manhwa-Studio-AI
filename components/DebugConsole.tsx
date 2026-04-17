
import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../systems/logger';

export const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleLog = (e: Event) => {
            const entry = (e as CustomEvent).detail as LogEntry;
            setLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
        };
        window.addEventListener('nano-log', handleLog);
        return () => window.removeEventListener('nano-log', handleLog);
    }, []);

    useEffect(() => {
        if (isOpen) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-[100] bg-black/80 text-green-400 font-mono text-xs px-3 py-1 rounded border border-green-900 hover:bg-black opacity-70 hover:opacity-100 transition-all"
            >
                {">_ TERMINAL"}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-[100] w-[400px] h-[300px] bg-[#0c0c0c] rounded-lg border border-green-900/50 shadow-2xl flex flex-col overflow-hidden font-mono text-[10px]">
            <div className="bg-green-900/20 p-1 flex justify-between items-center border-b border-green-900/30 cursor-pointer" onClick={() => setIsOpen(false)}>
                <span className="text-green-500 font-bold px-2">NANO_CORE :: TERMINAL_MONITOR_V1</span>
                <span className="text-green-700 px-2 hover:text-white">▼</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-black/90">
                {logs.map(log => (
                    <div key={log.id} className="break-words">
                        <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span>
                        <span className={`ml-2 font-bold ${
                            log.level === 'error' ? 'text-red-500' :
                            log.level === 'warn' ? 'text-yellow-500' :
                            log.level === 'success' ? 'text-green-400' :
                            log.level === 'system' ? 'text-blue-400' :
                            'text-gray-300'
                        }`}>
                            {log.level.toUpperCase()}:
                        </span>
                        <span className="text-gray-300 ml-1">{log.message}</span>
                        {log.details && (
                            <div className="ml-4 text-gray-500 whitespace-pre-wrap border-l border-gray-800 pl-2 mt-0.5">
                                {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};
