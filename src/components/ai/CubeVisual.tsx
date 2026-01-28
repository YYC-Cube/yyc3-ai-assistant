import React, { useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'motion/react';

interface CubeVisualProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  onClick?: () => void;
}

export function CubeVisual({ state, onClick }: CubeVisualProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Motion values for interactive rotation
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Smooth spring physics for rotation
  const rotateX = useSpring(useTransform(y, [-100, 100], [30, -30]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-100, 100], [-30, 30]), { stiffness: 150, damping: 20 });

  // Auto-rotation animation when not interacting
  const autoRotate = {
    rotateX: [15, 375],
    rotateY: [15, 375],
  };

  const glowColors = {
    idle: 'rgba(6, 182, 212, 0.4)',      // Cyan
    listening: 'rgba(239, 68, 68, 0.6)',  // Red
    processing: 'rgba(168, 85, 247, 0.7)', // Purple
    speaking: 'rgba(34, 197, 94, 0.6)'    // Green
  };

  return (
    <motion.div 
      className="relative w-72 h-72 flex items-center justify-center perspective-1000 cursor-grab active:cursor-grabbing"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onTap={onClick}
      style={{ perspective: 1000 }}
    >
      {/* Interactive Drag Area */}
      <motion.div
        className="relative w-32 h-32 preserve-3d"
        style={{ 
          rotateX: isHovered ? rotateX : 0, 
          rotateY: isHovered ? rotateY : 0,
        }}
        animate={!isHovered ? {
          rotateX: state === 'idle' ? [15, 375] : [0, 360],
          rotateY: state === 'idle' ? [15, 375] : [0, -360],
          scale: state === 'listening' ? 1.1 : 1
        } : undefined}
        transition={{ 
          rotateX: { duration: 20, repeat: Infinity, ease: "linear" },
          rotateY: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 0.5 }
        }}
        drag
        dragElastic={0.1}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        onDrag={(event, info) => {
          x.set(info.offset.x);
          y.set(info.offset.y);
        }}
        onDragEnd={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {/* Cube Faces */}
        {['front', 'back', 'right', 'left', 'top', 'bottom'].map((face) => {
            const transforms = {
                front: 'translateZ(64px)',
                back: 'rotateY(180deg) translateZ(64px)',
                right: 'rotateY(90deg) translateZ(64px)',
                left: 'rotateY(-90deg) translateZ(64px)',
                top: 'rotateX(90deg) translateZ(64px)',
                bottom: 'rotateX(-90deg) translateZ(64px)',
            };

            return (
                <div
                    key={face}
                    className="absolute inset-0 border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center transition-all duration-500"
                    style={{ 
                        transform: transforms[face as keyof typeof transforms],
                        boxShadow: `inset 0 0 20px ${glowColors[state]}`,
                        borderColor: state === 'listening' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.1)'
                    }}
                >
                    {/* Tech Grid Pattern */}
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-30">
                        <div className="border-r border-b border-white/30"></div>
                        <div className="border-b border-white/30"></div>
                        <div className="border-r border-white/30"></div>
                        <div></div>
                    </div>
                    
                    {/* Active State Pulse */}
                    {state === 'processing' && (
                         <div className="absolute inset-0 bg-purple-500/20 animate-pulse"></div>
                    )}
                </div>
            );
        })}
        
        {/* Internal Core (The "Soul") */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full blur-md animate-pulse" 
             style={{ 
               transform: 'translateZ(0px)',
               backgroundColor: state === 'listening' ? '#ef4444' : state === 'speaking' ? '#22c55e' : '#06b6d4'
             }}
        />
      </motion.div>
      
      {/* Dynamic Shadow */}
      <motion.div 
        className="absolute -bottom-24 w-40 h-10 blur-2xl rounded-[100%]"
        animate={{
          backgroundColor: glowColors[state],
          scale: state === 'listening' ? 1.2 : 1,
          opacity: 0.4
        }}
      />
    </motion.div>
  );
}
