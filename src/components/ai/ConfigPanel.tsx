import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Save, X, Server, Key, Box, Cpu, RotateCcw, Volume2, Mic, Users, Download, Upload, Cloud, RefreshCw, AlertTriangle, ExternalLink, Zap, Sliders, Database, Search, Terminal, Sparkles, Moon, Code, Globe, MessageSquare, Laptop, Plus, Wifi, WifiOff, CheckCircle, XCircle, Loader2, Trash2, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRESET_CHARACTERS, applyCharacterToConfig, CharacterProfile } from '@/utils/character';
import { DEFAULT_PRESETS, ModelPreset, createConfigFromPreset } from '@/utils/model-presets';
import { LLMConfig } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { useConfigStore } from '@/stores/config-store';
import { useAppStore } from '@/stores/app-store';
import { checkApiHealth } from '@/lib/pg-api';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

// Enhanced Model Hints Library
const MODEL_HINTS: Record<string, string> = {
    'claude': 'Detected Anthropic Architecture. Optimization: XML-based prompting, Chain-of-Thought.',
    'gpt': 'Detected OpenAI Architecture. Optimization: Markdown formatting, clear instructions.',
    'deepseek': 'Detected DeepSeek Architecture. Optimization: Code-heavy reasoning, concise output.',
    'mistral': 'Detected Mistral Architecture. Optimization: Direct answers, no fluff.',
    'llama': 'Detected Meta Llama Architecture. Optimization: System prompt reinforcement.',
    'qwen': 'Detected Qwen (Tongyi) Architecture. Optimization: Chinese idiom understanding, multi-lingual context.',
    'glm': 'Detected Zhipu GLM Architecture. Optimization: Tool use, function calling, Chinese logic.',
    'moonshot': 'Detected Moonshot (Kimi). Optimization: Long context retrieval, file analysis.',
    'yi': 'Detected 01.AI Yi Architecture. Optimization: Creative writing, high fidelity roleplay.',
    'hunyuan': 'Detected Tencent Hunyuan. Optimization: Logical reasoning in Chinese.',
    'baichuan': 'Detected Baichuan. Optimization: Chinese cultural context.',
    'gemini': 'Detected Google Gemini. Optimization: Multi-turn reasoning.',
    'minimax': 'Detected MiniMax. Optimization: Roleplay and speech patterns.',
    'doubao': 'Detected Doubao (ByteDance). Optimization: Colloquial interactions.',
};

const ICON_MAP: Record<string, any> = {
    Server, Box, Cpu, Sparkles, Moon, Code, Database, Globe, Laptop
};

const openaiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

// ============================================================
// PG 数据库同步标签页 / PG Database Sync Tab
// ============================================================

