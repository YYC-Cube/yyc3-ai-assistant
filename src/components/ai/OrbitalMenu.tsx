import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, History, Users, Keyboard, X, Grid } from 'lucide-react';

interface OrbitalMenuProps {
    isOpen: boolean;
    onClose: () => void;
    position: { x: number; y: number };
    onSelect: (id: string) => void;
}

export function OrbitalMenu({ isOpen, onClose, position, onSelect }: OrbitalMenuProps) {
    const menuItems = [
        { id: 'hub', icon: Grid, label: '智能中心 / Hub', color: 'bg-indigo-500' },
        { id: 'config', icon: Settings, label: '设置 / Config', color: 'bg-cyan-500' },
        { id: 'history', icon: History, label: '记忆 / Memory', color: 'bg-purple-500' },
        { id: 'debate', icon: Users, label: '辩论 / Debate', color: 'bg-pink-500' },
        { id: 'textmode', icon: Keyboard, label: '输入 / Input', color: 'bg-emerald-500' },
    ];

    const radius = 90;
    const startAngle = -90;
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
                        onClick={onClose}
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
                            onClick={onClose}
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
                                        onSelect(item.id);
                                        onClose();
                                    }}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {/* Label Tooltip */}
                                    <div className="absolute top-full mt-2 text-[10px] font-medium text-white/80 whitespace-nowrap bg-black/50 px-2 py-0.5 rounded-full pointer-events-none opacity-0 group-hover:opacity-100">
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
