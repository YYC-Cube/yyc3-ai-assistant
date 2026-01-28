import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Save, X, Server, Key, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LLMConfig, DEFAULT_CONFIG } from '@/utils/llm';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

export function ConfigPanel({ isOpen, onClose, config: initialConfig, onSave }: ConfigPanelProps) {
  const [config, setConfig] = useState<LLMConfig>(initialConfig);

  const providers = [
    { id: 'ollama', name: 'Ollama (Local)', icon: Box },
    { id: 'openai', name: 'OpenAI', icon: Server },
    { id: 'deepseek', name: 'DeepSeek', icon: Server },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-[#0f172a] border border-cyan-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Decorative background */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <Settings className="w-5 h-5 text-cyan-400" />
                 核心配置
               </h2>
               <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
                 <X className="w-5 h-5" />
               </Button>
             </div>

             <div className="space-y-6">
               {/* Provider Selection */}
               <div className="space-y-2">
                 <label className="text-xs text-gray-400 uppercase tracking-wider">模型服务商</label>
                 <div className="grid grid-cols-3 gap-2">
                   {providers.map((p) => (
                     <button
                       key={p.id}
                       onClick={() => setConfig({ ...config, provider: p.id as any })}
                       className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                         config.provider === p.id
                           ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                           : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                       }`}
                     >
                       <p.icon className="w-5 h-5 mb-1" />
                       <span className="text-xs">{p.name}</span>
                     </button>
                   ))}
                 </div>
               </div>

               {/* Base URL */}
               <div className="space-y-2">
                 <label className="text-xs text-gray-400 uppercase tracking-wider">API 地址 (Base URL)</label>
                 <Input 
                   value={config.baseUrl}
                   onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                   className="bg-black/20 border-white/10 text-white font-mono text-sm"
                   placeholder="http://localhost:11434"
                 />
                 {config.provider === 'ollama' && (
                   <p className="text-[10px] text-yellow-500/80">
                     * 请确保 Ollama 启动时设置了 OLLAMA_ORIGINS="*"
                   </p>
                 )}
               </div>

               {/* Model Name */}
               <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">模型名称</label>
                  <Input 
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="bg-black/20 border-white/10 text-white font-mono text-sm"
                    placeholder="llama3, gpt-4, deepseek-chat"
                  />
               </div>

               {/* API Key */}
               {config.provider !== 'ollama' && (
                 <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase tracking-wider">API Key</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        className="bg-black/20 border-white/10 text-white font-mono text-sm pl-9"
                        placeholder="sk-..."
                      />
                    </div>
                 </div>
               )}
             </div>

             <div className="mt-8">
               <Button 
                 onClick={() => {
                   onSave(config);
                   onClose();
                 }}
                 className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2 rounded-xl shadow-lg shadow-cyan-900/20"
               >
                 <Save className="w-4 h-4 mr-2" />
                 保存并重启核心
               </Button>
             </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
