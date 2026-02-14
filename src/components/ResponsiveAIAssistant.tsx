import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { CubeVisual } from './ai/CubeVisual';
import { ConfigPanel } from './ai/ConfigPanel';
import { DebateOverlay } from './ai/DebateOverlay'; 
import { OrbitalMenu } from './ai/OrbitalMenu'; 
import { MultimodalArtifact } from './ai/MultimodalArtifact';
import { IntelligentCenter } from './ai/IntelligentCenter'; 
import { TaskPod } from './modules/TaskPod'; 
import { TerminalPanel } from './ai/TerminalPanel';
import { MCPServerPanel } from './modules/MCPServerPanel';
import { WorkflowPanel } from './modules/WorkflowPanel';
import { AIGeneratorPanel } from './ai/AIGeneratorPanel';
import { PageSwitcher } from './ui/PageSwitcher';
import { SecurityModule } from './ai/SecurityModule';
import { Activity, Image as ImageIcon, MicOff, Send, AlertTriangle, ChevronUp, Clock, Calendar, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerRightDown, CornerDownLeft, CornerUpRight, CornerUpLeft, Sparkles, Trash2, CheckCircle, Moon, Sun, Cpu, Wifi, Battery, Zap } from 'lucide-react'; 
import { useSpeech } from '@/hooks/useSpeech';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'; 
import { YYC3_DESIGN } from '@/utils/design-system'; 
import { YYC3Background } from './YYC3Background';
import { useAppStore } from '@/stores/app-store';
import { useAuthStore } from '@/stores/auth-store';

// Brand logo / 品牌 Logo
import logoMini from "figma:asset/0f4f28ac8ee9261af0049b986719468fb0b2a075.png";

