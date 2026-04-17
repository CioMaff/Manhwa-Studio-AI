
import React from 'react';

interface DirectorThoughtCloudProps {
    step: string;
    isVisible: boolean;
}

export const DirectorThoughtCloud: React.FC<DirectorThoughtCloudProps> = ({ step, isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 w-72 z-50 animate-fade-in-up pointer-events-none">
            <div className="relative bg-black/90 backdrop-blur-xl border border-violet-500/30 p-4 rounded-xl shadow-[0_0_30px_rgba(124,58,237,0.15)] ring-1 ring-white/10">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-violet-600/20 to-transparent rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 bg-gradient-to-tr from-blue-600/10 to-transparent rounded-bl-xl"></div>
                
                {/* Tail */}
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-black/90 border-b border-r border-violet-500/30 rotate-45"></div>
                
                {/* Header */}
                <div className="flex items-center justify-between mb-2 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-ping absolute top-0 left-0 opacity-75"></div>
                            <div className="w-1.5 h-1.5 bg-violet-500 rounded-full relative"></div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-300">Nano Core</span>
                    </div>
                    <div className="flex gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-white/20"></div>
                        <div className="w-1 h-1 rounded-full bg-white/20"></div>
                        <div className="w-1 h-1 rounded-full bg-white/20"></div>
                    </div>
                </div>
                
                {/* Content */}
                <p className="text-xs text-gray-200 font-mono leading-relaxed relative z-10">
                    <span className="text-violet-500 mr-1">{'>'}</span>
                    {step}
                    <span className="animate-pulse ml-0.5 text-violet-400">_</span>
                </p>
                
                {/* Progress Bar simulation */}
                <div className="w-full h-0.5 bg-gray-800 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 w-full animate-progress-indeterminate origin-left"></div>
                </div>
            </div>
        </div>
    );
};
