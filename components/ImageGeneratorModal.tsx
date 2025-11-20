import React, { useState } from 'react';
import { Modal } from './Modal';
import { Loader } from './Loader';
import { generateHighQualityImage } from '../services/geminiService';
import { showToast } from '../systems/uiSystem';
import { useProject } from '../contexts/ProjectContext';
import { compressImageBase64 } from '../utils/fileUtils';
import type { StyleReference, BackgroundAsset } from '../types';

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
const aspectRatios: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

export const ImageGeneratorModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { updateProject } = useProject();
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            showToast("Please enter a prompt.", 'error');
            return;
        }
        setIsLoading(true);
        setGeneratedImage(null);
        try {
            const image = await generateHighQualityImage(prompt, aspectRatio);
            setGeneratedImage(image);
            showToast("Image generated successfully!", 'success');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate image.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAsset = async (type: 'style' | 'background') => {
        if (!generatedImage) return;
        const assetName = prompt.substring(0, 30) || 'Generated Image';
        const compressed = await compressImageBase64(generatedImage);
        
        if (type === 'style') {
            const newAsset: StyleReference = { id: `style-${Date.now()}`, name: assetName, image: compressed };
            updateProject(p => ({ ...p, styleReferences: [...p.styleReferences, newAsset] }));
        } else {
            const newAsset: BackgroundAsset = { id: `bg-${Date.now()}`, name: assetName, image: compressed };
            updateProject(p => ({ ...p, backgrounds: [...p.backgrounds, newAsset] }));
        }
        showToast(`Saved as new ${type} asset!`, 'success');
        handleClose();
    };

    const handleClose = () => {
        setPrompt('');
        setGeneratedImage(null);
        setAspectRatio('3:4');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="AI Art Generator (Imagen)" maxWidth="max-w-3xl">
            <div className="space-y-4">
                <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg min-h-[300px] flex items-center justify-center">
                    {isLoading && <Loader message="Generating..." />}
                    {!isLoading && generatedImage && <img src={generatedImage} alt="Generated art" className="max-h-[50vh] w-auto object-contain rounded-md" />}
                    {!isLoading && !generatedImage && <p className="text-gray-500">Your generated image will appear here.</p>}
                </div>

                <textarea
                    placeholder="Enter a detailed prompt for your artwork..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
                    rows={3}
                />

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Aspect Ratio</label>
                    <div className="flex flex-wrap gap-2">
                        {aspectRatios.map(ar => (
                            <button key={ar} onClick={() => setAspectRatio(ar)} className={`px-4 py-2 text-sm rounded-md ${aspectRatio === ar ? 'bg-purple-600' : 'bg-gray-600'}`}>
                                {ar}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                    <div className="flex gap-2">
                        <button onClick={() => handleSaveAsset('style')} disabled={!generatedImage} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500">Save as Style</button>
                        <button onClick={() => handleSaveAsset('background')} disabled={!generatedImage} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500">Save as Background</button>
                    </div>
                    <button onClick={handleGenerate} disabled={isLoading} className="px-6 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50">
                        {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};