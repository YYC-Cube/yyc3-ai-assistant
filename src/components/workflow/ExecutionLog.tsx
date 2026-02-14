/**
 * ExecutionLog V2 - DAG 执行日志面板
 * Cyberpunk-styled Execution Log Panel - Phase 3 "Engine Ignition"
 * 
 * 增强：显示执行输出、耗时、可展开详情
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Terminal, CheckCircle, XCircle, Loader2, Clock,
    AlertTriangle, ChevronDown, ChevronRight, Copy,
    Check, StopCircle, Zap, SkipForward
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';

export function ExecutionLog() {
    const { executionStatus, executionLogs, executionOutputs, abortExecution } = useWorkflowStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [executionLogs]);

    const toggleExpand = (index: number) => {
        setExpandedLogs(prev => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    // 空状态 / Empty state
    if (executionStatus === 'idle' && executionLogs.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 p-4">
                <Terminal className="w-6 h-6 opacity-30" />
                <p className="text-[10px] font-mono text-center">
                    就绪 / STANDBY<br />
                    <span className="text-gray-700">执行工作流以查看日志</span><br />
                    <span className="text-gray-700">Execute workflow to view logs</span>
                </p>
                <div className="mt-4 text-[8px] font-mono text-gray-700 bg-white/[0.02] rounded-lg border border-white/5 p-2 w-full">
                    <div className="flex items-center gap-1 text-pink-500/40 mb-1">
                        <Zap className="w-2.5 h-2.5" /> Phase 3 // Engine Ignition
                    </div>
                    LLM 节点将调用真实 API<br/>
                    LLM nodes call real API endpoints
                </div>
            </div>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running': return <Loader2 className="w-3 h-3 text-yellow-400 animate-spin shrink-0" />;
            case 'completed': return <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />;
            case 'failed': return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
            case 'skipped': return <SkipForward className="w-3 h-3 text-gray-500 shrink-0" />;
            default: return <Clock className="w-3 h-3 text-gray-500 shrink-0" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
            case 'completed': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
            case 'failed': return 'text-red-400 border-red-500/20 bg-red-500/5';
            case 'skipped': return 'text-gray-500 border-white/5 bg-white/[0.02]';
            default: return 'text-gray-400 border-white/5 bg-white/[0.02]';
        }
    };

    // 统计 / Stats
    const completedCount = executionLogs.filter(l => l.status === 'completed').length;
    const failedCount = executionLogs.filter(l => l.status === 'failed').length;
    const totalDuration = executionLogs
        .filter(l => l.durationMs)
        .reduce((sum, l) => sum + (l.durationMs || 0), 0);

    return (
        <div className="h-full flex flex-col">
            {/* 状态头部 / Status header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-pink-400" />
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                        执行日志 / Exec Log
                    </span>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono ${
                    executionStatus === 'running' ? 'text-yellow-400 bg-yellow-500/10' :
                    executionStatus === 'completed' ? 'text-emerald-400 bg-emerald-500/10' :
                    executionStatus === 'failed' ? 'text-red-400 bg-red-500/10' :
                    'text-gray-500'
                }`}>
                    {executionStatus === 'running' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    {executionStatus.toUpperCase()}
                </div>
            </div>

            {/* 统计条 / Stats bar */}
            {executionLogs.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 text-[8px] font-mono text-gray-600">
                    <span className="flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-emerald-500/50" /> {completedCount}
                    </span>
                    {failedCount > 0 && (
                        <span className="flex items-center gap-1">
                            <XCircle className="w-2.5 h-2.5 text-red-500/50" /> {failedCount}
                        </span>
                    )}
                    {totalDuration > 0 && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {totalDuration}ms
                        </span>
                    )}
                    {executionStatus === 'running' && (
                        <button
                            onClick={abortExecution}
                            className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            <StopCircle className="w-2.5 h-2.5" /> ABORT
                        </button>
                    )}
                </div>
            )}

            {/* 日志列表 / Log entries */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                <AnimatePresence>
                    {executionLogs.map((log, index) => {
                        const isExpanded = expandedLogs.has(index);
                        const hasOutput = log.output && log.status === 'completed';
                        const outputText = hasOutput
                            ? (typeof log.output === 'string' ? log.output : JSON.stringify(log.output, null, 2))
                            : log.status === 'failed' ? log.message : null;

                        return (
                            <motion.div
                                key={`${log.nodeId}-${log.timestamp}-${index}`}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded border ${getStatusColor(log.status)} overflow-hidden`}
                            >
                                {/* 主行 / Main row */}
                                <div
                                    className={`flex items-start gap-2 px-2 py-1.5 ${outputText ? 'cursor-pointer' : ''}`}
                                    onClick={() => outputText && toggleExpand(index)}
                                >
                                    {getStatusIcon(log.status)}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-mono truncate">
                                            {log.nodeId === 'system'
                                                ? (log.message || log.status)
                                                : `${log.status === 'running' ? '▸' : log.status === 'completed' ? '✓' : '✗'} ${log.message?.slice(0, 60) || log.nodeId}`
                                            }
                                        </div>
                                        <div className="text-[8px] font-mono opacity-50 mt-0.5 flex items-center gap-2">
                                            <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            {log.durationMs && <span className="text-yellow-500/50">{log.durationMs}ms</span>}
                                        </div>
                                    </div>
                                    {outputText && (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCopy(outputText, index); }}
                                                className="p-0.5 hover:bg-white/10 rounded transition-colors"
                                            >
                                                {copiedIndex === index
                                                    ? <Check className="w-2.5 h-2.5 text-emerald-400" />
                                                    : <Copy className="w-2.5 h-2.5 text-gray-600" />
                                                }
                                            </button>
                                            {isExpanded
                                                ? <ChevronDown className="w-2.5 h-2.5 text-gray-600" />
                                                : <ChevronRight className="w-2.5 h-2.5 text-gray-600" />
                                            }
                                        </div>
                                    )}
                                </div>

                                {/* 展开内容 / Expanded content */}
                                <AnimatePresence>
                                    {isExpanded && outputText && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-2 pb-2 pt-0.5 border-t border-white/5">
                                                <pre className="text-[8px] font-mono text-gray-400 bg-black/20 rounded p-1.5 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all">
                                                    {outputText.length > 2000 ? outputText.slice(0, 2000) + '\n...[截断 / Truncated]' : outputText}
                                                </pre>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* 执行完成的输出汇总 / Final output summary */}
            {executionStatus === 'completed' && Object.keys(executionOutputs).length > 0 && (
                <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-3 py-2 shrink-0">
                    <div className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 mb-1">
                        <CheckCircle className="w-3 h-3" />
                        执行完成 / Execution Complete
                    </div>
                    <div className="text-[8px] font-mono text-gray-500">
                        {Object.keys(executionOutputs).length} 个节点产生输出 / {Object.keys(executionOutputs).length} nodes produced output
                    </div>
                </div>
            )}

            {executionStatus === 'failed' && (
                <div className="border-t border-red-500/20 bg-red-500/5 px-3 py-2 shrink-0">
                    <div className="text-[9px] font-mono text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        执行失败 / Execution Failed
                    </div>
                </div>
            )}
        </div>
    );
}
