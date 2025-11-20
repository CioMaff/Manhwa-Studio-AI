import React from 'react';

interface AgentGeneratingPanelProps {
    prompt: string;
}

export const AgentGeneratingPanel: React.FC<AgentGeneratingPanelProps> = ({ prompt }) => {
    return (
        <div className="border-2 border-dashed border-purple-500/50 rounded-lg p-4 text-center bg-purple-900/10 my-4">
            <div className="flex justify-center items-center mb-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mx-1" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
            </div>
            <p className="text-sm text-purple-300 font-semibold mb-2">Nano está creando una viñeta...</p>
            <p className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded-md font-mono max-w-md mx-auto truncate">
                {prompt}
            </p>
        </div>
    );
};