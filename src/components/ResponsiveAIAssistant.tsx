import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { CubeVisual } from './ai/CubeVisual';
import { ConfigPanel } from './ai/ConfigPanel';
import { generateCompletion, DEFAULT_CONFIG, LLMConfig } from '@/utils/llm';
import { Mic, ChevronUp, Activity, Menu } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ResponsiveAIAssistant() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [appState, setAppState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  
  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Initialization ---
  useEffect(() => {
    // Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';
      
      recognition.onstart = () => {
        setAppState('listening');
        playSound('wake');
      };
      
      recognition.onend = () => {
        if (appState === 'listening') setAppState('idle'); 
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleUserInteraction(transcript);
      };

      recognitionRef.current = recognition;
    }

    // Speech Synthesis
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }

    // Welcome Sound
    playSound('startup');
  }, []);


  // --- Logic ---

  const playSound = (type: 'wake' | 'success' | 'startup') => {
    // Placeholder for sound effect logic
    // In a real app, this would play an Audio buffer
    // console.log(`[Sound] Playing ${type}`);
  };

  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    
    utterance.onstart = () => setAppState('speaking');
    utterance.onend = () => setAppState('idle');
    utterance.onerror = () => setAppState('idle');
    
    synthesisRef.current.speak(utterance);
  };

  const handleUserInteraction = async (text: string) => {
    if (!text.trim()) return;

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, newUserMsg]);
    
    setAppState('processing');
    playSound('success');

    try {
      const contextMessages = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));
      contextMessages.push({ role: 'user', content: text });
      
      const responseText = await generateCompletion(contextMessages, llmConfig);

      const newAiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: responseText };
      setMessages(prev => [...prev, newAiMsg]);

      speak(responseText);
    } catch (err) {
      setAppState('idle');
      speak("连接断开，请检查神经元网络配置。");
    }
  };

  const startListening = () => {
    try {
      if (appState !== 'listening') recognitionRef.current?.start();
    } catch (e) { console.error(e); }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setAppState('idle');
  };

  // --- Gestures ---

  // Long Press to Talk
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      startListening();
    }, 500); // 500ms long press triggers voice
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Note: We don't stop listening immediately on release to allow natural pause, 
    // relying on silence detection of the API, or user can tap again to stop.
    // For this prototype, let's keep it simple: Auto-stop handled by API silence or manual tap.
  };

  // Swipe Gestures
  const handlePanEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.y < -threshold) {
      // Swipe Up -> Show History
      setShowHistory(true);
    } else if (info.offset.y > threshold) {
      // Swipe Down -> Hide History / Close Config
      setShowHistory(false);
      setShowConfig(false);
    } else if (info.offset.x > threshold) {
      // Swipe Right -> Open Config (from left edge ideally, but general swipe for now)
      setShowConfig(true);
    } else if (info.offset.x < -threshold) {
      // Swipe Left -> Quick Action (e.g. Clear Context)
      // Implement specific logic if needed
    }
  };

  return (
    <div 
      className="h-screen w-full bg-[#05080f] text-slate-100 font-sans overflow-hidden select-none relative"
      onPointerDown={handleTouchStart}
      onPointerUp={handleTouchEnd}
    >
      {/* --- Ambient Background Layer --- */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-cyan-900/10 rounded-full blur-[100px]" 
        />
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-blue-900/10 rounded-full blur-[100px]" 
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
      </div>

      {/* --- Gesture Surface (Invisible Top Layer for Pan) --- */}
      <motion.div 
        className="absolute inset-0 z-10"
        onPanEnd={handlePanEnd}
      />

      {/* --- Main Content Layer --- */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center pointer-events-none">
        
        {/* Status HUD */}
        <div className="absolute top-12 w-full px-8 flex justify-between items-start opacity-60">
           <div className="flex flex-col gap-1">
             <span className="text-[10px] tracking-[0.3em] font-mono text-cyan-500">YYC³ SYSTEM</span>
             <span className="text-xs font-light text-slate-400">
               {appState === 'idle' ? 'STANDBY' : appState.toUpperCase()}
             </span>
           </div>
           <Activity className={`w-5 h-5 ${appState !== 'idle' ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
        </div>

        {/* The Core */}
        <div className="pointer-events-auto">
           <CubeVisual 
             state={appState} 
             onClick={() => appState === 'listening' ? stopListening() : startListening()} 
           />
        </div>

        {/* Dynamic Captions (Conversation Stream) */}
        <div className="absolute bottom-24 w-full px-6 text-center">
           <AnimatePresence mode="wait">
             {messages.length > 0 ? (
               <motion.div
                 key={messages[messages.length - 1].id}
                 initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                 animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                 exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                 className="max-w-md mx-auto"
               >
                 <p className="text-xl md:text-2xl font-light text-white/90 leading-relaxed drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                   "{messages[messages.length - 1].content}"
                 </p>
                 {messages[messages.length - 1].role === 'assistant' && (
                   <motion.div 
                     initial={{ width: 0 }} animate={{ width: "100%" }}
                     className="h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mt-4 mx-auto max-w-[100px]" 
                   />
                 )}
               </motion.div>
             ) : (
               <motion.div
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                 className="text-white/30 text-sm font-light tracking-widest"
               >
                 长按屏幕激活 · 上滑查看历史
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>

      {/* --- Overlay: History Drawer --- */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 h-[80vh] bg-[#0a0f1c]/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl z-40 flex flex-col pointer-events-auto"
          >
             {/* Handle */}
             <div className="w-full flex justify-center pt-4 pb-2" onClick={() => setShowHistory(false)}>
               <div className="w-12 h-1.5 bg-white/20 rounded-full" />
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                      ? 'bg-cyan-900/30 text-cyan-100 border border-cyan-500/20' 
                      : 'bg-white/5 text-slate-300'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-20">暂无对话记录</div>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Overlay: Config --- */}
      <ConfigPanel 
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        config={llmConfig}
        onSave={setLlmConfig}
      />

      {/* --- Navigation Hint (Bottom) --- */}
      <div className="absolute bottom-6 left-0 w-full flex justify-center opacity-30 pointer-events-none z-10">
         <ChevronUp className="w-6 h-6 animate-bounce" />
      </div>

    </div>
  );
}
