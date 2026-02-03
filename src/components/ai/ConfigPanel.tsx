import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Save, X, Server, Key, Box, Cpu, RotateCcw, Volume2, Mic, Users, Download, Upload, Cloud, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LLMConfig, DEFAULT_CONFIG } from '@/utils/llm';
import { PRESET_CHARACTERS, applyCharacterToConfig, CharacterProfile } from '@/utils/character';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

export interface ExtendedConfig extends LLMConfig {
    syncServerUrl?: string;
}

export function ConfigPanel({ isOpen, onClose, config: initialConfig, onSave }: ConfigPanelProps) {
  const [config, setConfig] = useState<ExtendedConfig>({
      ...initialConfig,
      syncServerUrl: (initialConfig as any).syncServerUrl || 'http://8.152.195.33:7007'
  });
  const [activeTab, setActiveTab] = useState<'llm' | 'tts' | 'chars' | 'cloud'>('llm');

  const providers = [
    { id: 'ollama', name: 'Ollama 本地', icon: Box, desc: '私有部署, 无需 Key' },
    { id: 'deepseek', name: 'DeepSeek', icon: Cpu, desc: 'API, 高性价比' },
    { id: 'openai', name: 'OpenAI', icon: Server, desc: 'GPT-4, 行业标准' },
    { id: 'moonshot', name: 'Kimi (Moonshot)', icon: Server, desc: '长文本支持' },
  ];

  const ttsProviders = [
      { id: 'browser', name: 'Browser Native', desc: '离线, 机械音' },
      { id: 'openai', name: 'OpenAI TTS', desc: '高清拟人, 需消耗 Token' }
  ];

  const openaiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

  const handleProviderChange = (id: string) => {
      const newConfig = { ...config, provider: id as any };
      if (id === 'ollama') newConfig.baseUrl = 'http://localhost:11434';
      if (id === 'deepseek') newConfig.baseUrl = 'https://api.deepseek.com';
      if (id === 'moonshot') newConfig.baseUrl = 'https://api.moonshot.cn/v1';
      if (id === 'openai') newConfig.baseUrl = 'https://api.openai.com/v1';
      setConfig(newConfig);
  };

  const handleCharacterSelect = (char: CharacterProfile) => {
      const updated = applyCharacterToConfig(char, config);
      setConfig({ ...config, ...updated });
  };

  const isMixedContentRisk = () => {
      if (typeof window === 'undefined') return false;
      return window.location.protocol === 'https:' && config.syncServerUrl?.startsWith('http:');
  };

  const exportCharacter = () => {
      const char: CharacterProfile = {
          id: `custom_${Date.now()}`,
          name: 'Custom Export',
          description: 'Exported Configuration',
          systemPrompt: config.systemPrompt || '',
          ttsConfig: {
              provider: config.ttsProvider,
              voice: config.ttsVoice,
              speed: config.ttsSpeed
          },
          themeColor: 'cyan'
      };
      const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yyc_character_${Date.now()}.json`;
      a.click();
  };

  const importCharacter = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const char = JSON.parse(ev.target?.result as string) as CharacterProfile;
              if (char.systemPrompt && char.ttsConfig) {
                  handleCharacterSelect(char);
                  alert(`已加载角色: ${char.name}`);
              }
          } catch (err) {
              alert('无效的角色文件');
          }
      };
      reader.readAsText(file);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" // Changed to justify-center and padded
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }} // Changed animation to scale/fade up
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-md max-h-[80vh] bg-[#0f172a]/80 border border-cyan-500/20 shadow-2xl relative flex flex-col rounded-3xl backdrop-blur-xl overflow-hidden" // Added rounded-3xl, backdrop-blur, removed sidebar styling
            onClick={(e) => e.stopPropagation()}
          >
             {/* Header */}
             <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-cyan-400" />
                    神经中枢设置
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
                    <X className="w-5 h-5 text-gray-400" />
                </Button>
             </div>

             {/* Tabs */}
             <div className="flex px-6 pt-4 gap-4 border-b border-white/5 overflow-x-auto no-scrollbar">
                 <button 
                    onClick={() => setActiveTab('llm')}
                    className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'llm' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                 >
                     大脑
                     {activeTab === 'llm' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                 </button>
                 <button 
                    onClick={() => setActiveTab('tts')}
                    className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'tts' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                 >
                     声音
                     {activeTab === 'tts' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                 </button>
                 <button 
                    onClick={() => setActiveTab('chars')}
                    className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'chars' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                 >
                     角色
                     {activeTab === 'chars' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                 </button>
                 <button 
                    onClick={() => setActiveTab('cloud')}
                    className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'cloud' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                 >
                     云端
                     {activeTab === 'cloud' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                 </button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
                {activeTab === 'llm' && (
                    <>
                        <div className="space-y-3">
                        <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">核心引擎</label>
                        <div className="grid grid-cols-1 gap-2">
                            {providers.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => handleProviderChange(p.id)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                                config.provider === p.id
                                    ? 'bg-cyan-600/20 border-cyan-500 text-white'
                                    : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                <div className={`p-2 rounded-lg ${config.provider === p.id ? 'bg-cyan-500 text-black' : 'bg-black/40 text-gray-500'}`}>
                                <p.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                <div className="font-medium text-sm">{p.name}</div>
                                <div className="text-[10px] opacity-60">{p.desc}</div>
                                </div>
                                {config.provider === p.id && <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
                            </button>
                            ))}
                        </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">连接参数</label>
                            
                            <div className="space-y-1">
                                <span className="text-xs text-gray-400">API 地址</span>
                                <Input 
                                value={config.baseUrl}
                                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                                className="bg-black/40 border-white/10 text-white font-mono text-xs h-9"
                                />
                            </div>

                            <div className="space-y-1">
                                <span className="text-xs text-gray-400">模型名称</span>
                                <Input 
                                value={config.model}
                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                className="bg-black/40 border-white/10 text-white font-mono text-xs h-9"
                                placeholder="例如: llama3, gpt-4"
                                />
                            </div>

                            {config.provider !== 'ollama' && (
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400">API Key</span>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                                        <Input 
                                            type="password"
                                            value={config.apiKey}
                                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                            className="bg-black/40 border-white/10 text-white font-mono text-xs h-9 pl-8"
                                            placeholder="sk-..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">人格设定</label>
                            <textarea 
                                value={config.systemPrompt}
                                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none"
                            />
                        </div>
                    </>
                )}
                
                {activeTab === 'tts' && (
                    <>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">语音引擎</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ttsProviders.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setConfig({...config, ttsProvider: p.id as any})}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                config.ttsProvider === p.id 
                                                ? 'bg-cyan-600/20 border-cyan-500 text-white' 
                                                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="font-medium text-sm mb-1">{p.name}</div>
                                            <div className="text-[10px] opacity-60">{p.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {config.ttsProvider === 'openai' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400">音色选择 (Voice)</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {openaiVoices.map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => setConfig({...config, ttsVoice: v})}
                                                    className={`px-2 py-2 text-xs rounded-lg border text-center capitalize ${
                                                        config.ttsVoice === v
                                                        ? 'bg-cyan-500 text-black border-cyan-500 font-bold'
                                                        : 'bg-black/40 text-gray-400 border-white/10 hover:border-white/30'
                                                    }`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400">语速 (Speed): {config.ttsSpeed}</label>
                                        <input 
                                            type="range" min="0.5" max="2.0" step="0.1"
                                            value={config.ttsSpeed}
                                            onChange={(e) => setConfig({...config, ttsSpeed: parseFloat(e.target.value)})}
                                            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                                        />
                                    </div>

                                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-[10px] text-yellow-200/80 leading-relaxed">
                                        注意: OpenAI TTS 需要消耗 Token 且产生费用。请确保已在 "大脑" 标签页配置了有效的 OpenAI/DeepSeek API Key。
                                    </div>
                                </div>
                            )}
                            
                            {config.ttsProvider === 'browser' && (
                                <div className="p-3 bg-white/5 rounded-lg text-xs text-gray-400 text-center">
                                    浏览器原生语音无需配置，但效果取决于您的操作系统。
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'chars' && (
                    <>
                        <div className="space-y-4">
                            <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">预设灵魂 (Presets)</label>
                            <div className="grid grid-cols-1 gap-2">
                                {PRESET_CHARACTERS.map(char => (
                                    <button
                                        key={char.id}
                                        onClick={() => handleCharacterSelect(char)}
                                        className="group p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/50 transition-all text-left flex items-start gap-3"
                                    >
                                        <div className={`mt-1 w-2 h-2 rounded-full ${char.themeColor === 'red' ? 'bg-red-500' : 'bg-cyan-500'}`} />
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-cyan-400">{char.name}</div>
                                            <div className="text-[10px] text-gray-400 leading-snug">{char.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <label className="text-xs text-cyan-500 font-mono tracking-wider uppercase">灵魂传输 (Transfer)</label>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-xs"
                                        onClick={exportCharacter}
                                    >
                                        <Download className="w-3 h-3 mr-2" />
                                        导出当前配置
                                    </Button>
                                    <div className="flex-1 relative">
                                        <input 
                                            type="file" 
                                            accept=".json"
                                            onChange={importCharacter}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-xs pointer-events-none"
                                        >
                                            <Upload className="w-3 h-3 mr-2" />
                                            导入配置
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'cloud' && (
                     <>
                        <div className="space-y-6">
                            <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                                    <Cloud className="w-4 h-4 text-purple-400" />
                                    云端同步 (Private Cloud)
                                </h3>
                                <p className="text-[10px] text-gray-400 leading-relaxed">
                                    将您的记忆和偏好同步到私有 PostgreSQL 服务器。请确保服务器已正确配置 CORS 并允许来自本应用的请求。
                                </p>
                            </div>

                            {isMixedContentRisk() && (
                                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-red-400 mb-1">连接协议不安全 (Mixed Content)</h4>
                                        <p className="text-[10px] text-red-200/70 leading-relaxed">
                                            当前应用运行在 HTTPS 安全环境下，无法直接连接 HTTP 服务器 ({config.syncServerUrl})。
                                        </p>
                                        <div className="mt-2 text-[10px] text-white/50">
                                            解决方案：
                                            <ul className="list-disc pl-3 mt-1 space-y-1">
                                                <li>使用 <strong>ngrok</strong> 将本地服务器映射为 HTTPS。</li>
                                                <li>为您的服务器配置 SSL 证书。</li>
                                                <li>或者使用 Supabase 等支持 HTTPS 的云服务。</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-purple-400 font-mono tracking-wider uppercase">服务器地址</label>
                                    <Input 
                                        value={config.syncServerUrl}
                                        onChange={(e) => setConfig({ ...config, syncServerUrl: e.target.value })}
                                        className="bg-black/40 border-white/10 text-white font-mono text-xs h-9"
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button 
                                        variant="secondary" 
                                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs h-8"
                                        onClick={() => {
                                            if (isMixedContentRisk()) {
                                                alert("请先解决 Mixed Content 问题（见上方红框警告）。");
                                                return;
                                            }
                                            alert("同步功能已在后台就绪，可通过 useAI Hook 自动触发。");
                                        }}
                                    >
                                        <RefreshCw className="w-3 h-3 mr-2" />
                                        测试连接
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-white/10 text-xs h-8 text-gray-400"
                                        onClick={() => window.open('https://ngrok.com', '_blank')}
                                    >
                                        <ExternalLink className="w-3 h-3 mr-2" />
                                        Ngrok
                                    </Button>
                                </div>
                            </div>
                        </div>
                     </>
                )}
             </div>

             {/* Footer Actions */}
             <div className="p-6 pt-0 flex gap-3 mt-auto bg-[#0f172a]/95">
                <Button 
                    variant="outline" 
                    className="flex-1 border-white/10 hover:bg-white/5 text-gray-400"
                    onClick={() => setConfig({ ...DEFAULT_CONFIG, syncServerUrl: 'http://8.152.195.33:7007' } as any)}
                >
                    <RotateCcw className="w-3 h-3 mr-2" />
                    重置
                </Button>
                <Button 
                    onClick={() => {
                        onSave(config);
                        onClose();
                    }}
                    className="flex-[2] bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-900/20 border-0"
                >
                    <Save className="w-4 h-4 mr-2" />
                    保存配置
                </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