function PGSyncTab({ config, setConfig }: { config: LLMConfig; setConfig: (c: LLMConfig) => void }) {
    const { connectionStatus, apiLatency, user, checkConnection } = useAuthStore();
    const { configs, isSynced, isLoading, loadConfigs, setActiveConfig, deleteConfig } = useConfigStore();
    const { syncStatus, lastSyncTime, setSyncStatus } = useAppStore();
    const [isProbing, setIsProbing] = useState(false);
    const [healthResult, setHealthResult] = useState<{ online: boolean; latency: number } | null>(null);

    const isOnline = connectionStatus === 'online';
    const isGuest = user?.id.startsWith('guest_');
    const apiUrl = config.syncServerUrl || 'http://localhost:3721/api';

    const handleProbe = async () => {
        setIsProbing(true);
        const result = await checkApiHealth();
        setHealthResult(result);
        await checkConnection();
        setIsProbing(false);
    };

    const handleSync = async () => {
        setSyncStatus('syncing');
        await loadConfigs();
        setSyncStatus(isSynced ? 'synced' : 'error');
    };

    return (
        <div className="space-y-6">
            {/* 连接状态卡片 / Connection Status Card */}
            <div className={`p-4 rounded-xl border ${
                isOnline 
                    ? 'bg-emerald-500/5 border-emerald-500/20' 
                    : 'bg-red-500/5 border-red-500/20'
            }`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isOnline ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                            {isOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
                        </div>
                        <div>
                            <div className={`font-mono text-sm ${isOnline ? 'text-emerald-200' : 'text-red-200'}`}>
                                {isOnline ? 'PG 在线 / PG ONLINE' : 'PG 离线 / PG OFFLINE'}
                            </div>
                            <div className="text-[9px] font-mono text-gray-500">
                                {isOnline ? `延迟 / Latency: ${apiLatency}ms` : '本地模式运行中 / Running in local mode'}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleProbe}
                        disabled={isProbing}
                        className={`h-7 text-[10px] font-mono border ${
                            isOnline ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10' : 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                        }`}
                    >
                        {isProbing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                        探测 / Probe
                    </Button>
                </div>

                {/* 连接详情网格 / Connection Details Grid */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-black/20 rounded-lg p-2">
                        <div className="text-[8px] font-mono text-gray-500 uppercase">状态 / Status</div>
                        <div className={`text-[10px] font-mono mt-0.5 flex items-center gap-1 ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
                            {isOnline ? 'CONNECTED' : 'OFFLINE'}
                        </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                        <div className="text-[8px] font-mono text-gray-500 uppercase">用户 / User</div>
                        <div className="text-[10px] font-mono text-gray-300 mt-0.5 truncate">
                            {isGuest ? 'GHOST' : user?.username || '-'}
                        </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                        <div className="text-[8px] font-mono text-gray-500 uppercase">同步 / Sync</div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isSynced ? 'text-cyan-400' : 'text-gray-500'}`}>
                            {isSynced ? 'SYNCED' : 'PENDING'}
                        </div>
                    </div>
                </div>
            </div>

            {/* API 端点配置 / API Endpoint Config */}
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-cyan-500 font-mono tracking-wider uppercase">
                    <Server className="w-3 h-3" /> API 端点 / API Endpoint
                </label>
                <div className="flex gap-2">
                    <Input
                        value={config.syncServerUrl}
                        onChange={(e) => setConfig({ ...config, syncServerUrl: e.target.value })}
                        className="bg-black/40 border-white/10 text-cyan-100 font-mono text-xs h-9 flex-1"
                        placeholder="http://localhost:3721/api"
                    />
                </div>
                <div className="text-[9px] font-mono text-gray-600 space-y-0.5">
                    <div>本地 NAS: http://localhost:3721/api</div>
                    <div>云 ECS: http://8.152.195.33:7007/api</div>
                </div>
            </div>

            {/* 已保存配置列表 / Saved Configs List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-cyan-500 font-mono tracking-wider uppercase">
                        <Database className="w-3 h-3" /> 已存配置 / Saved Configs
                        {configs.length > 0 && (
                            <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">{configs.length}</span>
                        )}
                    </label>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSync}
                        disabled={isLoading}
                        className="h-7 text-[10px] font-mono border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                        同步 / Sync
                    </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {configs.length === 0 ? (
                        <div className="text-center py-8 bg-black/20 rounded-xl border border-white/5">
                            <Database className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-[10px] font-mono text-gray-600">
                                暂无已保存配置 / No saved configs<br />
                                <span className="text-gray-700">保存当前配置以创建第一条记录</span><br />
                                <span className="text-gray-700">Save current config to create first record</span>
                            </p>
                        </div>
                    ) : (
                        configs.map((cfg) => (
                            <motion.div
                                key={cfg.id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${
                                    cfg.is_active
                                        ? 'bg-cyan-900/15 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.08)]'
                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                                }`}
                                onClick={() => setActiveConfig(cfg.id)}
                            >
                                {/* 活跃指示 / Active indicator */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    cfg.is_active ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-gray-700'
                                }`} />

                                {/* 信息 / Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-mono text-gray-200 truncate">{cfg.name}</div>
                                    <div className="text-[9px] font-mono text-gray-500 flex items-center gap-2 mt-0.5">
                                        <span>{cfg.provider}</span>
                                        <span className="text-gray-700">/</span>
                                        <span className="truncate">{cfg.model}</span>
                                    </div>
                                </div>

                                {/* 状态标签 / Status badges */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {cfg.is_active && (
                                        <span className="text-[8px] font-mono bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                            ACTIVE
                                        </span>
                                    )}
                                    {cfg.id.startsWith('local_') && (
                                        <span className="text-[8px] font-mono bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                            LOCAL
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteConfig(cfg.id); }}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded text-gray-600 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* 同步状态底栏 / Sync status footer */}
            <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-[9px] font-mono">
                    <div className="flex items-center gap-2 text-gray-500">
                        <HardDrive className="w-3 h-3" />
                        <span>
                            {lastSyncTime
                                ? `最后同步 / Last sync: ${new Date(lastSyncTime).toLocaleString()}`
                                : '尚未同步 / Not yet synced'
                            }
                        </span>
                    </div>
                    <div className={`flex items-center gap-1 ${
                        syncStatus === 'synced' ? 'text-emerald-400' :
                        syncStatus === 'syncing' ? 'text-yellow-400' :
                        syncStatus === 'error' ? 'text-red-400' :
                        'text-gray-600'
                    }`}>
                        {syncStatus === 'syncing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        {syncStatus === 'synced' && <CheckCircle className="w-2.5 h-2.5" />}
                        {syncStatus === 'error' && <XCircle className="w-2.5 h-2.5" />}
                        <span>{syncStatus.toUpperCase()}</span>
                    </div>
                </div>

                {/* 待同步操作提示 / Pending operations hint */}
                {isGuest && (
                    <div className="mt-2 text-[8px] font-mono text-yellow-500/60 bg-yellow-500/5 px-2 py-1 rounded border border-yellow-500/10">
                        幽灵模式：数据仅存本地，登录后可同步到 PG<br />
                        Ghost mode: Local only. Login to sync to PG.
                    </div>
                )}
            </div>
        </div>
    );
}

export function ConfigPanel({ isOpen, onClose, config: initialConfig, onSave }: ConfigPanelProps) {
  const [config, setConfig] = useState<LLMConfig>({
      ...initialConfig,
      syncServerUrl: initialConfig.syncServerUrl || 'http://8.152.195.33:7007',
      temperature: initialConfig.temperature || 0.7,
      topP: initialConfig.topP || 0.9,
      maxTokens: initialConfig.maxTokens || 2048,
  });
  const [activeTab, setActiveTab] = useState<'engine' | 'voice' | 'persona' | 'cloud'>('engine');
  const [hint, setHint] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [presets, setPresets] = useState<ModelPreset[]>(DEFAULT_PRESETS);

  const ttsProviders = [
      { id: 'browser', name: 'Browser Native', desc: 'Offline, Zero Latency' },
      { id: 'openai', name: 'OpenAI TTS', desc: 'High-Fidelity, Token Cost' }
  ];

  // Auto-detect hints based on model name
  useEffect(() => {
      if (config.model) {
          setIsScanning(true);
          const timeout = setTimeout(() => {
              const lowerModel = config.model.toLowerCase();
              const key = Object.keys(MODEL_HINTS).find(k => lowerModel.includes(k));
              setHint(key ? MODEL_HINTS[key] : null);
              setIsScanning(false);
          }, 600);
          return () => clearTimeout(timeout);
      } else {
          setHint(null);
      }
  }, [config.model]);

  const handlePresetSelect = (preset: ModelPreset) => {
      const newConfig = createConfigFromPreset(preset, config);
      setConfig({ ...newConfig, temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens } as LLMConfig);
  };

  const handleCharacterSelect = (char: CharacterProfile) => {
      const updated = applyCharacterToConfig(char, config);
      setConfig({ ...config, ...updated });
  };

  const handleSave = () => {
      onSave(config);
      onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-3xl max-h-[85vh] bg-[#050a10]/70 border border-cyan-500/30 shadow-[0_0_50px_rgba(8,145,178,0.2)] relative flex flex-col rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Header */}
             <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-gradient-to-r from-cyan-950/30 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                        <Settings className="w-5 h-5 text-cyan-400 animate-[spin_10s_linear_infinite]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-mono font-bold text-cyan-100 tracking-wider uppercase">神经中枢设置 / NEURAL HUB SETTINGS</h2>
                        <div className="text-[10px] text-cyan-500/60 font-mono">系统配置_V7.4 / SYSTEM_CONFIG_V7.4</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">
                        <Save className="w-4 h-4" /> 保存配置 / Save Config
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 hover:text-white text-gray-400">
                        <X className="w-5 h-5" />
                    </Button>
                </div>
             </div>

             {/* Sidebar & Content Layout */}
             <div className="flex flex-1 overflow-hidden">
                 {/* Sidebar Navigation */}
                 <div className="w-56 bg-black/20 border-r border-white/5 p-4 space-y-2 hidden md:block shrink-0">
                     {[
                         { id: 'engine', label: '核心引擎 / Core Engine', icon: Cpu },
                         { id: 'voice', label: '语音合成 / Voice Synth', icon: Volume2, error: true },
                         { id: 'persona', label: '人格设定 / Persona', icon: Users },
                         { id: 'cloud', label: 'PG 数据同步 / PG DB Sync', icon: HardDrive }
                     ].map(tab => (
                         <button
                            key={tab.id}
                            disabled={tab.error}
                            onClick={() => !tab.error && setActiveTab(tab.id as any)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-mono transition-all ${
                                activeTab === tab.id 
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                                : tab.error 
                                    ? 'text-red-500/50 cursor-not-allowed border border-red-500/10 bg-red-900/5'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                         >
                             <tab.icon className="w-4 h-4" />
                             {tab.label}
                             {tab.error && <span className="ml-auto text-[8px] bg-red-500/20 text-red-400 px-1 rounded animate-pulse">FAULT</span>}
                         </button>
                     ))}
                     
                     <div className="pt-4 mt-4 border-t border-white/5">
                        <div className="px-3 text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">支持架构 / Supported Architectures</div>
                        <div className="px-3 flex flex-wrap gap-2 opacity-50">
                            {['GPT', 'GLM', 'Qwen', 'Yi', 'Llama'].map(t => (
                                <span key={t} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400">{t}</span>
                            ))}
                        </div>
                     </div>
                 </div>

                 {/* Main Content Area */}
                 <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
                    {activeTab === 'engine' && (
                        <div className="space-y-8">
                            {/* Preset Library Grid */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-xs text-cyan-500 font-mono tracking-wider uppercase">
                                    <Globe className="w-3 h-3" /> 模型信息 / Model Information Library
                                </label>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {presets.map((preset) => {
                                        const Icon = ICON_MAP[preset.iconName] || Globe;
                                        const isActive = config.model === preset.model && config.provider === preset.provider;
                                        
                                        return (
                                            <button
                                                key={preset.id}
                                                onClick={() => handlePresetSelect(preset)}
                                                className={`flex flex-col gap-2 p-3 rounded-xl border transition-all text-left group relative overflow-hidden h-full ${
                                                isActive
                                                    ? 'bg-cyan-900/20 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                                                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start w-full z-10">
                                                    <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]" />}
                                                </div>
                                                <div className="z-10 mt-auto pt-2">
                                                    <div className="font-bold text-xs font-mono truncate">{preset.name}</div>
                                                    <div className="text-[9px] opacity-50 font-mono mt-0.5 truncate">{preset.description}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {/* Custom Add Button - Visual Only for now */}
                                    <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/10 bg-white/5 text-gray-500 hover:text-white hover:border-white/20 transition-all">
                                        <Plus className="w-5 h-5" />
                                        <span className="text-[10px] font-mono">自定义模型 / Custom Model</span>
                                    </button>
                                </div>
                            </div>

                            {/* Connection Params */}
                            <div className="p-5 rounded-xl border border-white/10 bg-black/20 space-y-5">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-cyan-500" />
                                        <span className="text-xs font-mono text-cyan-100">连接矩阵 / CONNECTION_MATRIX</span>
                                    </div>
                                    <div className="flex gap-2">
                                         {config.provider === 'zhipu' && <span className="text-[9px] text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded bg-purple-500/10">BigModel Open Platform</span>}
                                         {config.provider === 'ollama' && <span className="text-[9px] text-green-400 border border-green-500/30 px-2 py-0.5 rounded bg-green-500/10">Local Network</span>}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase text-gray-500 font-mono">端点 URL / Endpoint URL</span>
                                        <Input 
                                            value={config.baseUrl}
                                            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                                            className="bg-black/40 border-white/10 text-cyan-100 font-mono text-xs h-9 focus:border-cyan-500/50"
                                            placeholder="https://api..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase text-gray-500 font-mono">目标模型 ID / Target Model ID</span>
                                        <div className="relative">
                                            <Input 
                                                value={config.model}
                                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                                className="bg-black/40 border-white/10 text-cyan-100 font-mono text-xs h-9 focus:border-cyan-500/50 pr-8"
                                                placeholder="e.g. glm-4, moonshot-v1-8k"
                                            />
                                            {isScanning && <RefreshCw className="absolute right-2 top-2.5 w-4 h-4 text-cyan-500 animate-spin" />}
                                        </div>
                                    </div>
                                </div>

                                {config.provider !== 'ollama' && config.baseUrl !== 'http://localhost:1234/v1' && (
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase text-gray-500 font-mono">密钥 / Secret Key</span>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
                                            <Input 
                                                type="password"
                                                value={config.apiKey}
                                                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                                className="bg-black/40 border-white/10 text-cyan-100 font-mono text-xs h-9 pl-9 focus:border-cyan-500/50"
                                                placeholder="sk-..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Intelligent Hint System */}
                                <AnimatePresence>
                                    {hint ? (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }} 
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-[10px] font-mono text-emerald-400 bg-emerald-900/10 border border-emerald-500/20 p-3 rounded flex items-start gap-3"
                                        >
                                            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                            <div>
                                                <div className="font-bold mb-0.5">检测到优化 / OPTIMIZATION DETECTED</div>
                                                <div className="opacity-80 leading-relaxed">{hint}</div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        config.model && !isScanning && (
                                            <motion.div 
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                className="text-[10px] font-mono text-gray-600 bg-white/5 border border-white/5 p-2 rounded flex items-center gap-2"
                                            >
                                                <Search className="w-3 h-3" />
                                                <span>等待架构识别... / Awaiting architecture identification...</span>
                                            </motion.div>
                                        )
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Hyper-Parameters Tuning */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-xs text-cyan-500 font-mono tracking-wider uppercase">
                                    <Sliders className="w-3 h-3" /> 参数调优 / Parameter Tuning
                                </label>
                                
                                <div className="grid grid-cols-2 gap-6 bg-black/20 p-4 rounded-xl border border-white/5">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-mono text-gray-400">
                                            <span>温度 / Temperature</span>
                                            <span className="text-cyan-400 bg-cyan-900/30 px-1.5 rounded">{config.temperature}</span>
                                        </div>
                                        <input 
                                            type="range" min="0" max="2" step="0.1"
                                            value={config.temperature}
                                            onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})}
                                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_cyan]"
                                        />
                                        <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                                            <span>精确 / PRECISE</span>
                                            <span>创造 / CREATIVE</span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-mono text-gray-400">
                                            <span>Top P</span>
                                            <span className="text-cyan-400 bg-cyan-900/30 px-1.5 rounded">{config.topP}</span>
                                        </div>
                                        <input 
                                            type="range" min="0" max="1" step="0.05"
                                            value={config.topP}
                                            onChange={(e) => setConfig({...config, topP: parseFloat(e.target.value)})}
                                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_cyan]"
                                        />
                                        <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                                            <span>聚焦 / FOCUSED</span>
                                            <span>多样 / DIVERSE</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'voice' && (
                        <div className="space-y-6 flex flex-col items-center justify-center h-full">
                             <div className="relative mb-4">
                                <AlertTriangle className="w-16 h-16 text-red-500/50 animate-pulse" />
                                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                             </div>
                             <div className="text-center space-y-2 max-w-xs">
                                 <h3 className="text-lg font-mono text-red-400 font-bold">系统故障 / SYSTEM FAULT</h3>
                                 <div className="text-xs font-mono text-red-500/70 bg-red-950/30 p-4 rounded-lg border border-red-500/20 text-left space-y-1">
                                    <div>[ERR_CODE: 0x503_VOICE_MOD]</div>
                                    <div>&gt; Initializing Audio Driver... FAILED</div>
                                    <div>&gt; Connecting to Neural TTS... TIMEOUT</div>
                                    <div className="animate-pulse">&gt; CRITICAL: Audio hardware unreachable</div>
                                 </div>
                                 <p className="text-[10px] font-mono text-gray-500 pt-2">该模块当前无法访问，请联系管理员修复。<br/>Module currently inaccessible. Contact admin.</p>
                             </div>
                        </div>
                    )}

                    {activeTab === 'persona' && (
                         <div className="space-y-4">
                            <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">角色铭刻 / Character Imprint</label>
                            <div className="space-y-2">
                                <textarea 
                                    value={config.systemPrompt}
                                    onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                                    className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed"
                                    placeholder="此输入系统提示词指令... / Enter system prompt instructions here..."
                                />
                                <div className="flex justify-end">
                                    <span className="text-[9px] text-gray-500 font-mono">预估 Token / TOKEN_COUNT_EST: {config.systemPrompt ? Math.ceil(config.systemPrompt.length / 4) : 0}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2 pt-4 border-t border-white/5">
                                <label className="text-[10px] text-gray-500 font-mono uppercase">快速预设 / Quick Presets</label>
                                {PRESET_CHARACTERS.map(char => (
                                    <button
                                        key={char.id}
                                        onClick={() => handleCharacterSelect(char)}
                                        className="text-left p-2 rounded hover:bg-white/5 flex items-center gap-2 group"
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${char.themeColor === 'red' ? 'bg-red-500' : 'bg-cyan-500'}`} />
                                        <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{char.name}</span>
                                    </button>
                                ))}
                            </div>
                         </div>
                    )}

                    {activeTab === 'cloud' && (
                         <PGSyncTab config={config} setConfig={setConfig} />
                    )}
                 </div>
             </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}