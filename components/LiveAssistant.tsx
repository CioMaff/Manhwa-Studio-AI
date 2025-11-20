import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Loader } from './Loader';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { showToast } from '../systems/uiSystem';
import type { LiveTranscriptEntry } from '../types';
import { MicIcon } from './icons/MicIcon';
import { UploadIcon } from './icons/UploadIcon';
import { MagicWandIcon } from './icons/MagicWandIcon';
import { generateBugReport } from '../services/geminiService';
import { ReportViewerModal } from './ReportViewerModal';
import { WebcamIcon } from './icons/WebcamIcon';
import { ScreenShareIcon } from './icons/ScreenShareIcon';

const TranscriptEntry: React.FC<{ entry: LiveTranscriptEntry }> = ({ entry }) => {
    const baseClasses = "max-w-lg p-3 rounded-lg mb-2 break-words";
    const sourceClasses = {
        user: "bg-purple-600 self-end",
        model: "bg-gray-700 self-start",
        system: "bg-yellow-800/50 self-center text-center text-xs w-full",
    };
    
    return (
        <div className={`flex flex-col ${entry.source === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`${baseClasses} ${sourceClasses[entry.source]}`}>
                {entry.text && <p className="whitespace-pre-wrap">{entry.text}</p>}
                {entry.image && (
                    <div className="mt-2">
                        <p className="text-xs text-gray-300 mb-1">Attached Image:</p>
                        <img src={entry.image} alt="screenshot" className="rounded-md max-w-xs" />
                    </div>
                )}
            </div>
        </div>
    );
};

const InputOptionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; }> = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors w-32 h-24">
        {icon}
        <span>{label}</span>
    </button>
);

export const LiveAssistant: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { 
        isSessionActive, 
        isConnecting,
        transcripts, 
        mediaStream,
        startSession, 
        closeSession,
        sendImage,
    } = useGeminiLive();
    
    const [report, setReport] = useState<string | null>(null);
    const [isReportViewerOpen, setReportViewerOpen] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [thinkingMessage, setThinkingMessage] = useState('');
    const [activeInputType, setActiveInputType] = useState<'audio' | 'webcam' | 'screen' | null>(null);
    
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hiddenUploadRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);

    useEffect(() => {
        if (mediaStream && videoRef.current) {
            videoRef.current.srcObject = mediaStream;
        }
    }, [mediaStream]);

     useEffect(() => {
        if (isGeneratingReport) {
            const messages = [
                "Analyzing transcript...",
                "Cross-referencing source code...",
                "Identifying key issues...",
                "Structuring the report...",
                "Adding technical analysis..."
            ];
            let messageIndex = 0;
            setThinkingMessage(messages[0]);
            const interval = setInterval(() => {
                messageIndex++;
                setThinkingMessage(messages[messageIndex % messages.length]);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [isGeneratingReport]);

    const handleStart = (type: 'audio' | 'webcam' | 'screen') => {
        setActiveInputType(type);
        startSession(type);
    };

    const handleClose = () => {
        if (isSessionActive) {
            closeSession();
        }
        setActiveInputType(null);
        onClose();
    };
    
    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const generatedReport = await generateBugReport(transcripts);
            setReport(generatedReport);
            setReportViewerOpen(true);
        } catch (error) {
            console.error("Failed to generate report", error);
            showToast("Error generating report.", 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                sendImage(base64);
            };
            e.target.value = '';
        }
    };

    const getStatusText = () => {
        if (isConnecting) return "Connecting...";
        if (isSessionActive) return "Live Session Active";
        return "Ready to Start";
    };

    const renderContent = () => {
        if (isGeneratingReport) {
            return <Loader message={thinkingMessage} />;
        }
        if (!isSessionActive && !isConnecting) {
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <h3 className="text-2xl font-semibold mb-6">Talk to Gemini live</h3>
                    <div className="flex justify-center items-center gap-4">
                        <InputOptionButton icon={<MicIcon className="w-6 h-6"/>} label="Talk" onClick={() => handleStart('audio')} />
                        <InputOptionButton icon={<WebcamIcon className="w-6 h-6"/>} label="Webcam" onClick={() => handleStart('webcam')} />
                        <InputOptionButton icon={<ScreenShareIcon className="w-6 h-6"/>} label="Share Screen" onClick={() => handleStart('screen')} />
                    </div>
                </div>
            );
        }
        return (
             <div className="flex flex-col h-full">
                {mediaStream && activeInputType !== 'audio' && (
                    <div className="p-2 bg-black flex-shrink-0 border-b border-gray-700">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full max-h-48 h-auto object-contain" />
                    </div>
                )}
                <div className="flex-grow bg-gray-900/50 p-4 overflow-y-auto no-drag">
                    {transcripts.map(entry => <TranscriptEntry key={entry.id} entry={entry} />)}
                    <div ref={transcriptEndRef} />
                </div>
                <div className="flex-shrink-0 p-4 bg-gray-800 border-t border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                           <div className={`w-3 h-3 rounded-full ${isSessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                           <span className="text-sm font-medium">{getStatusText()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleGenerateReport} disabled={!isSessionActive || transcripts.length < 2} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                                <MagicWandIcon className="w-4 h-4" /> Report
                            </button>
                             <input type="file" ref={hiddenUploadRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                            <button onClick={() => hiddenUploadRef.current?.click()} disabled={!isSessionActive} title="Upload Image" className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50">
                                <UploadIcon className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                    {isConnecting && <Loader message="Connecting..." />}
                    {isSessionActive && (
                        <button onClick={closeSession} className="w-full py-3 text-lg font-bold bg-red-600 rounded-md hover:bg-red-700">
                            End Session
                        </button>
                    )}
                </div>
            </div>
        );
    }
    
    if (!isOpen) return null;

    return (
        <>
            <Rnd
                default={{
                    x: window.innerWidth - 620,
                    y: 40,
                    width: 600,
                    height: 700,
                }}
                minWidth={400}
                minHeight={500}
                bounds="window"
                className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col z-[60]"
                cancel=".no-drag"
            >
                <div className="flex justify-between items-center p-2 bg-gray-900/50 rounded-t-lg cursor-move border-b border-gray-700">
                    <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Live AI Debug Assistant</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                {renderContent()}
            </Rnd>
            {report && <ReportViewerModal isOpen={isReportViewerOpen} onClose={() => setReportViewerOpen(false)} reportContent={report} transcripts={transcripts} />}
        </>
    );
};