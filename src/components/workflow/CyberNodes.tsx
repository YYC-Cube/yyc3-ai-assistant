/**
 * CyberNodes - 赛博朋克风格 React Flow 自定义节点
 * Cyberpunk-styled Custom Nodes for React Flow
 * 
 * 每种节点类型有独特的视觉风格和配色
 * audio_synth 节点硬编码为故障状态（红色 Glitch Art）
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import { 
    Type, Cpu, Image, Volume2, ArrowRightFromLine, 
    GitBranch, Shuffle, AlertTriangle, Loader2, CheckCircle, XCircle 
} from 'lucide-react';
import type { CyberNodeData, CyberNodeType } from '@/stores/workflow-store';

// ============================================================
// 节点配置表 / Node Configuration Map
// ============================================================

interface NodeStyle {
    icon: React.ElementType;
    color: string;        // 主色 / Primary color
    borderColor: string;  // 边框色 / Border color
    bgColor: string;      // 背景色 / Background
    glowColor: string;    // 辉光色 / Glow color
    label: string;        // 类型标签 / Type label
}

const NODE_STYLES: Record<CyberNodeType, NodeStyle> = {
    text_input: {
        icon: Type,
        color: 'text-cyan-400',
        borderColor: 'border-cyan-500/40',
        bgColor: 'bg-cyan-950/40',
        glowColor: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]',
        label: 'INPUT',
    },
    llm_process: {
        icon: Cpu,
        color: 'text-purple-400',
        borderColor: 'border-purple-500/40',
        bgColor: 'bg-purple-950/40',
        glowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
        label: 'LLM',
    },
    image_gen: {
        icon: Image,
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgColor: 'bg-emerald-950/40',
        glowColor: 'shadow-[0_0_15px_rgba(52,211,153,0.15)]',
        label: 'IMG_GEN',
    },
    audio_synth: {
        icon: Volume2,
        color: 'text-red-500',
        borderColor: 'border-red-500/50',
        bgColor: 'bg-red-950/40',
        glowColor: 'shadow-[0_0_20px_rgba(239,68,68,0.25)]',
        label: 'FAULT',
    },
    output: {
        icon: ArrowRightFromLine,
        color: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        bgColor: 'bg-amber-950/40',
        glowColor: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
        label: 'OUTPUT',
    },
    condition: {
        icon: GitBranch,
        color: 'text-pink-400',
        borderColor: 'border-pink-500/40',
        bgColor: 'bg-pink-950/40',
        glowColor: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]',
        label: 'BRANCH',
    },
    transform: {
        icon: Shuffle,
        color: 'text-sky-400',
        borderColor: 'border-sky-500/40',
        bgColor: 'bg-sky-950/40',
        glowColor: 'shadow-[0_0_15px_rgba(56,189,248,0.15)]',
        label: 'XFORM',
    },
};

// ============================================================
// 状态指示器 / Status Indicator
// ============================================================

const StatusIndicator = ({ status }: { status?: CyberNodeData['status'] }) => {
    switch (status) {
        case 'running':
            return <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />;
        case 'completed':
            return <CheckCircle className="w-3 h-3 text-emerald-400" />;
        case 'failed':
            return <XCircle className="w-3 h-3 text-red-400" />;
        case 'fault':
            return <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />;
        default:
            return <div className="w-2 h-2 rounded-full bg-gray-600" />;
    }
};

// ============================================================
// 主节点组件 / Main Node Component
// ============================================================

function CyberNodeComponent({ data, selected }: NodeProps) {
    const nodeData = data as unknown as CyberNodeData;
    const style = NODE_STYLES[nodeData.type] || NODE_STYLES.text_input;
    const Icon = style.icon;
    const isFault = nodeData.type === 'audio_synth';
    const isRunning = nodeData.status === 'running';
    const isCompleted = nodeData.status === 'completed';

    return (
        <div className="relative group">
            {/* 选中时的外部辉光 / Selected glow */}
            {selected && (
                <div className={`absolute -inset-1 rounded-xl ${style.borderColor} border-2 opacity-50 animate-pulse`} />
            )}

            {/* 主体 / Main body */}
            <div
                className={`
                    relative w-48 rounded-xl border backdrop-blur-xl transition-all duration-300
                    ${style.borderColor} ${style.bgColor} ${style.glowColor}
                    ${selected ? 'ring-1 ring-white/20' : ''}
                    ${isFault ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}
                    ${isRunning ? 'ring-2 ring-yellow-500/50' : ''}
                    ${isCompleted ? 'ring-1 ring-emerald-500/30' : ''}
                    bg-[#050a10]/80
                `}
            >
                {/* 故障扫描线 / Fault scanlines */}
                {isFault && (
                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.03)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-60" />
                        <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-red-500/10" />
                    </div>
                )}

                {/* 头部条 / Header bar */}
                <div className={`flex items-center justify-between px-3 py-2 border-b ${style.borderColor} bg-white/[0.02]`}>
                    <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${style.color}`} />
                        <span className={`text-[9px] font-mono tracking-widest uppercase ${style.color} opacity-80`}>
                            {style.label}
                        </span>
                    </div>
                    <StatusIndicator status={nodeData.status} />
                </div>

                {/* 内容区 / Content area */}
                <div className="px-3 py-2.5">
                    <div className="text-xs font-mono text-gray-200 truncate">
                        {nodeData.label}
                    </div>
                    
                    {/* 配置预览 / Config preview */}
                    {nodeData.config?.model && (
                        <div className="mt-1.5 text-[9px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded inline-block">
                            {nodeData.config.model}
                        </div>
                    )}

                    {/* 执行输出预览 / Execution output preview */}
                    {nodeData.config?._lastOutput && !isFault && (
                        <div className="mt-1.5 text-[8px] font-mono text-gray-400 bg-white/[0.03] border border-white/5 px-1.5 py-1 rounded max-h-10 overflow-hidden">
                            {typeof nodeData.config._lastOutput === 'string'
                                ? nodeData.config._lastOutput.slice(0, 80)
                                : JSON.stringify(nodeData.config._lastOutput).slice(0, 80)
                            }
                            {(typeof nodeData.config._lastOutput === 'string' ? nodeData.config._lastOutput.length : JSON.stringify(nodeData.config._lastOutput).length) > 80 && '...'}
                        </div>
                    )}

                    {/* 耗时显示 / Duration display */}
                    {nodeData.config?._lastDuration && !isFault && (
                        <div className="mt-1 text-[7px] font-mono text-gray-600">
                            {nodeData.config._lastDuration}ms
                        </div>
                    )}

                    {/* 故障消息 / Fault message */}
                    {isFault && (
                        <div className="mt-2 text-[8px] font-mono text-red-500/80 bg-red-900/20 border border-red-500/20 px-2 py-1 rounded space-y-0.5">
                            <div>[ERR: 0x503_VOICE_MOD]</div>
                            <div className="animate-pulse">HARDWARE UNREACHABLE</div>
                        </div>
                    )}
                </div>

                {/* 底部状态条 / Bottom status bar */}
                <div className={`h-0.5 rounded-b-xl ${
                    isRunning ? 'bg-yellow-500 animate-pulse' :
                    isCompleted ? 'bg-emerald-500' :
                    isFault ? 'bg-red-500 animate-pulse' :
                    'bg-white/5'
                }`} />
            </div>

            {/* Input Handle (左侧) */}
            <Handle
                type="target"
                position={Position.Left}
                className={`!w-3 !h-3 !rounded-sm !border-2 ${style.borderColor} !bg-[#050a10] hover:!bg-white/20 !transition-all`}
            />

            {/* Output Handle (右侧) */}
            {!isFault && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className={`!w-3 !h-3 !rounded-sm !border-2 ${style.borderColor} !bg-[#050a10] hover:!bg-white/20 !transition-all`}
                />
            )}
        </div>
    );
}

export const CyberNode = memo(CyberNodeComponent);

// ============================================================
// 自定义边样式 / Custom Edge Style
// ============================================================

export const CYBER_EDGE_STYLE = {
    stroke: 'rgba(100, 200, 255, 0.4)',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
};

export const CYBER_EDGE_ANIMATED_STYLE = {
    ...CYBER_EDGE_STYLE,
    strokeDasharray: '5 5',
    animation: 'flowDash 1s linear infinite',
};

// ============================================================
// 节点类型注册 / Node Type Registry
// ============================================================

export const nodeTypes = {
    cyber_node: CyberNode,
};

export const edgeDefaults = {
    style: CYBER_EDGE_STYLE,
    type: 'smoothstep',
    animated: false,
};