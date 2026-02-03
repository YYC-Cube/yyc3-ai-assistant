import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { CubeVisual } from './ai/CubeVisual';
import { ConfigPanel } from './ai/ConfigPanel';
import { DebateOverlay } from './ai/DebateOverlay'; 
import { OrbitalMenu } from './ai/OrbitalMenu'; 
import { MultimodalArtifact } from './ai/MultimodalArtifact';
import { IntelligentCenter } from './ai/IntelligentCenter'; 
import { TaskPod } from './modules/TaskPod'; 
import { Activity, Image as ImageIcon, MicOff, Send, AlertTriangle } from 'lucide-react'; 
import { useSpeech } from '@/hooks/useSpeech';
import { useAI } from '@/hooks/useAI';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'; 

export function ResponsiveAIAssistant() {
  // --- UI State ---
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDebate, setShowDebate] = useState(false); 
  const [showOrbitalMenu, setShowOrbitalMenu] = useState(false); 
  const [showIntelligentCenter, setShowIntelligentCenter] = useState(false); 
  const [showTaskPod, setShowTaskPod] = useState(false); 
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 }); 
  const [showGuide, setShowGuide] = useState(true);
  const [textMode, setTextMode] = useState(false); 
  const [textInput, setTextInput] = useState('');
  const [themeColor, setThemeColor] = useState<'cyan' | 'red'>('cyan');
  
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
    sendMessage 
  } = useAI(commands());

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
      const images = pendingImage ? [pendingImage] : undefined;
      setPendingImage(null); 
      sendMessage(finalTranscript, images).then(handleAIResponse);
  });

  const handleAIResponse = useCallback((responseText: string) => {
      if (responseText) speak(responseText, config);
  }, [config, speak]); 

  // --- Error Handling Effect ---
  useEffect(() => {
      if (speechError === 'permission-denied' || speechError === 'not-supported') {
          setTextMode(true);
          toast.error("无法访问麦克风", {
              description: "已自动切换至键盘输入模式。请检查浏览器权限设置。",
              icon: <MicOff className="w-4 h-4" />
          });
          clearSpeechError();
      }
  }, [speechError, clearSpeechError, config]);

  // --- Handlers ---
  const handleTextSubmit = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!textInput.trim()) return;
      
      setShowGuide(false);
      const images = pendingImage ? [pendingImage] : undefined;
      setPendingImage(null);
      
      sendMessage(textInput, images).then(handleAIResponse);
      setTextInput('');
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
              if (!textMode) speak("已捕获视觉数据。您可以查看全息投影。", config);
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Derived State ---
  const [debateStatus, setDebateStatus] = useState<'idle' | 'processing' | 'speaking'>('idle');
  const currentVisualState = debateStatus !== 'idle' ? debateStatus : (processingState === 'processing' ? 'processing' : speechState);

  // --- Effects ---
  useEffect(() => {
    const timer = setTimeout(() => setShowGuide(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // --- Gestures ---
  const handleTouchStart = (e: React.PointerEvent) => {
    // Block triggers if any modal is open
    if (textMode || showDebate || showConfig || showHistory || showOrbitalMenu || inspectingArtifact || showIntelligentCenter || showTaskPod) return; 
    
    // 1. Long Press for Speech
    longPressTimerRef.current = setTimeout(() => {
      startListening();
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); 

    // 2. Double Tap Logic
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
    if (textMode || showDebate || showConfig || showHistory || inspectingArtifact || showIntelligentCenter || showTaskPod) return; 
    const threshold = 60;
    
    // Swipe Up -> Text Mode
    if (info.offset.y < -threshold) { 
        setTextMode(true);
        setShowGuide(false); 
    }
    // Swipe Right -> History
    else if (info.offset.x > threshold) { 
        setShowHistory(true); 
        setShowGuide(false); 
    }
  };

  // --- Theme ---
  const isRed = themeColor === 'red';
  const themeClasses = {
      bg: isRed ? 'bg-[#1a0505] text-red-100' : 'bg-[#05080f] text-slate-100',
      blob1: isRed ? 'bg-red-900/20' : 'bg-cyan-900/10',
      blob2: isRed ? 'bg-orange-900/20' : 'bg-blue-900/10',
      visualizer: isRed ? 'bg-orange-500' : 'bg-red-500',
      historyBg: isRed ? 'bg-[#1a0505]/95 border-red-500/20' : 'bg-[#0a0f1c]/95 border-cyan-500/20',
      userMsg: isRed ? 'bg-red-900/30 text-red-100 border-red-500/20' : 'bg-cyan-900/30 text-cyan-100 border-cyan-500/20',
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
      {/* 1. Ambient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div 
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full blur-[100px] transition-colors duration-1000 ${themeClasses.blob1}`} 
        />
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[100px] transition-colors duration-1000 ${themeClasses.blob2}`} 
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
      </div>

      {/* 2. Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm border-4 border-dashed m-4 rounded-3xl ${themeClasses.dropOverlay}`}
            >
                <div className="text-2xl font-light tracking-widest animate-pulse flex flex-col items-center gap-4">
                    <ImageIcon className="w-16 h-16" />
                    投喂图像数据
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Guide Overlay */}
      <AnimatePresence>
        {showGuide && !isDragging && !speechError && !textMode && !showDebate && !inspectingArtifact && !showIntelligentCenter && !showTaskPod && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-15 flex flex-col items-center justify-center pointer-events-none"
          >
             <div className="absolute top-1/4 text-white/20 text-sm font-light tracking-[0.2em] animate-pulse">长按说话 · 双击菜单</div>
             <div className="absolute bottom-1/4 text-white/20 text-sm font-light tracking-[0.2em] animate-pulse">上滑打字 · 右滑记忆</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Main Stage (Zero UI - No HUD) */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center pointer-events-none">
        
        {/* Core Visual */}
        <div className={`pointer-events-auto z-30 transition-all duration-500 ${textMode ? 'scale-75 -translate-y-12' : ''}`}>
           <CubeVisual 
             state={currentVisualState} 
             onClick={() => {
                 if (textMode || showDebate || inspectingArtifact || showIntelligentCenter || showTaskPod) return;
                 speechState === 'listening' ? stopListening() : startListening();
             }}
             analyserNode={analyserNode}
           />
        </div>

        {/* Captions */}
        <div className={`absolute bottom-24 w-full px-6 text-center transition-all duration-500 ${textMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
                     className={`h-[1px] bg-gradient-to-r from-transparent ${themeClasses.divider} to-transparent mt-4 mx-auto max-w-[100px]`}
                   />
                 )}
               </motion.div>
             ) : (<div className="h-8" />)}
           </AnimatePresence>
        </div>

        {/* Visualizer when Listening */}
        {!textMode && speechState === 'listening' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
             className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1"
           >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [10, 30, 10] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  className={`w-1 rounded-full ${themeClasses.visualizer}`}
                />
              ))}
           </motion.div>
        )}
      </div>

      {/* 5. Text Mode Input (Gesture Triggered) */}
      <AnimatePresence>
        {textMode && (
            <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-0 inset-x-0 p-6 z-40 bg-gradient-to-t from-black/90 to-transparent pb-10 pointer-events-auto"
            >
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-red-400 flex items-center gap-1 opacity-70">
                         {speechError === 'permission-denied' && <><AlertTriangle className="w-3 h-3"/> 语音系统离线</>}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setTextMode(false)} className="text-white/50 hover:text-white">
                         <MicOff className="w-4 h-4 mr-1" /> 关闭键盘
                    </Button>
                </div>
                <form onSubmit={handleTextSubmit} className="max-w-md mx-auto relative flex gap-2">
                    <Input 
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="输入指令或对话..."
                        className="bg-white/10 border-white/10 text-white placeholder:text-white/30 backdrop-blur-md rounded-2xl h-12 px-4 focus:ring-1 focus:ring-cyan-500/50"
                        autoFocus
                    />
                    <Button type="submit" size="icon" className="h-12 w-12 rounded-2xl bg-cyan-600 hover:bg-cyan-500">
                        <Send className="w-5 h-5" />
                    </Button>
                </form>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 6. History Drawer (Gesture Triggered) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`absolute inset-y-0 right-0 w-full md:w-96 backdrop-blur-xl border-l z-40 flex flex-col pointer-events-auto ${themeClasses.historyBg}`}
          >
             <div className="p-6 border-b border-white/10 flex justify-between items-center">
                 <h2 className="text-lg font-bold text-white">思维链记忆</h2>
                 <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                     <Activity className="w-5 h-5 text-gray-400" />
                 </Button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.images && msg.images.map((img, idx) => (
                            <div key={idx} onClick={() => {
                                setInspectingArtifact({ type: 'image', content: img });
                                setShowHistory(false);
                            }}>
                                <img src={`data:image/jpeg;base64,${img}`} className="w-32 h-32 object-cover rounded-xl border border-white/10 cursor-pointer hover:border-cyan-500/50 transition-colors" />
                            </div>
                        ))}
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' 
                        ? themeClasses.userMsg + ' border'
                        : 'bg-white/5 opacity-80 border border-white/5'
                        }`}>
                        {msg.content}
                        </div>
                    </div>
                  </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Orbital Menu (Gesture Triggered) */}
      <OrbitalMenu 
         isOpen={showOrbitalMenu}
         setIsOpen={setShowOrbitalMenu}
         position={menuPosition}
         onOpenSettings={() => setShowConfig(true)}
         onOpenHistory={() => setShowHistory(true)}
         onOpenDebate={() => setShowDebate(true)}
         onToggleTextMode={() => setTextMode(true)}
         onOpenHub={() => setShowIntelligentCenter(true)}
      />

      {/* 8. Config Panel (Floating Modal) */}
      <ConfigPanel 
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        config={config}
        onSave={updateConfig}
      />

      {/* 9. Debate Overlay */}
      <DebateOverlay 
        isOpen={showDebate}
        onClose={() => setShowDebate(false)}
        mainConfig={config}
        onSpeak={speak}
        onStatusChange={setDebateStatus}
      />

      {/* 10. Multimodal Artifact Inspection */}
      <AnimatePresence>
        {inspectingArtifact && (
            <MultimodalArtifact 
                type={inspectingArtifact.type}
                content={inspectingArtifact.content}
                transcript={speechState === 'listening' ? transcript : ''}
                onClose={() => setInspectingArtifact(null)}
            />
        )}
      </AnimatePresence>

      {/* 11. Intelligent Center (Hub) */}
      <IntelligentCenter 
        active={showIntelligentCenter}
        onClose={() => setShowIntelligentCenter(false)}
        onLaunchModule={(id) => {
            if (id === 'tasks') {
                setShowIntelligentCenter(false);
                setShowTaskPod(true);
            } else {
                toast.info("模块构建中", {
                  description: "该神经节点尚未激活",
                  icon: <Brain className="w-4 h-4 text-purple-400" />
                });
            }
        }}
      />

      {/* 12. Zero UI Task Pod (Case 1) */}
      <TaskPod 
        isOpen={showTaskPod}
        onClose={() => setShowTaskPod(false)}
        transcript={speechState === 'listening' ? transcript : ''}
      />

    </motion.div>
  );
}