// --- Futuristic HUD Component ---
const HUDOverlay = ({ themeColor, speechState }: { themeColor: 'cyan' | 'red', speechState: string }) => {
    const colorClass = themeColor === 'cyan' ? 'text-cyan-400 border-cyan-500/30' : 'text-red-400 border-red-500/30';
    const glowClass = themeColor === 'cyan' ? 'shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'shadow-[0_0_10px_rgba(248,113,113,0.2)]';

    return (
        <div className="absolute inset-4 pointer-events-none z-10 flex flex-col justify-between select-none overflow-hidden">
            {/* Top Bar */}
            <div className="flex justify-between items-start">
                <div className={`flex items-center gap-2 border-l-2 ${colorClass} pl-2 opacity-70`}>
                    <img 
                        src={logoMini} 
                        alt="YYCC" 
                        className="w-5 h-5 object-contain"
                        style={{ filter: themeColor === 'cyan' 
                            ? 'drop-shadow(0 0 4px rgba(34,211,238,0.6))' 
                            : 'drop-shadow(0 0 4px rgba(248,113,113,0.6)) hue-rotate(160deg) saturate(1.2)' 
                        }}
                    />
                    <span className="font-mono text-[10px] tracking-widest">YYCC.CORE.V7</span>
                </div>
                <div className="flex gap-1">
                     {[...Array(12)].map((_, i) => (
                         <div key={i} className={`w-1 h-2 ${i < 8 ? (themeColor === 'cyan' ? 'bg-cyan-500' : 'bg-red-500') : 'bg-gray-800'} opacity-50`} />
                     ))}
                </div>
                <div className={`flex items-center gap-2 border-r-2 ${colorClass} pr-2 opacity-70`}>
                    <span className="font-mono text-[10px] tracking-widest">{new Date().toLocaleTimeString([], {hour12: false})}</span>
                    <Wifi className="w-4 h-4" />
                </div>
            </div>

            {/* Corner Brackets */}
            <div className={`absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 ${colorClass}`} />
            <div className={`absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 ${colorClass}`} />
            <div className={`absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 ${colorClass}`} />
            <div className={`absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 ${colorClass}`} />

            {/* Side Data Lines */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-24 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-24 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

            {/* Bottom Bar */}
            <div className="flex justify-between items-end">
                <div className="flex flex-col gap-1 opacity-60">
                    <div className="text-[8px] font-mono text-white/40">COORDS: {Math.floor(Math.random()*1000)}.{Math.floor(Math.random()*100)} / {Math.floor(Math.random()*1000)}.{Math.floor(Math.random()*100)}</div>
                    <div className={`h-[1px] w-24 ${themeColor === 'cyan' ? 'bg-cyan-500' : 'bg-red-500'}`} />
                </div>
                
                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono tracking-widest ${speechState === 'listening' ? 'animate-pulse text-white' : 'text-white/30'}`}>
                        {speechState === 'listening' ? '● LISTENING' : '○ STANDBY'}
                    </span>
                    <Battery className="w-4 h-4 text-white/50" />
                </div>
            </div>
        </div>
    );
};

export function ResponsiveAIAssistant() {
  // --- Zustand Stores ---
  const { themeColor, setThemeColor, toggleTheme, initializeTheme } = useAppStore();
  const { connectionStatus } = useAuthStore();

  // --- UI State ---
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDebate, setShowDebate] = useState(false); 
  const [showOrbitalMenu, setShowOrbitalMenu] = useState(false); 
  const [showIntelligentCenter, setShowIntelligentCenter] = useState(false); 
  const [showTaskPod, setShowTaskPod] = useState(false); 
  const [showMCPServer, setShowMCPServer] = useState(false); // NEW
  const [showWorkflow, setShowWorkflow] = useState(false); // NEW
  const [showAIGenerator, setShowAIGenerator] = useState(false); // NEW
  const [showPageSwitcher, setShowPageSwitcher] = useState(false); // NEW
  const [showSecurity, setShowSecurity] = useState(false); // Security Module
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 }); 
  const [showGuide, setShowGuide] = useState(true);
  const [textMode, setTextMode] = useState(false); 
  
  // Artifact Inspection State
  const [inspectingArtifact, setInspectingArtifact] = useState<{type: 'image' | 'text', content: string} | null>(null);

  // Image Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null); 
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Command Actions ---
  const commands = useCallback(() => ({
      openSettings: () => setShowConfig(true),
      openHistory: () => setShowHistory(true),
      closePanel: () => { setShowHistory(false); setShowConfig(false); },
      setThemeRed: () => setThemeColor('red'),
      setThemeCyan: () => setThemeColor('cyan'),
  }), []);

  // --- Core Hooks ---
  const { 
    messages, 
    config, 
    updateConfig, 
    processingState, 
    sendMessage,
    setMessages 
  } = useAI(commands());

  const clearMessages = () => setMessages([]);

  // --- Speech ---
  const { 
      speechState, 
      startListening, 
      stopListening, 
      speak, 
      transcript, 
      error: speechError,
      clearError: clearSpeechError,
      analyserNode
  } = useSpeech((finalTranscript) => {
      setShowGuide(false);
      // If we are in text mode, don't auto-send, just let the transcript fill the input
      if (!textMode) {
          const images = pendingImage ? [pendingImage] : undefined;
          setPendingImage(null); 
          sendMessage(finalTranscript, images).then(handleAIResponse);
      }
  });

  const handleAIResponse = useCallback((responseText: string) => {
      if (responseText) speak(responseText, config);
  }, [config, speak]); 

  // --- Error Handling Effect ---
  useEffect(() => {
      if (speechError === 'permission-denied' || speechError === 'not-supported') {
          setTextMode(true);
          toast.error("AUDIO SYSTEM FAILURE", {
              description: "Switching to manual input protocol.",
              icon: <MicOff className="w-4 h-4" />,
              style: { fontFamily: 'monospace' }
          });
          clearSpeechError();
      }
  }, [speechError, clearSpeechError, config]);

  // --- Navigation ---
  const handleSwitchPage = (pageId: string) => {
      // Close all panels
      setShowTaskPod(false);
      setShowMCPServer(false);
      setShowWorkflow(false);
      setShowAIGenerator(false);
      setShowIntelligentCenter(false);
      setShowHistory(false);
      setShowConfig(false);
      
      // Open selected
      switch(pageId) {
          case 'home': break; // Just close all overlays
          case 'tasks': setShowTaskPod(true); break;
          case 'mcp': setShowMCPServer(true); break;
          case 'workflow': setShowWorkflow(true); break;
          case 'ai_gen': setShowAIGenerator(true); break;
          case 'intelligent': setShowIntelligentCenter(true); break;
      }
  };

  const getCurrentPageId = () => {
      if (showTaskPod) return 'tasks';
      if (showMCPServer) return 'mcp';
      if (showWorkflow) return 'workflow';
      if (showAIGenerator) return 'ai_gen';
      if (showIntelligentCenter) return 'intelligent';
      return 'home';
  };

  // --- Handlers ---
  const handleTerminalSubmit = (text: string, image?: string) => {
      setShowGuide(false);
      setTextMode(false); 
      
      const images = image ? [image] : undefined;
      setPendingImage(null);
      
      sendMessage(text, images).then(handleAIResponse);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              setInspectingArtifact({ type: 'image', content: base64 });
              setPendingImage(base64);
              if (!textMode) speak("Visual data captured. Rendering hologram.", config);
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Derived State ---
  const [debateStatus, setDebateStatus] = useState<'idle' | 'processing' | 'speaking'>('idle');
  const currentVisualState = debateStatus !== 'idle' ? debateStatus : (processingState === 'processing' ? 'processing' : speechState);
  
  // --- Message Visibility State (Auto-dismiss) ---
  const [isMessageVisible, setIsMessageVisible] = useState(true);

  // --- Effects ---
  useEffect(() => {
    const timer = setTimeout(() => setShowGuide(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize theme from Zustand store on mount
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Auto-dismiss message after 1 minute
  useEffect(() => {
    if (messages.length > 0) {
      setIsMessageVisible(true);
      const timer = setTimeout(() => {
        setIsMessageVisible(false);
      }, 60000); // 60 seconds
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // --- Gestures ---
  const handleTouchStart = (e: React.PointerEvent) => {
    if (textMode || showDebate || showConfig || showHistory || showOrbitalMenu || inspectingArtifact || showIntelligentCenter || showTaskPod || showMCPServer || showWorkflow || showAIGenerator) return; 
    
    longPressTimerRef.current = setTimeout(() => {
      startListening();
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); 

    tapCountRef.current += 1;
    if (tapCountRef.current === 2) {
        clearTimeout(longPressTimerRef.current!); 
        longPressTimerRef.current = null;
        
        setShowOrbitalMenu(true);
        setMenuPosition({ x: e.clientX, y: e.clientY });
        tapCountRef.current = 0;
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    } else {
        tapTimerRef.current = setTimeout(() => {
            tapCountRef.current = 0;
        }, 300);
    }
  };

  const handleNativeTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && !inspectingArtifact && !showIntelligentCenter && !showTaskPod) {
          e.preventDefault(); 
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
          
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const centerX = (touch1.clientX + touch2.clientX) / 2;
          const centerY = (touch1.clientY + touch2.clientY) / 2;
          
          setShowOrbitalMenu(true);
          setMenuPosition({ x: centerX, y: centerY });
      }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) { 
        clearTimeout(longPressTimerRef.current); 
        longPressTimerRef.current = null; 
    }
  };

  const handlePanEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (textMode || showDebate || showConfig || showHistory || inspectingArtifact || showIntelligentCenter || showTaskPod || showMCPServer || showWorkflow || showAIGenerator) return; 
    
    const threshold = 60; 
    const x = info.offset.x;
    const y = info.offset.y;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    const isDiagonal = absX > threshold && absY > threshold;

    if (isDiagonal) {
        setShowGuide(false);
        if (navigator.vibrate) navigator.vibrate([20, 20]);

        if (x > 0 && y > 0) {
            setShowTaskPod(true);
            toast("PROTOCOL: TASK_POD", { icon: <CheckCircle className="w-4 h-4 text-emerald-400"/> });
        } else if (x < 0 && y > 0) {
            setShowDebate(true);
            toast("PROTOCOL: DEBATE_MATRIX", { icon: <Activity className="w-4 h-4 text-pink-400"/> });
        } else if (x > 0 && y < 0) {
            toast("SESSION REBOOT", { description: "Context cleared.", icon: <Sparkles className="w-4 h-4 text-yellow-400"/> });
        } else if (x < 0 && y < 0) {
            const newTheme = themeColor === 'cyan' ? 'red' : 'cyan';
            setThemeColor(newTheme);
            toast(`SYSTEM THEME: ${newTheme.toUpperCase()}`, { 
                icon: newTheme === 'cyan' ? <Moon className="w-4 h-4 text-cyan-400"/> : <Sun className="w-4 h-4 text-red-400"/> 
            });
        }
        return;
    }

    if (absY > absX && absY > threshold) {
        if (y < 0) { 
            setTextMode(true);
            setShowGuide(false); 
            if (navigator.vibrate) navigator.vibrate(20);
        } else { 
            setShowHistory(true); 
            setShowGuide(false); 
            if (navigator.vibrate) navigator.vibrate(20);
        }
    } else if (absX > absY && absX > threshold) {
        if (x < 0) {
             setShowIntelligentCenter(true);
             setShowGuide(false);
             if (navigator.vibrate) navigator.vibrate(20);
        } else {
             setShowConfig(true);
             setShowGuide(false);
             if (navigator.vibrate) navigator.vibrate(20);
        }
    }
  };

  // --- Theme ---
  const isRed = themeColor === 'red';
  const themeClasses = {
      bg: isRed ? 'bg-[#0f0202] text-red-100' : 'bg-[#020610] text-cyan-100',
      blob1: isRed ? 'bg-red-900/10' : 'bg-cyan-900/10',
      blob2: isRed ? 'bg-orange-900/10' : 'bg-blue-900/10',
      visualizer: isRed ? 'bg-orange-500' : 'bg-cyan-400',
      historyBg: isRed ? 'bg-[#0f0202]/95 border-red-500/20' : 'bg-[#020610]/95 border-cyan-500/20',
      userMsg: isRed ? 'bg-red-500/10 text-red-100 border-red-500/20' : 'bg-cyan-500/10 text-cyan-100 border-cyan-500/20',
      divider: isRed ? 'via-red-500/50' : 'via-cyan-500/50',
      dropOverlay: isRed ? 'bg-red-900/50 border-red-400' : 'bg-cyan-900/50 border-cyan-400'
  };

  return (
    <motion.div 
      className={`h-screen w-full font-sans overflow-hidden select-none relative touch-none transition-colors duration-1000 ${themeClasses.bg}`}
      onPointerDown={handleTouchStart}
      onTouchStart={handleNativeTouchStart}
      onPointerUp={handleTouchEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPanEnd={handlePanEnd}
    >
      {/* 1. Futuristic Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* YYC3 ASCII Art Background */}
        <YYC3Background />
        
        {/* Grid Lines */}
        <div className={`absolute inset-0 opacity-[0.03]`} 
             style={{ 
                 backgroundImage: `linear-gradient(${isRed ? '#ff0000' : '#00ffff'} 1px, transparent 1px), linear-gradient(90deg, ${isRed ? '#ff0000' : '#00ffff'} 1px, transparent 1px)`,
                 backgroundSize: '40px 40px'
             }}>
        </div>
        {/* Radial Glow */}
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] ${isRed ? 'bg-red-900/20' : 'bg-cyan-900/20'}`} 
        />
        {/* Scanlines */}
        <div className="absolute inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] pointer-events-none opacity-20"></div>
      </div>

      {/* 2. Drag Overlay (Holographic) */}
      <AnimatePresence>
        {isDragging && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md border-2 border-dashed m-8 rounded-xl ${themeClasses.dropOverlay}`}
            >
                <div className="text-xl font-mono tracking-widest animate-pulse flex flex-col items-center gap-6 text-center">
                    <div className="relative">
                        <ImageIcon className="w-20 h-20 opacity-50" />
                        <motion.div 
                           animate={{ rotate: 360 }}
                           transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                           className="absolute inset-[-10px] border-t-2 border-b-2 border-current rounded-full opacity-30" 
                        />
                    </div>
                    <div>
                        <p>DATA INGESTION MODE</p>
                        <p className="text-xs opacity-50 mt-2">RELEASE TO ANALYZE</p>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Guide Overlay - Tech Style */}
      <AnimatePresence>
        {showGuide && !isDragging && !speechError && !textMode && !showDebate && !inspectingArtifact && !showIntelligentCenter && !showTaskPod && !showMCPServer && !showWorkflow && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-15 pointer-events-none"
          >
             {/* Center Hints */}
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <div className="text-white/30 text-[10px] font-mono tracking-[0.3em] animate-pulse border px-4 py-1 border-white/10 rounded-full bg-black/20 backdrop-blur-sm">
                     HOLD: VOICE // DOUBLE: MENU
                 </div>
             </div>

             {/* Cardinal Points */}
             <div className="absolute top-16 w-full flex justify-center opacity-40 animate-pulse">
                <div className="flex flex-col items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <span className="text-[9px] font-mono tracking-widest">INPUT_TERMINAL</span>
                </div>
             </div>
             <div className="absolute bottom-16 w-full flex justify-center opacity-40 animate-pulse">
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono tracking-widest">MEMORY_STREAM</span>
                    <ArrowDown className="w-3 h-3" />
                </div>
             </div>
             <div className="absolute left-8 top-1/2 -translate-y-1/2 opacity-40 animate-pulse">
                <div className="flex flex-col items-center gap-1 -rotate-90">
                    <ArrowLeft className="w-3 h-3 rotate-90" />
                    <span className="text-[9px] font-mono tracking-widest">NEURAL_HUB</span>
                </div>
             </div>
             <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-40 animate-pulse">
                <div className="flex flex-col items-center gap-1 rotate-90">
                    <ArrowRight className="w-3 h-3 -rotate-90" />
                    <span className="text-[9px] font-mono tracking-widest">SYS_CONFIG</span>
                </div>
             </div>

             {/* Diagonal Points */}
             <div className="absolute top-16 left-12 opacity-30 animate-pulse hidden md:block">
                 <div className="flex flex-col items-center gap-1 -rotate-45">
                     <CornerRightDown className="w-3 h-3" />
                     <span className="text-[8px] font-mono tracking-widest">TASK_POD</span>
                 </div>
             </div>
             <div className="absolute top-16 right-12 opacity-30 animate-pulse hidden md:block">
                 <div className="flex flex-col items-center gap-1 rotate-45">
                     <CornerDownLeft className="w-3 h-3" />
                     <span className="text-[8px] font-mono tracking-widest">DEBATE_MOD</span>
                 </div>
             </div>
             <div className="absolute bottom-16 left-12 opacity-30 animate-pulse hidden md:block">
                 <div className="flex flex-col items-center gap-1 -rotate-135">
                     <CornerUpRight className="w-3 h-3" />
                     <span className="text-[8px] font-mono tracking-widest">RST_SESSION</span>
                 </div>
             </div>
             <div className="absolute bottom-16 right-12 opacity-30 animate-pulse hidden md:block">
                 <div className="flex flex-col items-center gap-1 rotate-135">
                     <CornerUpLeft className="w-3 h-3" />
                     <span className="text-[8px] font-mono tracking-widest">TGL_THEME</span>
                 </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Persistent HUD Overlay */}
      {!textMode && !showDebate && !showHistory && (
          <HUDOverlay themeColor={themeColor} speechState={speechState} />
      )}

      {/* 5. Main Stage */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center pointer-events-none">
        
        {/* Core Visual */}
        <div className={`pointer-events-auto z-30 transition-all duration-700 ${textMode ? 'scale-75 -translate-y-12 blur-sm opacity-50' : ''}`}>
           <CubeVisual 
             state={currentVisualState} 
             onClick={() => {
                 if (textMode || showDebate || inspectingArtifact || showIntelligentCenter || showTaskPod || showMCPServer || showWorkflow || showAIGenerator) return;
                 speechState === 'listening' ? stopListening() : startListening();
             }}
             analyserNode={analyserNode}
           />
           {/* Floor Reflection */}
           <div className={`absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-12 bg-gradient-to-t from-transparent ${isRed ? 'via-red-500/10' : 'via-cyan-500/10'} to-transparent opacity-50 blur-xl rounded-full transform scale-x-150`} />
        </div>

        {/* Captions - Holographic Style */}
        <div className={`absolute bottom-32 w-full px-6 text-center transition-all duration-500 ${textMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <AnimatePresence mode="wait">
             {messages.length > 0 && isMessageVisible ? (
               <motion.div
                 key={messages[messages.length - 1].id}
                 initial={{ opacity: 0, y: 20, scale: 0.9 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(10px)" }}
                 transition={{ type: "spring", stiffness: 300, damping: 30 }}
                 className="max-w-2xl mx-auto"
               >
                 <div className={`inline-block text-lg md:text-xl font-light leading-relaxed tracking-wide px-8 py-6 rounded-2xl backdrop-blur-xl border ${isRed ? 'bg-[#0f0505]/90 border-red-500/30 shadow-[0_0_40px_rgba(220,38,38,0.15)]' : 'bg-[#020610]/90 border-cyan-500/30 shadow-[0_0_40px_rgba(8,145,178,0.15)]'}`}>
                   <span className={isRed ? 'text-red-100' : 'text-cyan-100'}>
                        {messages[messages.length - 1].content}
                   </span>
                 </div>
               </motion.div>
             ) : (<div className="h-8" />)}
           </AnimatePresence>
        </div>

        {/* Visualizer when Listening */}
        {!textMode && speechState === 'listening' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
             className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-1.5"
           >
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [5, 25, 5], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                  className={`w-1 rounded-sm ${themeClasses.visualizer} shadow-[0_0_8px_currentColor]`}
                />
              ))}
           </motion.div>
        )}
      </div>

      {/* 6. Text Mode Input (Terminal Style) - UPGRADED */}
      <TerminalPanel 
         isOpen={textMode}
         onClose={() => setTextMode(false)}
         onSubmit={handleTerminalSubmit}
         speechState={speechState}
         onStartListening={startListening}
         onStopListening={stopListening}
         transcript={transcript}
         pendingImage={pendingImage}
         setPendingImage={setPendingImage}
      />

      {/* 7. Memory Stream (History) - Cyberpunk Style */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ y: "-100%" }} 
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", damping: 25 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(e, info) => {
                if (info.offset.y < -50) setShowHistory(false); 
            }}
            className={`absolute inset-0 z-40 flex flex-col pointer-events-auto backdrop-blur-3xl ${themeClasses.historyBg}`}
          >
             {/* Header */}
             <div className="pt-12 pb-4 px-6 border-b border-white/10 flex justify-between items-end bg-gradient-to-b from-black to-transparent">
                 <div>
                    <h2 className="text-2xl font-light text-white tracking-widest uppercase flex items-center gap-3">
                        <Clock className="w-6 h-6 text-cyan-500" />
                        <span className="font-mono">MEMORY_LOGS</span>
                    </h2>
                    <p className="text-[10px] font-mono text-cyan-500/50 mt-2 flex items-center gap-2">
                        <span>SESSION_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                    </p>
                 </div>
                 <div className="opacity-50 text-[10px] font-mono text-right">
                    <div>ENCRYPTED // {messages.length} FRAGMENTS</div>
                    <div className="mt-1 text-white/30">SWIPE UP TO DISMISS</div>
                 </div>
             </div>

             {/* Content Stream */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
                        <Activity className="w-16 h-16 text-cyan-500/50" />
                        <p className="font-mono text-sm">NO DATA FRAGMENTS FOUND</p>
                    </div>
                )}

                {messages.map((msg, index) => (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                     <div className="flex items-center gap-2 opacity-50">
                        <span className="text-[10px] font-mono">{msg.role === 'user' ? 'CMD_INPUT' : 'SYS_RESPONSE'}</span>
                        <div className={`h-[1px] w-12 ${isRed ? 'bg-red-500' : 'bg-cyan-500'}`} />
                     </div>
                     <div className={`max-w-[80%] p-4 rounded-2xl border backdrop-blur-md ${
                        msg.role === 'user' 
                        ? themeClasses.userMsg
                        : 'bg-white/5 border-white/10 text-gray-300'
                     }`}>
                        {msg.images && msg.images.length > 0 && (
                             <div className="mb-3">
                                 <img src={`data:image/jpeg;base64,${msg.images[0]}`} className="rounded-lg max-h-40 border border-white/10" alt="Context" />
                             </div>
                        )}
                        <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                     </div>
                  </motion.div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. Configuration Panel */}
      <ConfigPanel 
        isOpen={showConfig} 
        onClose={() => setShowConfig(false)} 
        config={config}
        onSave={updateConfig}
      />

      {/* 9. Intelligent Center (Left Swipe) - UPGRADED */}
      <IntelligentCenter 
         active={showIntelligentCenter}
         onClose={() => setShowIntelligentCenter(false)}
         onShowSwitcher={() => setShowPageSwitcher(true)}
         onLaunchModule={(id) => {
             setShowIntelligentCenter(false);
             if (id === 'tasks') setShowTaskPod(true);
             if (id === 'engine') setShowConfig(true);
             if (id === 'memory') setShowHistory(true);
             
             // Mapped Functions for User Request
             if (id === 'security') setShowSecurity(true);
             if (id === 'neural_net') setShowAIGenerator(true);
             if (id === 'mcp_server') setShowMCPServer(true);
             if (id === 'workflows') setShowWorkflow(true);
         }}
      />

      {/* 10. Task Pod (Diagonal Top-Left) */}
      <TaskPod 
         isOpen={showTaskPod}
         onClose={() => setShowTaskPod(false)}
         onShowSwitcher={() => setShowPageSwitcher(true)}
      />

      {/* 11. Orbital Menu (Double Tap) */}
      <OrbitalMenu 
        isOpen={showOrbitalMenu}
        onClose={() => setShowOrbitalMenu(false)}
        position={menuPosition}
        onSelect={(id) => {
            if (id === 'history') setShowHistory(true);
            if (id === 'config') setShowConfig(true);
            if (id === 'hub') setShowIntelligentCenter(true);
            if (id === 'debate') setShowDebate(true);
            if (id === 'textmode') setTextMode(true);
            if (id === 'reset') clearMessages();
            if (id === 'theme') toggleTheme();
        }}
      />

      {/* 12. Debate Overlay (Diagonal Top-Right) */}
      <DebateOverlay 
         isOpen={showDebate}
         onClose={() => setShowDebate(false)}
         initialTopic={messages.length > 0 ? messages[messages.length - 1].content : "The Future of AI"}
         mainConfig={config}
         onSpeak={speak}
         onStatusChange={setDebateStatus}
      />

      {/* 13. Artifact Inspector (Image Viewer) */}
      <AnimatePresence>
         {inspectingArtifact && (
             <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
                onClick={() => setInspectingArtifact(null)}
             >
                 <motion.div 
                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="relative max-w-full max-h-full"
                    onClick={e => e.stopPropagation()}
                 >
                     <img 
                        src={`data:image/jpeg;base64,${inspectingArtifact.content}`} 
                        className="rounded-lg border border-cyan-500/50 shadow-[0_0_50px_rgba(8,145,178,0.3)]" 
                        alt="Artifact"
                     />
                     <div className="absolute -bottom-12 left-0 right-0 text-center">
                         <p className="text-xs font-mono text-cyan-500 tracking-widest">ARTIFACT_ID: {Math.random().toString(16).substr(2, 8).toUpperCase()}</p>
                     </div>
                 </motion.div>
             </motion.div>
         )}
      </AnimatePresence>

      {/* 14. Multimodal Artifact Container (Dynamic Elements) */}
      <MultimodalArtifact messages={messages} />

      {/* 15. New Modules: MCP, Workflow, AI Gen */}
      <MCPServerPanel 
          isOpen={showMCPServer} 
          onClose={() => setShowMCPServer(false)} 
          onShowSwitcher={() => setShowPageSwitcher(true)}
      />
      <WorkflowPanel 
          isOpen={showWorkflow} 
          onClose={() => setShowWorkflow(false)} 
          onShowSwitcher={() => setShowPageSwitcher(true)}
      />
      <AIGeneratorPanel 
          isOpen={showAIGenerator} 
          onClose={() => setShowAIGenerator(false)} 
          onShowSwitcher={() => setShowPageSwitcher(true)}
      />

      {/* 16. Security Module */}
      <SecurityModule 
          isOpen={showSecurity}
          onClose={() => setShowSecurity(false)}
      />

      <PageSwitcher 
          isOpen={showPageSwitcher} 
          onClose={() => setShowPageSwitcher(false)} 
          onSwitch={handleSwitchPage}
          currentPage={getCurrentPageId()}
      />

    </motion.div>
  );
}