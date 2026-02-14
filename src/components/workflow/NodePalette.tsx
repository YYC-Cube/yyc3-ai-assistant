/**
 * NodePalette - DAG 节点拖放面板
 * Drag-and-Drop Node Palette for DAG Editor
 * 
 * 赛博朋克风格侧边栏，支持拖拽添加节点到画布
 * audio_synth 节点标记为故障不可用
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
    Type, Cpu, Image, Volume2, ArrowRightFromLine, 
    GitBranch, Shuffle, AlertTriangle, GripVertical,
    FileText, Zap
} from 'lucide-react';
import type { CyberNodeType } from '@/stores/workflow-store';

// ============================================================
// 节点定义 / Node Definitions
// ============================================================

interface PaletteItem {
    type: CyberNodeType;
    label: string;
    labelEn: string;
    icon: React.ElementType;
    color: string;
    borderColor: string;
    description: string;
    isFault?: boolean;
}

const PALETTE_ITEMS: PaletteItem[] = [
    {
        type: 'text_input',
        label: '文本输入',
        labelEn: 'Text Input',
        icon: Type,
        color: 'text-cyan-400',
        borderColor: 'border-cyan-500/30',
        description: '接收文本数据输入 / Text data source',
    },
    {
        type: 'llm_process',
        label: 'LLM 处理',
        labelEn: 'LLM Process',
        icon: Cpu,
        color: 'text-purple-400',
        borderColor: 'border-purple-500/30',
        description: '大模型推理节点 / LLM inference node',
    },
    {
        type: 'image_gen',
        label: '图像生成',
        labelEn: 'Image Gen',
        icon: Image,
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        description: '文本到图像生成 / Text-to-image generation',
    },
    {
        type: 'transform',
        label: '数据变换',
        labelEn: 'Transform',
        icon: Shuffle,
        color: 'text-sky-400',
        borderColor: 'border-sky-500/30',
        description: '数据清洗与转换 / Data transformation',
    },
    {
        type: 'condition',
        label: '条件判断',
        labelEn: 'Condition',
        icon: GitBranch,
        color: 'text-pink-400',
        borderColor: 'border-pink-500/30',
        description: '分支路由逻辑 / Branching logic',
    },
    {
        type: 'output',
        label: '输出节点',
        labelEn: 'Output',
        icon: ArrowRightFromLine,
        color: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        description: '最终输出汇聚 / Final output sink',
    },
    {
        type: 'audio_synth',
        label: '语音合成',
        labelEn: 'Voice Synth',
        icon: Volume2,
        color: 'text-red-500/50',
        borderColor: 'border-red-500/20',
        description: 'SYSTEM FAULT / 系统故障',
        isFault: true,
    },
];

// ============================================================
// 组件 / Component
// ============================================================

interface NodePaletteProps {
    onAddNode: (type: CyberNodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
    const handleDragStart = (e: React.DragEvent, type: CyberNodeType) => {
        e.dataTransfer.setData('application/yyc3-node-type', type);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1 mb-3">
                <Zap className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                    节点库 / Node Library
                </span>
            </div>

            {PALETTE_ITEMS.map((item, index) => {
                const Icon = item.icon;
                return (
                    <motion.div
                        key={item.type}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        draggable={!item.isFault}
                        onDragStart={(e) => !item.isFault && handleDragStart(e as any, item.type)}
                        onClick={() => !item.isFault && onAddNode(item.type)}
                        className={`
                            flex items-center gap-2.5 p-2.5 rounded-lg border transition-all
                            ${item.isFault
                                ? 'border-red-500/15 bg-red-950/10 cursor-not-allowed opacity-50'
                                : `${item.borderColor} bg-white/[0.02] hover:bg-white/[0.06] cursor-grab active:cursor-grabbing hover:border-white/20`
                            }
                        `}
                    >
                        {/* 拖拽把手 / Drag handle */}
                        <GripVertical className={`w-3 h-3 ${item.isFault ? 'text-red-500/30' : 'text-gray-600'} shrink-0`} />

                        {/* 图标 / Icon */}
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                            item.isFault ? 'bg-red-900/20 border border-red-500/20' : 'bg-white/5 border border-white/10'
                        }`}>
                            <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                        </div>

                        {/* 标签 / Labels */}
                        <div className="flex-1 min-w-0">
                            <div className={`text-[10px] font-mono truncate ${item.isFault ? 'text-red-500/50' : 'text-gray-300'}`}>
                                {item.label} / {item.labelEn}
                            </div>
                            <div className={`text-[8px] font-mono truncate ${item.isFault ? 'text-red-500/30' : 'text-gray-600'}`}>
                                {item.description}
                            </div>
                        </div>

                        {/* 故障标记 / Fault badge */}
                        {item.isFault && (
                            <AlertTriangle className="w-3 h-3 text-red-500/40 animate-pulse shrink-0" />
                        )}
                    </motion.div>
                );
            })}

            {/* 拖拽提示 / Drag hint */}
            <div className="mt-4 px-2 py-2 bg-white/[0.02] rounded-lg border border-dashed border-white/5">
                <p className="text-[8px] font-mono text-gray-600 text-center leading-relaxed">
                    拖拽节点到画布 或 点击添加<br />
                    Drag to canvas or click to add
                </p>
            </div>
        </div>
    );
}
