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
            console.warn("AudioVisualizer init failed", e);
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
    
    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    // Track if visualizer is active to avoid unnecessary cleanup calls
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
                    // Ignore 'no-speech' errors as they are common and not fatal
                    if (event.error === 'no-speech') {
                         setSpeechState('idle');
                         return;
                    }

                    console.warn('Speech recognition error:', event.error);
                    
                    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        setError('permission-denied');
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
        if (speechState === 'listening') return;
        
        // 1. Try to initialize Visualizer (Graceful Degradation)
        try {
            // Check if getUserMedia is supported
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioVisualizer.init(stream);
                visualizerActiveRef.current = true;
            } else {
                console.warn("navigator.mediaDevices.getUserMedia not supported in this environment");
            }
        } catch (err) {
            // If getUserMedia fails (e.g. Permission denied for audio stream), 
            // we catch it here but DO NOT stop the recognition process yet.
            // We just won't have the nice waveform.
            console.warn("Visualizer mic permission denied or error. Continuing without visualizer.", err);
        }

        // 2. Start Speech Recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // If it's already started, just ignore
                console.debug("Recognition start called but may be already active", e);
            }
        } else {
            // If recognition is not available at all
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
