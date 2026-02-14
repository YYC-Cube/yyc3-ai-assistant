/**
 * RunHistory - 工作流执行历史面板
 * Workflow Execution History Panel
 * 
 * 从 PG 拉取历史运行记录，赛博朋克风格展示
 * Pulls historical run records from PG, cyberpunk-styled
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    History, CheckCircle, XCircle, Clock, Loader2,
    RefreshCw, ChevronDown, ChevronRight, FileText,
    Zap, Timer
} from 'lucide-react';
import { workflowsApi, runsApi, type WorkflowRunRow } from '@/lib/pg-api';
import { useAuthStore } from '@/stores/auth-store';

interface RunHistoryProps {
    workflowId?: string | null;
    onClose?: () => void;
}

export function RunHistory({ workflowId, onClose }: RunHistoryProps) {
    const { connectionStatus } = useAuthStore();
    const [runs, setRuns] = useState<WorkflowRunRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);

    const loadRuns = useCallback(async () => {
        if (connectionStatus !== 'online') return;
        setLoading(true);

        try {
            let res;
            if (workflowId && !workflowId.startsWith('local_')) {
                res = await workflowsApi.listRuns(workflowId);
            } else {
                res = await runsApi.recent(20);
            }

            if (res.success && res.data) {
                setRuns(res.data);
            }
        } catch { /* ignore */ }
        
        setLoading(false);
    }, [workflowId, connectionStatus]);

    useEffect(() => {
        loadRuns();
    }, [loadRuns]);

    const formatDuration = (ms: number | null) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return { icon: <CheckCircle className="w-3 h-3 text-emerald-400" />, bg: 'bg-emerald-500/5 border-emerald-500/15', text: 'text-emerald-400' };
            case 'failed': return { icon: <XCircle className="w-3 h-3 text-red-400" />, bg: 'bg-red-500/5 border-red-500/15', text: 'text-red-400' };
            case 'running': return { icon: <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />, bg: 'bg-yellow-500/5 border-yellow-500/15', text: 'text-yellow-400' };
            default: return { icon: <Clock className="w-3 h-3 text-gray-500" />, bg: 'bg-white/[0.02] border-white/5', text: 'text-gray-400' };
        }
    };

    // 离线提示 / Offline hint
    if (connectionStatus !== 'online') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 gap-3">
                <History className="w-8 h-8 text-gray-700" />
                <div className="text-center">
                    <p className="text-[10px] font-mono text-gray-500">
                        需要连接 API Server / Requires API Server
                    </p>
                    <p className="text-[8px] font-mono text-gray-600 mt-1">
                        启动本地 Express Server (:3721) 以查看执行历史<br/>
                        Start local Express Server (:3721) to view run history
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* 头部 / Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-1.5">
                    <History className="w-3 h-3 text-pink-400" />
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                        执行历史 / Run History
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-gray-600">
                        {runs.length} 条记录 / records
                    </span>
                    <button
                        onClick={loadRuns}
                        disabled={loading}
                        className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 列表 / List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {loading && runs.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                    </div>
                ) : runs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <FileText className="w-6 h-6 text-gray-700" />
                        <p className="text-[9px] font-mono text-gray-600 text-center">
                            暂无执行记录 / No runs yet<br/>
                            <span className="text-gray-700">执行工作流后会在此显示</span>
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {runs.map((run) => {
                            const style = getStatusStyle(run.status);
                            const isExpanded = expandedRun === run.id;

                            return (
                                <motion.div
                                    key={run.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`rounded-lg border ${style.bg} overflow-hidden`}
                                >
                                    {/* 运行摘要 / Run summary */}
                                    <button
                                        onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                                        className="w-full text-left px-2.5 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
                                    >
                                        {style.icon}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-mono ${style.text} uppercase`}>
                                                    {run.status}
                                                </span>
                                                {run.workflow_name && (
                                                    <span className="text-[8px] font-mono text-gray-600 truncate">
                                                        {run.workflow_name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[7px] font-mono text-gray-600 mt-0.5">
                                                <span className="flex items-center gap-0.5">
                                                    <Clock className="w-2 h-2" />
                                                    {formatTime(run.started_at)}
                                                </span>
                                                {run.duration_ms && (
                                                    <span className="flex items-center gap-0.5">
                                                        <Timer className="w-2 h-2" />
                                                        {formatDuration(run.duration_ms)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronDown className="w-3 h-3 text-gray-600 shrink-0" />
                                        ) : (
                                            <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                                        )}
                                    </button>

                                    {/* 展开日志 / Expanded logs */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-2.5 pb-2 pt-0.5 border-t border-white/5">
                                                    {Array.isArray(run.logs) && run.logs.length > 0 ? (
                                                        <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                                                            {run.logs.map((log: any, i: number) => (
                                                                <div key={i} className="text-[7px] font-mono text-gray-500 flex items-start gap-1">
                                                                    <span className={`shrink-0 ${
                                                                        log.status === 'completed' ? 'text-emerald-500' :
                                                                        log.status === 'failed' ? 'text-red-500' :
                                                                        log.status === 'running' ? 'text-yellow-500' :
                                                                        'text-gray-600'
                                                                    }`}>
                                                                        {log.status === 'completed' ? '>' : log.status === 'failed' ? '!' : '~'}
                                                                    </span>
                                                                    <span className="text-gray-600">{log.node_id || log.nodeId}</span>
                                                                    <span className="truncate">{log.message?.slice(0, 80)}</span>
                                                                    {log.duration_ms && (
                                                                        <span className="text-gray-700 shrink-0">{log.duration_ms}ms</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[8px] font-mono text-gray-600 py-1">
                                                            无详细日志 / No detailed logs
                                                        </div>
                                                    )}

                                                    <div className="text-[7px] font-mono text-gray-700 mt-1 flex items-center gap-1">
                                                        <Zap className="w-2 h-2" />
                                                        ID: {run.id.slice(0, 8)}...
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
