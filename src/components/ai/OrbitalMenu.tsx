import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, History, Users, Cloud, X, Mic, Keyboard, Grid } from 'lucide-react';

interface MenuItem {
    id: string;
    icon: React.ElementType;
    label: string;
    action: () => void;
    color: string;
}

interface OrbitalMenuProps {
    onOpenSettings: () => void;
    onOpenHistory: () => void;
    onOpenDebate: () => void;
    onToggleTextMode: () => void;
    onOpenHub: () => void; // New prop
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    position: { x: number, y: number };
}

export function OrbitalMenu({ 
    onOpenSettings, 
    onOpenHistory, 
    onOpenDebate,
    onToggleTextMode,
    onOpenHub,
    isOpen, 
    setIsOpen,
    position
}: OrbitalMenuProps) {
    
    const menuItems: MenuItem[] = [
        { id: 'hub', icon: Grid, label: '智能中心', action: onOpenHub, color: 'bg-indigo-500' }, // Added Hub
        { id: 'settings', icon: Settings, label: '设置', action: onOpenSettings, color: 'bg-cyan-500' },
        { id: 'history', icon: History, label: '记忆', action: onOpenHistory, color: 'bg-purple-500' },
        { id: 'debate', icon: Users, label: '辩论', action: onOpenDebate, color: 'bg-pink-500' },
        { id: 'textmode', icon: Keyboard, label: '输入', action: onToggleTextMode, color: 'bg-emerald-500' },
    ];

    // Calculate orbital positions
    const radius = 90; // Slightly larger radius for 5 items
    const startAngle = -90; // Top
    const angleStep = 360 / menuItems.length;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu Container at touch position */}
                    <div 
                        className="fixed z-50 pointer-events-none"
                        style={{ left: position.x, top: position.y }}
                    >
                        {/* Central Close Button */}
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto hover:bg-white/20 transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </motion.button>

                        {/* Orbiting Items */}
                        {menuItems.map((item, index) => {
                            const angle = (startAngle + index * angleStep) * (Math.PI / 180);
                            const x = Math.cos(angle) * radius;
                            const y = Math.sin(angle) * radius;

                            return (
                                <motion.button
                                    key={item.id}
                                    initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                                    animate={{ 
                                        x, 
                                        y, 
                                        scale: 1, 
                                        opacity: 1,
                                        transition: { type: "spring", stiffness: 300, damping: 20, delay: index * 0.05 }
                                    }}
                                    exit={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full ${item.color} shadow-lg shadow-black/50 flex items-center justify-center text-white pointer-events-auto hover:scale-110 transition-transform`}
                                    onClick={() => {
                                        item.action();
                                        setIsOpen(false);
                                    }}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {/* Label Tooltip */}
                                    <div className="absolute top-full mt-2 text-[10px] font-medium text-white/80 whitespace-nowrap bg-black/50 px-2 py-0.5 rounded-full pointer-events-none opacity-0 hover:opacity-100">
                                        {item.label}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
