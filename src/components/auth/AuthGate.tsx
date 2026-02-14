/**
 * AuthGate - 赛博朋克风格鉴权门户
 * Cyberpunk-styled Authentication Gate
 * 
 * 全屏沉浸式登录/注册界面，暗夜玻璃态设计
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, User, Lock, Eye, EyeOff, Zap, AlertTriangle, Wifi, WifiOff, Loader2, LogIn, UserPlus, Ghost } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore, type ConnectionStatus } from '@/stores/auth-store';

// Logo assets / 品牌 Logo 资源
import logoLarge from "figma:asset/a17136671265d3dca3711f5fa4eafc72f4142621.png";
import logoSmall from "figma:asset/5059f251bcc7a85ef1ff973bedbc996f48085339.png";

// Logo 组件 - 赛博朋克青光效果 / Logo with cyberpunk cyan glow
const CyberLogo = ({ src, size = 64, className = '' }: { src: string; size?: number; className?: string }) => (
    <img 
        src={src} 
        alt="YanYuCloudCube" 
        width={size} 
        height={size}
        className={`object-contain select-none ${className}`}
        style={{
            filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.5)) drop-shadow(0 0 30px rgba(34,211,238,0.2))',
        }}
        draggable={false}
    />
);

// 连接状态标签 / Connection status badge
const ConnectionBadge = ({ status, latency }: { status: ConnectionStatus; latency: number }) => {
    const configs: Record<ConnectionStatus, { icon: React.ReactNode; label: string; color: string }> = {
        checking: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: '检测中 / PROBING', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
        online: { icon: <Wifi className="w-3 h-3" />, label: `在线 / ONLINE (${latency}ms)`, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
        offline: { icon: <WifiOff className="w-3 h-3" />, label: '离线 / OFFLINE', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
    };
    const cfg = configs[status];
    
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-mono ${cfg.color}`}>
            {cfg.icon}
            <span>{cfg.label}</span>
        </div>
    );
};

// 赛博朋克装饰线 / Cyberpunk decorative line
const CyberLine = ({ side }: { side: 'left' | 'right' }) => (
    <div className={`flex-1 h-px bg-gradient-to-${side === 'left' ? 'l' : 'r'} from-cyan-500/50 to-transparent`} />
);

export function AuthGate({ children }: { children: React.ReactNode }) {
    const { user, authStatus, connectionStatus, apiLatency, error, initialize, login, register, clearError, continueAsGuest } = useAuthStore();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 初始化 / Initialize on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    // 提交处理 / Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) return;
        
        setIsSubmitting(true);
        clearError();
        
        const success = mode === 'login' 
            ? await login(username.trim(), password)
            : await register(username.trim(), password);
        
        setIsSubmitting(false);
        
        if (success) {
            setUsername('');
            setPassword('');
        }
    };

    // 已认证 → 渲染子组件 / Authenticated → render children
    if (authStatus === 'authenticated' && user) {
        return <>{children}</>;
    }

    // 加载中 / Loading
    if (authStatus === 'loading') {
        return (
            <div className="h-screen w-full bg-[#020610] flex flex-col items-center justify-center gap-6">
                <motion.div
                    animate={{ 
                        scale: [1, 1.08, 1],
                        filter: [
                            'drop-shadow(0 0 8px rgba(34,211,238,0.3))',
                            'drop-shadow(0 0 24px rgba(34,211,238,0.6))',
                            'drop-shadow(0 0 8px rgba(34,211,238,0.3))'
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <CyberLogo src={logoSmall} size={64} />
                </motion.div>
                <div className="font-mono text-cyan-500/60 text-xs tracking-[0.3em] animate-pulse">
                    NEURAL HANDSHAKE INITIALIZING...
                </div>
                <div className="font-mono text-cyan-500/30 text-[10px]">
                    正在初始化神经握手协议...
                </div>
            </div>
        );
    }

    // 鉴权界面 / Auth interface
    return (
        <div className="h-screen w-full bg-[#020610] relative overflow-hidden flex items-center justify-center">
            {/* 背景装饰 / Background decorations */}
            <div className="absolute inset-0 pointer-events-none">
                {/* 网格 / Grid */}
                <div className="absolute inset-0 opacity-[0.03]" 
                    style={{ 
                        backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)',
                        backgroundSize: '60px 60px'
                    }} 
                />
                {/* 辉光 / Glow */}
                <motion.div 
                    animate={{ opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 6, repeat: Infinity }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] bg-cyan-900/30"
                />
                {/* 扫描线 / Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-10" />
            </div>

            {/* 连接状态 / Connection status - top right */}
            <div className="absolute top-6 right-6 z-10">
                <ConnectionBadge status={connectionStatus} latency={apiLatency} />
            </div>

            {/* 主面板 / Main panel */}
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                {/* 标题 / Title */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
                        className="relative inline-block mb-4"
                    >
                        {/* Logo 外围青光脉冲 / Outer cyan pulse ring */}
                        <motion.div
                            animate={{ 
                                opacity: [0.2, 0.5, 0.2],
                                scale: [1, 1.15, 1]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl"
                        />
                        <CyberLogo src={logoLarge} size={96} className="relative z-10" />
                    </motion.div>
                    <h1 className="text-3xl font-mono text-cyan-100 tracking-[0.15em]">YanYuCloudCube</h1>
                    <p className="text-xs font-mono text-cyan-500/50 tracking-[0.35em] mt-2">
                        NEURAL ACCESS PROTOCOL
                    </p>
                    <p className="text-[11px] font-mono text-cyan-500/30 mt-1 tracking-wider">
                        万象归元于云枢丨深栈智启新纪元
                    </p>
                </div>

                {/* 面板卡片 / Panel card */}
                <div className="bg-[#050a14]/70 backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(8,145,178,0.1)]">
                    {/* 模式切换 / Mode toggle */}
                    <div className="flex border-b border-cyan-500/10">
                        {[
                            { id: 'login' as const, label: '接入 / LOGIN', icon: LogIn },
                            { id: 'register' as const, label: '注册 / REGISTER', icon: UserPlus },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setMode(tab.id); clearError(); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 font-mono text-xs transition-all ${
                                    mode === tab.id 
                                        ? 'text-cyan-300 bg-cyan-500/10 border-b-2 border-cyan-400' 
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* 表单 / Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* 用户名 / Username */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <User className="w-3 h-3" />
                                操作员代号 / OPERATOR ID
                            </label>
                            <Input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="输入代号... / Enter callsign..."
                                className="bg-black/40 border-white/10 text-cyan-100 font-mono text-sm h-10 focus:border-cyan-500/50 placeholder:text-gray-600"
                                autoComplete="username"
                                required
                            />
                        </div>

                        {/* 密码 / Password */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                访问密钥 / ACCESS KEY
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="输入密钥... / Enter key..."
                                    className="bg-black/40 border-white/10 text-cyan-100 font-mono text-sm h-10 focus:border-cyan-500/50 pr-10 placeholder:text-gray-600"
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    required
                                    minLength={4}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* 错误信息 / Error message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-xs font-mono"
                                >
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 提交按钮 / Submit button */}
                        <Button
                            type="submit"
                            disabled={isSubmitting || !username.trim() || !password.trim()}
                            className="w-full h-11 bg-cyan-600/80 hover:bg-cyan-500/80 text-white font-mono text-sm tracking-wider border border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.15)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Zap className="w-4 h-4 mr-2" />
                            )}
                            {mode === 'login' ? '神经接入 / CONNECT' : '注册节点 / REGISTER NODE'}
                        </Button>

                        {/* 分割线 / Divider */}
                        <div className="flex items-center gap-3 py-1">
                            <CyberLine side="left" />
                            <span className="text-[9px] font-mono text-gray-600 whitespace-nowrap">OR // 或</span>
                            <CyberLine side="right" />
                        </div>

                        {/* 访客模式 / Guest mode */}
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={continueAsGuest}
                            className="w-full h-10 text-gray-500 hover:text-cyan-300 hover:bg-cyan-500/5 font-mono text-xs tracking-wider border border-white/5 hover:border-cyan-500/20 transition-all"
                        >
                            <Ghost className="w-4 h-4 mr-2" />
                            幽灵模式接入 / GHOST MODE (No Persistence)
                        </Button>
                    </form>

                    {/* 底部信息 / Footer info */}
                    <div className="px-6 pb-4 pt-2 border-t border-white/5">
                        <p className="text-[9px] font-mono text-gray-600 text-center leading-relaxed">
                            {connectionStatus === 'offline' 
                                ? '[ API 离线 ] 预置操作员可登入，或使用幽灵模式。数据存储在本地。\n[ API OFFLINE ] Preset operators can login, or use ghost mode. Data stored locally.'
                                : '数据存储在本地 PostgreSQL 15 实例中，仅内部使用。\nData persisted in local PostgreSQL 15. Internal use only.'
                            }
                        </p>
                    </div>
                </div>

                {/* 版本信息 / Version */}
                <div className="text-center mt-4">
                    <span className="text-[9px] font-mono text-gray-700">
                        YanYuCloudCube.AUTH_GATE.V1 // PHASE_1: NEURAL_CONNECTION
                    </span>
                </div>
            </motion.div>
        </div>
    );
}