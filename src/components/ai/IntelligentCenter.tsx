import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, CheckCircle, Clock, Zap, Brain, Shield } from 'lucide-react';
import { YYC3_DESIGN } from '@/utils/design-system';

// --- Types ---
interface ModuleNode {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'active' | 'idle' | 'warning';
  x: number;
  y: number;
  color: string; // Tailwind class string for ease, or use Design System
}

interface IntelligentCenterProps {
  active: boolean;
  onClose: () => void;
  onLaunchModule: (moduleId: string) => void;
}

export function IntelligentCenter({ active, onClose, onLaunchModule }: IntelligentCenterProps) {
  const [nodes, setNodes] = useState<ModuleNode[]>([
    { id: 'tasks', label: '任务舱', icon: CheckCircle, status: 'active', x: 30, y: 30, color: 'text-emerald-400 border-emerald-500/50 bg-emerald-900/20' },
    { id: 'memory', label: '记忆库', icon: Brain, status: 'idle', x: 70, y: 30, color: 'text-purple-400 border-purple-500/50 bg-purple-900/20' },
    { id: 'security', label: '安全层', icon: Shield, status: 'idle', x: 50, y: 70, color: 'text-cyan-400 border-cyan-500/50 bg-cyan-900/20' },
  ]);

  // Simulated "Breathing" animation for nodes
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prev => prev.map(n => ({
        ...n,
        x: n.x + (Math.random() - 0.5) * 2, // Subtle drift
        y: n.y + (Math.random() - 0.5) * 2
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Darker background for Hub emphasis
          className={`fixed inset-0 z-40 bg-black/80 ${YYC3_DESIGN.blur.glass} flex items-center justify-center overflow-hidden`}
          onClick={(e) => {
             if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Background Grid - Neural Network Vibe */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
          </div>

          <div className="relative w-full h-full max-w-4xl max-h-[80vh] mx-auto p-4">
             {/* Header */}
             <motion.div 
               initial={{ y: -50, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="text-center mb-10"
             >
                <h2 className="text-2xl font-light text-white tracking-[0.5em] uppercase">Intelligent Center</h2>
                <div className="flex justify-center items-center gap-2 text-cyan-500/60 text-xs font-mono mt-2">
                    <Activity className="w-3 h-3 animate-pulse" />
                    SYSTEM OPTIMAL
                </div>
             </motion.div>

             {/* Nodes Container */}
             <div className="relative w-full h-[60vh]">
                {/* Connecting Lines (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                    <line x1="30%" y1="30%" x2="50%" y2="70%" stroke={YYC3_DESIGN.colors.cyan.primary} strokeWidth="1" strokeDasharray="5,5" className="animate-pulse" />
                    <line x1="70%" y1="30%" x2="50%" y2="70%" stroke={YYC3_DESIGN.colors.purple.primary} strokeWidth="1" strokeDasharray="5,5" className="animate-pulse" />
                    <line x1="30%" y1="30%" x2="70%" y2="30%" stroke={YYC3_DESIGN.colors.emerald.primary} strokeWidth="1" strokeOpacity="0.5" />
                </svg>

                {nodes.map((node) => (
                    <motion.button
                        key={node.id}
                        layout
                        initial={{ scale: 0 }}
                        animate={{ 
                            left: `${node.x}%`, 
                            top: `${node.y}%`, 
                            scale: 1,
                            transition: YYC3_DESIGN.physics.spring
                        }}
                        whileHover={{ scale: 1.2, zIndex: 10 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onLaunchModule(node.id)}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border backdrop-blur-md flex flex-col items-center justify-center gap-2 group shadow-[0_0_30px_rgba(0,0,0,0.5)] ${node.color}`}
                    >
                        <node.icon className="w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity" />
                        <span className="text-xs font-bold tracking-widest uppercase">{node.label}</span>
                        
                        {/* Status Ring */}
                        <div className="absolute inset-0 rounded-full border border-current opacity-30 animate-[spin_10s_linear_infinite]" style={{ borderStyle: 'dashed' }} />
                        <div className="absolute inset-[-4px] rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                ))}

                {/* Center "Core" */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-to-b from-cyan-500/10 to-blue-500/10 rounded-full blur-2xl animate-pulse" />
             </div>

             {/* Footer Data Stream */}
             <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-0 left-0 right-0 h-10 border-t border-white/5 bg-black/40 backdrop-blur flex items-center px-6 overflow-hidden"
             >
                <div className="flex gap-8 animate-[translateX_-50%_20s_linear_infinite] whitespace-nowrap text-[10px] font-mono text-white/30">
                    <span>CPU: 12%</span>
                    <span>MEMORY_VECTOR: 842 NODES</span>
                    <span>SYNC_STATUS: CONNECTED</span>
                    <span>LATENCY: 24ms</span>
                    <span>SECURITY_LEVEL: ALPHA</span>
                    <span>ACTIVE_AGENTS: 1</span>
                    {/* Repeat for seamless loop */}
                    <span>CPU: 12%</span>
                    <span>MEMORY_VECTOR: 842 NODES</span>
                    <span>SYNC_STATUS: CONNECTED</span>
                    <span>LATENCY: 24ms</span>
                </div>
             </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
