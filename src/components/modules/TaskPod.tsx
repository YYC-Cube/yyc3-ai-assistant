import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { Check, X, Plus, Clock, Mic } from 'lucide-react';
import { YYC3_DESIGN } from '@/utils/design-system';
import { useGaze } from '@/hooks/useGaze';

interface Task {
    id: string;
    text: string;
    completed: boolean;
    timestamp: number;
}

interface TaskPodProps {
    isOpen: boolean;
    onClose: () => void;
    transcript?: string; // For voice adding
}

export function TaskPod({ isOpen, onClose, transcript }: TaskPodProps) {
    const [tasks, setTasks] = useState<Task[]>([
        { id: '1', text: '初始化 YYC³ 神经核心', completed: true, timestamp: Date.now() },
        { id: '2', text: '同步量子记忆库', completed: false, timestamp: Date.now() },
    ]);

    // Handle voice commands
    useEffect(() => {
        if (!isOpen || !transcript) return;
        const lower = transcript.toLowerCase();
        
        if (lower.includes('添加') || lower.includes('add') || lower.includes('提醒')) {
            // Simple parsing: everything after keyword is task
            // Ideally use LLM, but here regex for demo
            const content = transcript.replace(/.*(添加|add|提醒)/i, '').trim();
            if (content.length > 2) {
                const newTask = {
                    id: Date.now().toString(),
                    text: content,
                    completed: false,
                    timestamp: Date.now()
                };
                setTasks(prev => [...prev, newTask]);
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }
    }, [transcript, isOpen]);

    const handleSwipe = (id: string, info: PanInfo) => {
        if (info.offset.x > 100) {
            // Swipe Right -> Complete
            setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
            if (navigator.vibrate) navigator.vibrate(20);
        } else if (info.offset.x < -100) {
            // Swipe Left -> Delete
            setTasks(prev => prev.filter(t => t.id !== id));
            if (navigator.vibrate) navigator.vibrate([30, 30]);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 50 }}
                    transition={YYC3_DESIGN.physics.spring}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-xl pointer-events-auto"
                >
                    {/* Header Area */}
                    <div className="w-full max-w-md mb-8 flex justify-between items-center">
                        <h2 className="text-2xl font-light text-emerald-400 tracking-widest uppercase flex items-center gap-2">
                            <span className="w-2 h-8 bg-emerald-500 rounded-full"/>
                            任务舱 (Task Pod)
                        </h2>
                        <button 
                            onClick={onClose}
                            className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Task Floating Grid */}
                    <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto h-[60vh] no-scrollbar pb-20">
                        <AnimatePresence>
                            {tasks.map((task) => (
                                <TaskCard key={task.id} task={task} onSwipe={handleSwipe} />
                            ))}
                        </AnimatePresence>
                        
                        {tasks.length === 0 && (
                            <div className="text-center text-white/20 mt-20">
                                任务队列空闲<br/>长按添加任务
                            </div>
                        )}
                    </div>

                    {/* Bottom Voice Hint */}
                    <div className="absolute bottom-10 flex flex-col items-center gap-2 opacity-50">
                        <Mic className="w-5 h-5 animate-pulse text-emerald-400" />
                        <span className="text-xs text-emerald-200/50">说 "添加 [任务内容]"</span>
                    </div>

                </motion.div>
            )}
        </AnimatePresence>
    );
}

function TaskCard({ task, onSwipe }: { task: Task, onSwipe: (id: string, info: PanInfo) => void }) {
    // Integrate Gaze
    const { isGazing, progress, gazeBindings } = useGaze({
        onGazeLock: () => {
            // Visual feedback handled by state
        }
    });

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0, scale: isGazing ? 1.05 : 1 }}
            exit={{ opacity: 0, height: 0 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, info) => onSwipe(task.id, info)}
            {...gazeBindings}
            className={`relative w-full p-5 rounded-2xl border backdrop-blur-md transition-colors group cursor-grab active:cursor-grabbing ${
                task.completed 
                ? 'bg-emerald-900/10 border-emerald-500/20 text-emerald-100/50' 
                : 'bg-white/5 border-white/10 text-white'
            } ${isGazing ? 'border-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.2)]' : ''}`}
        >
            {/* Gaze Progress Indicator */}
            {progress > 0 && progress < 1 && (
                <div 
                    className="absolute bottom-0 left-0 h-1 bg-emerald-500/50 transition-all duration-75" 
                    style={{ width: `${progress * 100}%` }}
                />
            )}

            <div className="flex items-start gap-4">
                <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/30'
                }`}>
                    {task.completed && <Check className="w-3 h-3 text-black" />}
                </div>
                <div className="flex-1">
                    <p className={`text-lg font-light ${task.completed ? 'line-through' : ''}`}>{task.text}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] opacity-40">
                        <Clock className="w-3 h-3" />
                        {new Date(task.timestamp).toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* Gesture Hints */}
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 flex items-center justify-start pl-2">
                <X className="w-4 h-4 text-red-400" />
            </div>
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 flex items-center justify-end pr-2">
                <Check className="w-4 h-4 text-emerald-400" />
            </div>
        </motion.div>
    );
}
