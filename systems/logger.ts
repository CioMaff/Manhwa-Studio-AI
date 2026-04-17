
// Event-based logging system for the Visual Terminal
export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success' | 'system';
    message: string;
    details?: any;
}

let errorCount = 0;
const MAX_ERRORS = 100;

export const resetErrorCount = () => {
    errorCount = 0;
};

export const logger = {
    info: (message: string, details?: any) => emitLog('info', message, details),
    warn: (message: string, details?: any) => emitLog('warn', message, details),
    error: (message: string, details?: any) => emitLog('error', message, details),
    success: (message: string, details?: any) => emitLog('success', message, details),
    system: (message: string, details?: any) => emitLog('system', message, details),
};

const emitLog = (level: LogEntry['level'], message: string, details?: any) => {
    if (level === 'error') {
        errorCount++;
        if (errorCount === MAX_ERRORS) {
            console.error("🔥🔥🔥 EMERGENCY STOP TRIGGERED: ERROR LIMIT REACHED 🔥🔥🔥");
            window.dispatchEvent(new CustomEvent('nano-emergency-stop'));
            emitLog('system', "🛑 SYSTEM HALTED: Too many errors (100+). Check console.");
        }
    }

    const entry: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        level,
        message,
        details
    };
    // Dispatch event for the UI to pick up
    window.dispatchEvent(new CustomEvent('nano-log', { detail: entry }));
    
    // Also log to browser console for devtools
    const style = level === 'error' ? 'color: red' : level === 'success' ? 'color: green' : 'color: gray';
    console.log(`%c[NANO ${level.toUpperCase()}] ${message}`, style, details || '');
};
