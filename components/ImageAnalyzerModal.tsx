import React, { useState } from 'react';
import { Modal } from './Modal';
import { Loader } from './Loader';
import { describeImage } from '../services/geminiService';
import { showToast } from '../systems/uiSystem';
import { fileToBase64 } from '../utils/fileUtils';
import { UploadIcon } from './icons/UploadIcon';
import { CopyIcon } from './icons/CopyIcon';

export const ImageAnalyzerModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const [image, setImage] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setImage(base64);
            setAnalysis(''); // Clear previous analysis
            handleAnalyze(base64); // Automatically analyze after upload
        }
    };

    const handleAnalyze = async (imgToAnalyze: string | null) => {
        if (!imgToAnalyze) {
            showToast("Please upload an image first.", 'error');
            return;
        }
        setIsLoading(true);
        setAnalysis('');
        try {
            const result = await describeImage(imgToAnalyze, "Analyze this image in detail. Describe the style, subject, composition, colors, and mood. Formulate the response as a high-quality prompt that could be used to regenerate a similar image.");
            setAnalysis(result);
        } catch (error) {
            console.error(error);
            showToast("Failed to analyze image.", 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(analysis);
        showToast("Copied to clipboard!", 'success');
    };

    const handleClose = () => {
        setImage(null);
        setAnalysis('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Analyze Image with Gemini" maxWidth="max-w-4xl">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg min-h-[300px] flex items-center justify-center">
                    {image ? (
                        <img src={image} alt="Uploaded for analysis" className="max-h-[50vh] w-auto object-contain rounded-md" />
                    ) : (
                        <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white">
                            <UploadIcon className="w-10 h-10" />
                            <span>Click to upload an image</span>
                        </button>
                    )}
                </div>
                <div className="relative p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                    {isLoading && <Loader message="Analyzing..." />}
                    {!isLoading && !analysis && <p className="text-gray-500">Analysis will appear here.</p>}
                    {!isLoading && analysis && (
                        <>
                           <button onClick={handleCopy} className="absolute top-2 right-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600" title="Copy Analysis">
                                <CopyIcon className="w-4 h-4" />
                           </button>
                           <p className="text-gray-300 whitespace-pre-wrap text-sm h-full max-h-[50vh] overflow-y-auto">{analysis}</p>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};