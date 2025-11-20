import React from 'react';
import type { SubPanel } from '../types';

// Icons
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { EditIcon } from './icons/EditIcon';
import { RegenerateIcon } from './icons/RegenerateIcon';
import { TextBubbleIcon } from './icons/TextBubbleIcon';
import { AnalyzeIcon } from './icons/AnalyzeIcon';
import { MagicWandIcon } from './icons/MagicWandIcon';
import { CharacterFromPanelIcon } from './icons/CharacterFromPanelIcon';
import { ScissorsIcon } from './icons/ScissorsIcon';
import { ContinuePanelIcon } from './icons/ContinuePanelIcon';


export const SubPanelComponent: React.FC<{
    subPanel: SubPanel;
    onGenerateClick: () => void;
    onEditClick: () => void;
    onUploadClick: () => void;
    onDownloadClick: () => void;
    onDeleteContent: () => void;
    onRegenerate: () => void;
    onAddBubble: () => void;
    onAnalyze: () => void;
    onCreateCharacter: () => void;
    onExtractAsset: () => void;
    onContinuePanel: () => void;
    status: 'idle' | 'queued' | 'generating';
    isSelected: boolean;
    onSelect: () => void;
    isAgentMode: boolean;
}> = ({ subPanel, onGenerateClick, onEditClick, onUploadClick, onDownloadClick, onDeleteContent, onRegenerate, onAddBubble, onAnalyze, onCreateCharacter, onExtractAsset, onContinuePanel, status, isSelected, onSelect, isAgentMode }) => {
    
    const stopPropagation = (e: React.MouseEvent, func: () => void) => {
        e.stopPropagation();
        func();
    };

    const hasContent = !!subPanel.imageUrl;

    const containerClass = `relative w-full h-full rounded-md overflow-hidden group border-2 ${isAgentMode ? 'cursor-pointer' : ''} ${
        isSelected 
            ? 'border-purple-500 bg-purple-900/20' 
            : hasContent
                ? 'border-transparent bg-gray-700/50' 
                : 'border-dashed border-gray-600 bg-gray-800'
    }`;

    return (
        <div 
            onClick={onSelect}
            className={containerClass}
        >
            {subPanel.imageUrl ? (
                <img src={subPanel.imageUrl} alt={subPanel.prompt || 'manhwa panel'} className="w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                     {status === 'generating' && <><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-purple-500 mb-3"></div><p className="text-sm text-purple-300">Working...</p></>}
                    {status === 'queued' && <><div className="h-12 w-12 border-4 border-dashed border-gray-600 rounded-full mb-3"></div><p className="text-sm text-gray-400">Queued...</p></>}
                    {status === 'idle' && (
                        <div className="flex gap-2">
                            <button onClick={(e) => stopPropagation(e, onGenerateClick)} title="Generate with AI" className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors"><MagicWandIcon className="w-5 h-5"/></button>
                            <button onClick={(e) => stopPropagation(e, onUploadClick)} title="Upload Image" className="p-3 bg-gray-600 rounded-full hover:bg-gray-700 transition-colors"><UploadIcon className="w-5 h-5"/></button>
                        </div>
                    )}
                     {isAgentMode && isSelected && status === 'idle' && <p className="text-xs text-gray-400 mt-3">Selected for Agent</p>}
                </div>
            )}
            
            {hasContent && (
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => stopPropagation(e, onDownloadClick)} title="Download Image" className="p-2 bg-gray-800/80 rounded-full hover:bg-cyan-600"><DownloadIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onEditClick)} title="Edit Image with AI" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onContinuePanel)} title="Continue Panel with Agent" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><ContinuePanelIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onRegenerate)} title="Regenerate Panel" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><RegenerateIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onAddBubble)} title="Add Dialogue Bubble" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><TextBubbleIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onAnalyze)} title="Analyze Image (Get Prompt)" className="p-2 bg-gray-800/80 rounded-full hover:bg-purple-600"><AnalyzeIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onCreateCharacter)} title="Create Character From Panel" className="p-2 bg-gray-800/80 rounded-full hover:bg-green-600"><CharacterFromPanelIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onExtractAsset)} title="Manually Extract Asset" className="p-2 bg-gray-800/80 rounded-full hover:bg-yellow-600"><ScissorsIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => stopPropagation(e, onDeleteContent)} title="Delete Panel Content" className="p-2 bg-red-800/80 rounded-full hover:bg-red-600"><TrashIcon className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
};