import { useState, useEffect, useRef } from 'react';

// Fix: Add types for Web Speech API to the global window interface to solve TS errors.
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Fix: Define an interface for the SpeechRecognition instance to avoid name collision.
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onend: () => void;
  onerror: (event: any) => void;
}

// Polyfill for browsers that might have webkitSpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useSpeechRecognition = (onResult: (transcript: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  // Fix: Use SpeechRecognitionInstance as the type for the ref to fix "refers to a value" error.
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Use a ref to hold the latest isListening value to avoid stale closures in callbacks.
  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;

  useEffect(() => {
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition: SpeechRecognitionInstance = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onResult(finalTranscript);
      }
    };
    
    recognition.onend = () => {
        // Use the ref here to get the current listening state, fixing the stale closure bug.
        if (isListeningRef.current) {
            recognition.start(); // auto-restart if it was intentionally listening
        }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResult]);
  
  const toggleListening = () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;

      if (isListening) {
          recognition.stop();
          setIsListening(false);
      } else {
          try {
              recognition.start();
              setIsListening(true);
          } catch(e) {
              console.error("Could not start recognition", e)
          }
      }
  };

  return { isListening, toggleListening, supported: !!SpeechRecognition };
};