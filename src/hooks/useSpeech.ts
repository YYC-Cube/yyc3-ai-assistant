import { useState, useEffect, useRef, useCallback } from 'react';
import { LLMConfig, fetchOpenAITTS } from '@/utils/llm';

class AudioVisualizer {
    audioContext: AudioContext | null = null;
    analyser: AnalyserNode | null = null;
    source: MediaStreamAudioSourceNode | null = null;

    init(stream: MediaStream) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.analyser);
        } catch (e) {
            // Silently fail for visualizer - it's non-essential
        }
    }

    cleanup() {
        if (this.source) {
            try {
                this.source.disconnect();
            } catch (e) {}
            this.source = null;
        }
    }
}

export const audioVisualizer = new AudioVisualizer();

export function useSpeech(onSpeechEnd?: (text: string) => void) {
    const [speechState, setSpeechState] = useState<'idle' | 'listening' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<'not-supported' | 'permission-denied' | null>(null);
    
    // Persistent permission flag to prevent repeated browser prompts/errors in one session
    const permissionDeniedRef = useRef(false);
    
    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const visualizerActiveRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.lang = 'zh-CN';

                recognition.onstart = () => {
                    setSpeechState('listening');
                    setTranscript('');
                };

                recognition.onresult = (event: any) => {
                    let currentTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        currentTranscript += event.results[i][0].transcript;
                    }
                    setTranscript(currentTranscript);
                };

                recognition.onerror = (event: any) => {
                    // Ignore 'no-speech' (timeout) as it's normal
                    if (event.error === 'no-speech') {
                         setSpeechState('idle');
                         return;
                    }

                    // Handle Permission Errors Quietly
                    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        permissionDeniedRef.current = true;
                        setError('permission-denied');
                        // Do not console.warn here to keep console clean
                    } else {
                        // Only warn for unexpected errors
                        console.warn('Speech recognition error:', event.error);
                    }
                    
                    setSpeechState('idle');
                };

                recognition.onend = () => {
                    setSpeechState('idle');
                };

                recognitionRef.current = recognition;
            } else {
                setError('not-supported');
            }
        }
    }, []);

    const latestTranscriptRef = useRef('');
    useEffect(() => { latestTranscriptRef.current = transcript; }, [transcript]);

    const startListening = useCallback(async () => {
        // If we already know permission is denied, don't try again (avoids console spam)
        if (speechState === 'listening' || permissionDeniedRef.current) {
            if (permissionDeniedRef.current) {
                // Re-trigger the error state so UI can show the Toast again if user tries
                setError('permission-denied');
            }
            return;
        }
        
        // 1. Try to initialize Visualizer (Silent Fail)
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioVisualizer.init(stream);
                visualizerActiveRef.current = true;
            }
        } catch (err) {
            // Visualizer failed (likely permission). 
            // We proceed to speech recognition anyway.
            // No console.warn to keep it clean.
        }

        // 2. Start Speech Recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Ignore if already started
            }
        } else {
            setError('not-supported');
        }
    }, [speechState]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch(e) {}
            
            if (latestTranscriptRef.current && onSpeechEnd) {
                onSpeechEnd(latestTranscriptRef.current);
            }
        }
        
        if (visualizerActiveRef.current) {
            audioVisualizer.cleanup();
            visualizerActiveRef.current = false;
        }
    }, [onSpeechEnd]);

    const speak = useCallback(async (text: string, config: LLMConfig) => {
        setSpeechState('speaking');
        
        try {
            if (config.ttsProvider === 'openai') {
                const audioBuffer = await fetchOpenAITTS(text, config);
                const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                
                const audio = new Audio(url);
                audioRef.current = audio;
                
                audio.onended = () => setSpeechState('idle');
                audio.play();
            } else {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'zh-CN';
                utterance.rate = config.ttsSpeed || 1.0;
                utterance.onend = () => setSpeechState('idle');
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {
            console.error("TTS Error", e);
            setSpeechState('idle');
        }
    }, []);

    return {
        speechState,
        startListening,
        stopListening,
        speak,
        transcript, 
        error,
        clearError: () => setError(null),
        analyserNode: audioVisualizer.analyser
    };
}
