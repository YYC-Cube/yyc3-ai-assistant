/**
 * UserBadge - HUD 用户状态徽章
 * 显示在主界面角落，展示用户身份、连接状态、同步指示
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogOut, Wifi, WifiOff, Shield, Database, ChevronDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';

export function UserBadge() {
    const { user, authStatus, connectionStatus, apiLatency, logout, checkConnection } = useAuthStore();
    const { syncStatus, lastSyncTime } = useAppStore();
    const [expanded, setExpanded] = useState(false);

    if (authStatus !== 'authenticated' || !user) return null;

    const isGuest = user.id.startsWith('guest_');
    const isOnline = connectionStatus === 'online';

    return (
        <div className="fixed top-4 left-4 z-30 pointer-events-auto">
            {/* 徽章按钮 / Badge button */}
            <motion.button
                onClick={() => setExpanded(!expanded)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-xl transition-colors ${
                    isOnline 
                        ? 'bg-[#050a14]/70 border-cyan-500/20 hover:border-cyan-500/40' 
                        : 'bg-[#0a0505]/70 border-red-500/20 hover:border-red-500/40'
                }`}
            >
                {/* 头像 / Avatar */}
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono ${
                    isGuest 
                        ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' 
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}>
                    {isGuest ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                </div>

                {/* 用户名 / Username */}
                <span className="text-[10px] font-mono text-gray-300 max-w-[80px] truncate hidden sm:inline">
                    {user.username}
                </span>

                {/* 连接点 / Connection dot */}
                <div className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                } ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`} />

                <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </motion.button>

            {/* 展开面板 / Expanded panel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute top-full left-0 mt-2 w-56 bg-[#050a14]/90 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                    >
                        {/* 用户信息 / User info */}
                        <div className="p-3 border-b border-white/5">
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isGuest ? 'bg-gray-500/10 border border-gray-500/20' : 'bg-cyan-500/10 border border-cyan-500/20'
                                }`}>
                                    {isGuest ? <Shield className="w-4 h-4 text-gray-400" /> : <User className="w-4 h-4 text-cyan-400" />}
                                </div>
                                <div>
                                    <div className="text-xs font-mono text-white">{user.username}</div>
                                    <div className="text-[9px] font-mono text-gray-500">
                                        {isGuest ? '幽灵模式 / GHOST' : 'ID: ' + user.id.substring(0, 8)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 状态行 / Status rows */}
                        <div className="p-2 space-y-1">
                            {/* 连接 / Connection */}
                            <button
                                onClick={() => checkConnection()}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                            >
                                {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                                <span className="text-[10px] font-mono text-gray-400 flex-1">
                                    {isOnline ? `PG 在线 / ONLINE (${apiLatency}ms)` : 'PG 离线 / OFFLINE'}
                                </span>
                                <RefreshCw className="w-3 h-3 text-gray-600" />
                            </button>

                            {/* 同步 / Sync */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <Database className={`w-3.5 h-3.5 ${syncStatus === 'synced' ? 'text-cyan-400' : syncStatus === 'error' ? 'text-red-400' : 'text-gray-500'}`} />
                                <span className="text-[10px] font-mono text-gray-400">
                                    {syncStatus === 'synced' && lastSyncTime 
                                        ? `同步于 / SYNCED ${new Date(lastSyncTime).toLocaleTimeString()}`
                                        : syncStatus === 'syncing' ? '同步中 / SYNCING...'
                                        : syncStatus === 'error' ? '同步失败 / SYNC FAILED'
                                        : '待同步 / PENDING'
                                    }
                                </span>
                            </div>
                        </div>

                        {/* 登出 / Logout */}
                        <div className="p-2 border-t border-white/5">
                            <button
                                onClick={() => { logout(); setExpanded(false); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-mono">断开连接 / DISCONNECT</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 点击外部关闭 / Click outside to close */}
            {expanded && (
                <div className="fixed inset-0 z-[-1]" onClick={() => setExpanded(false)} />
            )}
        </div>
    );
}
