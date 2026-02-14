/**
 * ApiStatusBadge - API 连接状态诊断徽章
 * API Connection Status Diagnostic Badge
 * 
 * 赛博朋克风格，显示 Express Server / PG / LLM 连接状态
 * 点击展开详细诊断面板
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Wifi, WifiOff, Database, Cpu, RefreshCw,
    ChevronDown, ChevronUp, Activity, Server,
    Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { checkApiHealth, isApiOnline } from '@/lib/pg-api';
import { useAuthStore } from '@/stores/auth-store';
import { useConfigStore } from '@/stores/config-store';
import { checkConnection } from '@/utils/llm';

interface DiagnosticResult {
    apiServer: { online: boolean; latency: number };
    llmEndpoint: { reachable: boolean; latency: number; message?: string } | null;
    lastChecked: number;
}

export function ApiStatusBadge() {
    const { connectionStatus, apiLatency } = useAuthStore();
    const { activeConfig } = useConfigStore();
    const [expanded, setExpanded] = useState(false);
    const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
    const [checking, setChecking] = useState(false);

    const runDiagnostics = useCallback(async () => {
        setChecking(true);
        
        // 检查 API Server / Check API Server
        const apiResult = await checkApiHealth();
        
        // 检查 LLM Endpoint / Check LLM Endpoint
        let llmResult: DiagnosticResult['llmEndpoint'] = null;
        if (activeConfig?.baseUrl) {
            try {
                const llmCheck = await checkConnection(activeConfig);
                llmResult = {
                    reachable: llmCheck.success,
                    latency: llmCheck.latency,
                    message: llmCheck.message,
                };
            } catch (err: any) {
                llmResult = { reachable: false, latency: 0, message: err.message };
            }
        }

        setDiagnostics({
            apiServer: apiResult,
            llmEndpoint: llmResult,
            lastChecked: Date.now(),
        });
        setChecking(false);
    }, [activeConfig]);

    // 初始诊断 / Initial diagnostic
    useEffect(() => {
        if (expanded && !diagnostics) {
            runDiagnostics();
        }
    }, [expanded]);

    const isOnline = connectionStatus === 'online';

    return (
        <div className="relative">
            {/* 折叠徽章 / Collapsed badge */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono transition-all border ${
                    isOnline
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                }`}
            >
                <span className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`} />
                <span className="hidden md:inline">
                    {isOnline ? `API:3721 // ${apiLatency}ms` : 'OFFLINE // 离线模式'}
                </span>
                <span className="md:hidden">
                    {isOnline ? 'ON' : 'OFF'}
                </span>
                {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>

            {/* 展开诊断面板 / Expanded diagnostic panel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-[#050a10]/95 border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50 overflow-hidden"
                    >
                        {/* 头部 / Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-pink-400" />
                                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                                    系统诊断 / Diagnostics
                                </span>
                            </div>
                            <button
                                onClick={runDiagnostics}
                                disabled={checking}
                                className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors disabled:opacity-30"
                            >
                                <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="p-3 space-y-2">
                            {/* Express API Server */}
                            <DiagnosticRow
                                icon={<Server className="w-3.5 h-3.5" />}
                                label="Express API"
                                sublabel=":3721"
                                status={diagnostics?.apiServer.online ? 'online' : (diagnostics ? 'offline' : 'unknown')}
                                latency={diagnostics?.apiServer.latency}
                                checking={checking}
                            />

                            {/* PostgreSQL */}
                            <DiagnosticRow
                                icon={<Database className="w-3.5 h-3.5" />}
                                label="PostgreSQL"
                                sublabel="15"
                                status={diagnostics?.apiServer.online ? 'online' : (diagnostics ? 'offline' : 'unknown')}
                                latency={diagnostics?.apiServer.online ? diagnostics.apiServer.latency : undefined}
                                checking={checking}
                            />

                            {/* LLM Endpoint */}
                            <DiagnosticRow
                                icon={<Cpu className="w-3.5 h-3.5" />}
                                label="LLM 端点 / Endpoint"
                                sublabel={activeConfig?.provider || 'N/A'}
                                status={diagnostics?.llmEndpoint?.reachable ? 'online' : (diagnostics?.llmEndpoint ? 'offline' : 'unknown')}
                                latency={diagnostics?.llmEndpoint?.latency}
                                message={diagnostics?.llmEndpoint?.message}
                                checking={checking}
                            />

                            {/* 上次检查 / Last checked */}
                            {diagnostics?.lastChecked && (
                                <div className="flex items-center gap-1 text-[8px] font-mono text-gray-600 pt-1 border-t border-white/5">
                                    <Clock className="w-2.5 h-2.5" />
                                    上次检测 / Last check: {new Date(diagnostics.lastChecked).toLocaleTimeString()}
                                </div>
                            )}

                            {/* 离线提示 / Offline hint */}
                            {!isOnline && (
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-[8px] font-mono text-amber-400/70 mt-2">
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    使用 localStorage 离线模式运行。启动本地 Express Server (端口 3721) 以启用完整功能。
                                    <br />
                                    Running in localStorage offline mode. Start local Express Server (:3721) for full features.
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================
// 诊断行组件 / Diagnostic Row Component
// ============================================================

function DiagnosticRow({ icon, label, sublabel, status, latency, message, checking }: {
    icon: React.ReactNode;
    label: string;
    sublabel: string;
    status: 'online' | 'offline' | 'unknown';
    latency?: number;
    message?: string;
    checking: boolean;
}) {
    return (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
            status === 'online' ? 'border-emerald-500/15 bg-emerald-500/5'
            : status === 'offline' ? 'border-red-500/15 bg-red-500/5'
            : 'border-white/5 bg-white/[0.02]'
        }`}>
            <div className={`shrink-0 ${
                status === 'online' ? 'text-emerald-400'
                : status === 'offline' ? 'text-red-400'
                : 'text-gray-500'
            }`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono text-gray-300 flex items-center gap-1">
                    {label}
                    <span className="text-gray-600">{sublabel}</span>
                </div>
                {message && (
                    <div className="text-[7px] font-mono text-gray-600 truncate">{message}</div>
                )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {latency !== undefined && latency > 0 && (
                    <span className="text-[8px] font-mono text-gray-500">{latency}ms</span>
                )}
                {checking ? (
                    <RefreshCw className="w-2.5 h-2.5 text-gray-500 animate-spin" />
                ) : status === 'online' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : status === 'offline' ? (
                    <XCircle className="w-3 h-3 text-red-400" />
                ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-600" />
                )}
            </div>
        </div>
    );
}
