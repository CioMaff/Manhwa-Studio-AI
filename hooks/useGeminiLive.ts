import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Blob, FunctionDeclaration, Type } from '@google/genai';
import html2canvas from 'html2canvas';
import { encode, decode, decodeAudioData, blobToBase64 } from '../utils/liveUtils';
import { showToast } from '../systems/uiSystem';
import type { LiveTranscriptEntry } from '../types';
import { SOURCE_CODE_CONTEXT } from '../utils/codeContext';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const takeScreenshotTool: FunctionDeclaration = {
    name: 'take_screenshot',
    description: 'Captures a screenshot of the entire application window to document a visual bug or state. Use this when the user says "take a screenshot", "capture this", or points out a visual issue.',
    parameters: { type: Type.OBJECT, properties: {} },
};

interface LiveSession {
  close(): void;
  sendRealtimeInput(input: { media: Blob }): void;
  sendToolResponse(response: {
    functionResponses: { id: string; name: string; response: { result: string } };
  }): void;
}

const FRAME_RATE = 1; // frames per second
const JPEG_QUALITY = 0.7;

export const useGeminiLive = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const frameIntervalRef = useRef<number | null>(null);

    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);
    
    const addTranscript = useCallback((entry: Omit<LiveTranscriptEntry, 'id' | 'timestamp'>) => {
        setTranscripts(prev => [...prev, { ...entry, id: `t-${Date.now()}`, timestamp: Date.now() }]);
    }, []);

    const takeScreenshot = async (): Promise<string> => {
        try {
            const canvas = await html2canvas(document.body, {
                backgroundColor: '#111827',
                useCORS: true,
            });
            return canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
            console.error("Failed to take screenshot:", error);
            showToast("Could not take screenshot.", "error");
            return '';
        }
    };
    
    const cleanup = useCallback(() => {
        console.log("Cleaning up Live session resources.");

        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setMediaStream(null);
        
        if (inputAudioContextRef.current?.state !== 'closed') {
            inputAudioContextRef.current?.close().catch(console.error);
        }
        if (outputAudioContextRef.current?.state !== 'closed') {
            outputAudioContextRef.current?.close().catch(console.error);
        }
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        setIsSessionActive(false);
        setIsConnecting(false);
    }, []);

    const closeSession = useCallback(() => {
        addTranscript({ source: 'system', text: 'Ending session...' });
        sessionPromiseRef.current?.then(session => {
            session.close();
        }).catch(e => {
            console.error("Error closing session, forcing cleanup.", e);
            cleanup();
        });
    }, [cleanup, addTranscript]);

    const startSession = useCallback(async (inputType: 'audio' | 'webcam' | 'screen') => {
        if (isSessionActive || isConnecting) return;

        setIsConnecting(true);
        setTranscripts([]);
        addTranscript({ source: 'system', text: 'Starting session... Requesting permissions.' });

        try {
            let stream: MediaStream;
            if (inputType === 'screen') {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always" } as any
                });
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                const videoTrack = screenStream.getVideoTracks()[0];
                const audioTrack = audioStream.getAudioTracks()[0];

                videoTrack.addEventListener('ended', () => {
                    closeSession();
                });

                stream = new MediaStream([videoTrack, audioTrack]);
            } else {
                 stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true, 
                    video: inputType === 'webcam' 
                });
            }
            
            mediaStreamRef.current = stream;
            setMediaStream(stream);
        } catch (error) {
            console.error("Media permission denied:", error);
            showToast("Microphone, camera, or screen share access is required.", 'error');
            cleanup();
            return;
        }

        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const ai = getAI();
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    setIsConnecting(false);
                    setIsSessionActive(true);
                    addTranscript({ source: 'system', text: 'Connection opened. You can start speaking.' });

                    const stream = mediaStreamRef.current!;

                    // Audio processing
                    const audioTrack = stream.getAudioTracks()[0];
                    if (audioTrack) {
                        const audioStream = new MediaStream([audioTrack]);
                        const source = inputAudioContextRef.current!.createMediaStreamSource(audioStream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    }

                    // Video frame processing
                    const videoTrack = stream.getVideoTracks()[0];
                    if (videoTrack) {
                        const videoEl = document.createElement('video');
                        videoEl.srcObject = new MediaStream([videoTrack]);
                        videoEl.muted = true;
                        videoEl.play();
                        
                        const canvasEl = document.createElement('canvas');
                        const ctx = canvasEl.getContext('2d');

                        frameIntervalRef.current = window.setInterval(() => {
                            if (!ctx) return;
                            canvasEl.width = videoEl.videoWidth;
                            canvasEl.height = videoEl.videoHeight;
                            ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                            canvasEl.toBlob(
                                async (blob) => {
                                    if (blob) {
                                        const base64Data = await blobToBase64(blob);
                                        sessionPromiseRef.current?.then((session) => {
                                            session.sendRealtimeInput({
                                                media: { data: base64Data, mimeType: 'image/jpeg' }
                                            });
                                        });
                                    }
                                }, 'image/jpeg', JPEG_QUALITY
                            );
                        }, 1000 / FRAME_RATE);
                    }
                },
                onmessage: async (message: LiveServerMessage) => {
                    const updateTranscript = (source: 'user' | 'model', text: string) => {
                        setTranscripts(prev => {
                            const last = prev.length > 0 ? prev[prev.length - 1] : null;
                            if (last && last.source === source && !last.image) {
                                const updatedLast = { ...last, text: (last.text || '') + text };
                                return [...prev.slice(0, -1), updatedLast];
                            } else {
                                const newEntry: LiveTranscriptEntry = {
                                    id: `t-${Date.now()}-${Math.random()}`,
                                    source,
                                    text,
                                    timestamp: Date.now(),
                                };
                                return [...prev, newEntry];
                            }
                        });
                    };

                    if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                         const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                         const outputAudioContext = outputAudioContextRef.current!;
                         nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                         const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                         const source = outputAudioContext.createBufferSource();
                         source.buffer = audioBuffer;
                         source.connect(outputAudioContext.destination);
                         source.addEventListener('ended', () => sourcesRef.current.delete(source));
                         source.start(nextStartTimeRef.current);
                         nextStartTimeRef.current += audioBuffer.duration;
                         sourcesRef.current.add(source);
                    }
                    if(message.serverContent?.inputTranscription) {
                        updateTranscript('user', message.serverContent.inputTranscription.text);
                    }
                    if(message.serverContent?.outputTranscription) {
                        updateTranscript('model', message.serverContent.outputTranscription.text);
                    }
                    if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(s => s.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                    if (message.toolCall?.functionCalls) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'take_screenshot') {
                                addTranscript({ source: 'system', text: 'Taking screenshot as requested...' });
                                const image = await takeScreenshot();
                                if (image) {
                                    addTranscript({ source: 'user', image: image, text: "(Screenshot attached)" });
                                    sessionPromiseRef.current?.then(session => session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: "Screenshot taken successfully and added to transcript." } }
                                    }));
                                }
                            }
                        }
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error("Live session error:", e);
                    addTranscript({ source: 'system', text: `An unrecoverable error occurred: ${e.message}. Please close and restart the session.` });
                    cleanup();
                },
                onclose: (e: CloseEvent) => {
                    console.log("Live session closed.", e);
                    addTranscript({ source: 'system', text: `Connection closed (Code: ${e.code}).` });
                    cleanup();
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: `You are Nano, a helpful AI assistant for debugging the Manhwa Studio app. You can take screenshots on command. You have access to the application's full source code. When the user points out an issue, analyze their speech, the visual input (screen/camera), and cross-reference with the provided source code to help them identify and document issues with technical precision.
                --- APPLICATION SOURCE CODE ---
                ${SOURCE_CODE_CONTEXT}
                --- END SOURCE CODE ---`,
                tools: [{ functionDeclarations: [takeScreenshotTool] }]
            }
        });

    }, [isSessionActive, isConnecting, addTranscript, cleanup, closeSession]);
    
    const sendImage = useCallback(async (base64Data: string) => {
        if (!isSessionActive) {
            showToast("Session not active.", 'error');
            return;
        }
        addTranscript({ source: 'user', image: `data:image/jpeg;base64,${base64Data}`, text: "(Image uploaded)"});
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'image/jpeg' }
            });
        });
    }, [isSessionActive, addTranscript]);

    useEffect(() => {
        // Component unmount cleanup
        return () => {
             sessionPromiseRef.current?.then(session => {
                session.close();
            }).catch(() => {});
            cleanup();
        };
    }, [cleanup]);

    return { isSessionActive, isConnecting, transcripts, mediaStream, startSession, closeSession, sendImage };
};