/**
 * NodeInspector - 节点检查/配置面板
 * Node Inspector / Configuration Panel
 * 
 * 阶段三 "引擎点火" - 每种节点类型的详细配置界面
 * Phase 3 "Engine Ignition" - Detailed config for each node type
 * audio_synth 节点显示故障界面 / audio_synth shows fault UI
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Type, Cpu, Image, Volume2, ArrowRightFromLine,
    GitBranch, Shuffle, AlertTriangle, Save, Settings,
    Zap, Terminal, Thermometer, Hash, FileText,
    ChevronDown, ChevronRight, Copy, Check
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useWorkflowStore, type CyberNodeData, type CyberNodeType } from '@/stores/workflow-store';

// ============================================================
// 节点图标映射 / Node Icon Map
// ============================================================

const NODE_ICONS: Record<CyberNodeType, React.ElementType> = {
    text_input: Type,
    llm_process: Cpu,
    image_gen: Image,
    audio_synth: Volume2,
    output: ArrowRightFromLine,
    condition: GitBranch,
    transform: Shuffle,
};

const NODE_COLORS: Record<CyberNodeType, string> = {
    text_input: 'cyan',
    llm_process: 'purple',
    image_gen: 'emerald',
    audio_synth: 'red',
    output: 'amber',
    condition: 'pink',
    transform: 'sky',
};

// ============================================================
// 变换操作选项 / Transform Operation Options
// ============================================================

const TRANSFORM_OPS = [
    { id: 'passthrough', label: '直通 / Passthrough', desc: '不做任何修改 / No modification' },
    { id: 'sanitize', label: '清洗 / Sanitize', desc: '移除 HTML 和特殊字符 / Remove HTML & special chars' },
    { id: 'uppercase', label: '大写 / Uppercase', desc: '转为大写 / Convert to uppercase' },
    { id: 'lowercase', label: '小写 / Lowercase', desc: '转为小写 / Convert to lowercase' },
    { id: 'truncate', label: '截断 / Truncate', desc: '限制文本长度 / Limit text length' },
    { id: 'extract_json', label: 'JSON 提取 / Extract JSON', desc: '从文本中提取 JSON / Extract JSON from text' },
    { id: 'word_count', label: '字数统计 / Word Count', desc: '统计字词数量 / Count words & chars' },
    { id: 'template', label: '模板 / Template', desc: '使用 {{input}} 插值 / Use {{input}} interpolation' },
    { id: 'split_lines', label: '按行分割 / Split Lines', desc: '按行分割为数组 / Split into array by lines' },
];

// ============================================================
// 条件规则选项 / Condition Rule Options
// ============================================================

const CONDITION_RULES = [
    { id: 'content_safety', label: '内容安全 / Content Safety', desc: '检测危险关键词 / Detect dangerous keywords' },
    { id: 'length_check', label: '长度检查 / Length Check', desc: '限制内容长度 / Limit content length' },
    { id: 'keyword_filter', label: '关键词过滤 / Keyword Filter', desc: '自定义关键词拦截 / Custom keyword filtering' },
    { id: 'not_empty', label: '非空检查 / Not Empty', desc: '确保输入不为空 / Ensure input is not empty' },
];

// ============================================================
// 主组件 / Main Component
// ============================================================

interface NodeInspectorProps {
    onClose: () => void;
}

export function NodeInspector({ onClose }: NodeInspectorProps) {
    const { selectedNodeId, nodes, updateNodeData, removeNode, executionStatus } = useWorkflowStore();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        basic: true,
        config: true,
        advanced: false,
        output: true,
    });
    const [copied, setCopied] = useState(false);

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;

    const nodeData = node.data as CyberNodeData;
    const Icon = NODE_ICONS[nodeData.type] || Settings;
    const color = NODE_COLORS[nodeData.type] || 'gray';
    const isFault = nodeData.type === 'audio_synth';

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const updateConfig = (key: string, value: any) => {
        updateNodeData(node.id, {
            config: { ...nodeData.config, [key]: value },
        });
    };

    const handleCopyOutput = () => {
        const output = nodeData.config?._lastOutput;
        if (output) {
            navigator.clipboard.writeText(typeof output === 'string' ? output : JSON.stringify(output, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // ---- 故障节点 / Fault Node ----
    if (isFault) {
        return (
            <div className="h-full flex flex-col">
                <InspectorHeader icon={Icon} color="red" label={nodeData.label} type="FAULT" onClose={onClose} />
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                    <div className="relative">
                        <AlertTriangle className="w-16 h-16 text-red-500/50 animate-pulse" />
                        <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="font-mono text-red-400">系统故障 / SYSTEM FAULT</h3>
                        <div className="text-[10px] font-mono text-red-500/70 bg-red-950/30 p-3 rounded-lg border border-red-500/20 text-left space-y-0.5 w-full max-w-xs">
                            <div>[ERR_CODE: 0x503_VOICE_MOD]</div>
                            <div>{'>'} Audio synthesis pipeline: CORRUPTED</div>
                            <div>{'>'} Hardware abstraction layer: MISSING</div>
                            <div>{'>'} Neural TTS interface: TIMEOUT (8000ms)</div>
                            <div className="animate-pulse">{'>'} STATUS: PERMANENTLY OFFLINE</div>
                        </div>
                        <p className="text-[9px] font-mono text-gray-600 pt-2">
                            此模块已硬编码为故障状态，无法配置。<br/>
                            This module is hardcoded as faulted. Not configurable.
                        </p>
                    </div>
                    <button
                        onClick={() => { removeNode(node.id); onClose(); }}
                        className="mt-4 px-4 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono hover:bg-red-500/20 transition-colors"
                    >
                        移除节点 / Remove Node
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <InspectorHeader icon={Icon} color={color} label={nodeData.label} type={nodeData.type.toUpperCase()} onClose={onClose} />

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* ---- 基础信息 / Basic Info ---- */}
                <CollapsibleSection
                    title="基础 / Basic"
                    icon={<Settings className="w-3 h-3" />}
                    expanded={expandedSections.basic}
                    onToggle={() => toggleSection('basic')}
                    color={color}
                >
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-[9px] font-mono text-gray-500 uppercase">标签名 / Label</span>
                            <Input
                                value={nodeData.label}
                                onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
                                className="bg-black/40 border-white/10 text-gray-200 font-mono text-[11px] h-8"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/20 rounded p-2">
                                <div className="text-[8px] font-mono text-gray-600 uppercase">ID</div>
                                <div className="text-[9px] font-mono text-gray-400 truncate">{node.id}</div>
                            </div>
                            <div className="bg-black/20 rounded p-2">
                                <div className="text-[8px] font-mono text-gray-600 uppercase">状态 / Status</div>
                                <div className={`text-[9px] font-mono ${
                                    nodeData.status === 'completed' ? 'text-emerald-400' :
                                    nodeData.status === 'running' ? 'text-yellow-400' :
                                    nodeData.status === 'failed' ? 'text-red-400' :
                                    'text-gray-400'
                                }`}>
                                    {(nodeData.status || 'idle').toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* ---- 节点配置 / Node Config ---- */}
                <CollapsibleSection
                    title="配置 / Config"
                    icon={<Zap className="w-3 h-3" />}
                    expanded={expandedSections.config}
                    onToggle={() => toggleSection('config')}
                    color={color}
                >
                    {nodeData.type === 'text_input' && (
                        <TextInputConfig config={nodeData.config} onUpdate={updateConfig} />
                    )}
                    {nodeData.type === 'llm_process' && (
                        <LLMProcessConfig config={nodeData.config} onUpdate={updateConfig} />
                    )}
                    {nodeData.type === 'image_gen' && (
                        <ImageGenConfig config={nodeData.config} onUpdate={updateConfig} />
                    )}
                    {nodeData.type === 'output' && (
                        <OutputConfig config={nodeData.config} onUpdate={updateConfig} />
                    )}
                    {nodeData.type === 'condition' && (
                        <ConditionConfig config={nodeData.config} onUpdate={updateConfig} />
                    )}
                    {nodeData.type === 'transform' && (
                        <TransformConfig config={nodeData.config} onUpdate={updateConfig} />
                    )}
                </CollapsibleSection>

                {/* ---- 执行输出 / Execution Output ---- */}
                {nodeData.config?._lastOutput && (
                    <CollapsibleSection
                        title="输出 / Output"
                        icon={<Terminal className="w-3 h-3" />}
                        expanded={expandedSections.output}
                        onToggle={() => toggleSection('output')}
                        color={color}
                        rightAction={
                            <button onClick={handleCopyOutput} className="p-1 hover:bg-white/10 rounded transition-colors">
                                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                            </button>
                        }
                    >
                        <div className="bg-black/30 rounded-lg p-2 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                            <pre className="text-[9px] font-mono text-gray-300 whitespace-pre-wrap break-all">
                                {typeof nodeData.config._lastOutput === 'string'
                                    ? nodeData.config._lastOutput
                                    : JSON.stringify(nodeData.config._lastOutput, null, 2)
                                }
                            </pre>
                        </div>
                        {nodeData.config._lastDuration && (
                            <div className="text-[8px] font-mono text-gray-600 mt-1">
                                耗时 / Duration: {nodeData.config._lastDuration}ms
                            </div>
                        )}
                    </CollapsibleSection>
                )}
            </div>

            {/* ---- 底部操作栏 / Bottom Actions ---- */}
            <div className="p-3 border-t border-white/5 bg-black/20 flex justify-between items-center">
                <button
                    onClick={() => { removeNode(node.id); onClose(); }}
                    className="px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono hover:bg-red-500/20 transition-colors"
                >
                    删除 / Delete
                </button>
                <div className="text-[8px] font-mono text-gray-600">
                    Phase 3 // Engine Ignition
                </div>
            </div>
        </div>
    );
}

// ============================================================
// 子组件 / Sub-components
// ============================================================

function InspectorHeader({ icon: Icon, color, label, type, onClose }: {
    icon: React.ElementType;
    color: string;
    label: string;
    type: string;
    onClose: () => void;
}) {
    const colorClasses: Record<string, string> = {
        cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        red: 'text-red-400 bg-red-500/10 border-red-500/30',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        pink: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
        sky: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    };

    const cls = colorClasses[color] || colorClasses.cyan;

    return (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 rounded border ${cls}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] font-mono text-gray-200 truncate">{label}</div>
                    <div className="text-[8px] font-mono text-gray-600 uppercase tracking-widest">{type}</div>
                </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

function CollapsibleSection({ title, icon, expanded, onToggle, color, children, rightAction }: {
    title: string;
    icon: React.ReactNode;
    expanded: boolean;
    onToggle: () => void;
    color: string;
    children: React.ReactNode;
    rightAction?: React.ReactNode;
}) {
    return (
        <div className="border-b border-white/5">
            <button
                onClick={onToggle}
                className="flex items-center justify-between w-full px-3 py-2 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                    {icon}
                    {title}
                </div>
                <div className="flex items-center gap-1">
                    {rightAction}
                    {expanded ? <ChevronDown className="w-3 h-3 text-gray-600" /> : <ChevronRight className="w-3 h-3 text-gray-600" />}
                </div>
            </button>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================
// 节点类型专用配置 / Node Type Specific Configs
// ============================================================

function TextInputConfig({ config, onUpdate }: { config: Record<string, any>; onUpdate: (k: string, v: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">输入文本 / Input Text</span>
                <textarea
                    value={config.value || config.prompt || ''}
                    onChange={(e) => onUpdate('value', e.target.value)}
                    className="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-mono text-gray-300 resize-none focus:outline-none focus:border-cyan-500/30"
                    placeholder="输入要传递给下游节点的文本数据...&#10;Enter text data to pass to downstream nodes..."
                />
            </div>
            <div className="text-[8px] font-mono text-gray-600 bg-black/20 p-2 rounded">
                此节点的输出将作为下游节点的输入。<br/>
                This node's output feeds into downstream nodes.
            </div>
        </div>
    );
}

function LLMProcessConfig({ config, onUpdate }: { config: Record<string, any>; onUpdate: (k: string, v: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" /> 模型 / Model
                </span>
                <Input
                    value={config.model || 'auto'}
                    onChange={(e) => onUpdate('model', e.target.value)}
                    className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                    placeholder="auto (使用全局配置 / use global config)"
                />
                <div className="text-[8px] font-mono text-gray-600">
                    "auto" = 使用全局配置 / Uses global AI config
                </div>
            </div>

            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">系统提示词 / System Prompt</span>
                <textarea
                    value={config.prompt || config.systemPrompt || ''}
                    onChange={(e) => onUpdate('prompt', e.target.value)}
                    className="w-full h-20 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-mono text-gray-300 resize-none focus:outline-none focus:border-purple-500/30"
                    placeholder="自定义此节点的系统提示词（可选）...&#10;Custom system prompt for this node (optional)..."
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase flex items-center gap-1">
                        <Thermometer className="w-2.5 h-2.5" /> 温度 / Temp
                    </span>
                    <Input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={config.temperature ?? ''}
                        onChange={(e) => onUpdate('temperature', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                        placeholder="auto"
                    />
                </div>
                <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" /> Max Tokens
                    </span>
                    <Input
                        type="number"
                        min={1}
                        max={128000}
                        value={config.maxTokens ?? ''}
                        onChange={(e) => onUpdate('maxTokens', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                        placeholder="auto"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">自定义端点 / Custom Endpoint</span>
                <Input
                    value={config.baseUrl || ''}
                    onChange={(e) => onUpdate('baseUrl', e.target.value)}
                    className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                    placeholder="留空使用全局配置 / Leave empty for global"
                />
            </div>

            <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-2 text-[8px] font-mono text-purple-400/70">
                <Zap className="w-3 h-3 inline mr-1" />
                阶段三引擎：此节点将调用真实 LLM API。上游输出将作为 user message 传入。<br/>
                Phase 3 Engine: This node calls real LLM API. Upstream output becomes user message.
            </div>
        </div>
    );
}

function ImageGenConfig({ config, onUpdate }: { config: Record<string, any>; onUpdate: (k: string, v: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">图像提示词 / Image Prompt</span>
                <textarea
                    value={config.prompt || ''}
                    onChange={(e) => onUpdate('prompt', e.target.value)}
                    className="w-full h-16 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-mono text-gray-300 resize-none focus:outline-none focus:border-emerald-500/30"
                    placeholder="若留空则使用上游输入...&#10;If empty, uses upstream input..."
                />
            </div>
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">API 端点 / API Endpoint</span>
                <Input
                    value={config.apiEndpoint || ''}
                    onChange={(e) => onUpdate('apiEndpoint', e.target.value)}
                    className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                    placeholder="https://api.example.com/v1/images/generate"
                />
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-[8px] font-mono text-emerald-400/70">
                未配置 API 端点时将以模拟模式运行。<br/>
                Runs in simulation mode when API endpoint is not configured.
            </div>
        </div>
    );
}

function OutputConfig({ config, onUpdate }: { config: Record<string, any>; onUpdate: (k: string, v: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">输出格式 / Output Format</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {[
                        { id: 'merge', label: '文本合并 / Merge' },
                        { id: 'json', label: 'JSON 对象 / JSON Object' },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onUpdate('format', opt.id)}
                            className={`px-2 py-1.5 rounded text-[9px] font-mono border transition-all ${
                                (config.format || 'merge') === opt.id
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                    : 'bg-white/[0.02] border-white/5 text-gray-500 hover:bg-white/5'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-[8px] font-mono text-amber-400/70">
                输出节点聚合所有上游数据。它是 DAG 执行的终点。<br/>
                Output node aggregates all upstream data. It is the DAG execution endpoint.
            </div>
        </div>
    );
}

function ConditionConfig({ config, onUpdate }: { config: Record<string, any>; onUpdate: (k: string, v: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">判断规则 / Condition Rule</span>
                <div className="space-y-1.5">
                    {CONDITION_RULES.map(rule => (
                        <button
                            key={rule.id}
                            onClick={() => onUpdate('rule', rule.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                                (config.rule || 'content_safety') === rule.id
                                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-300'
                                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            <div className="text-[10px] font-mono">{rule.label}</div>
                            <div className="text-[8px] font-mono opacity-50 mt-0.5">{rule.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 规则参数 / Rule parameters */}
            {(config.rule || 'content_safety') === 'length_check' && (
                <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase">最大长度 / Max Length</span>
                    <Input
                        type="number"
                        value={config.maxLength || 1000}
                        onChange={(e) => onUpdate('maxLength', parseInt(e.target.value) || 1000)}
                        className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                    />
                </div>
            )}
            {(config.rule || 'content_safety') === 'keyword_filter' && (
                <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase">关键词列表 / Keywords (逗号分隔)</span>
                    <Input
                        value={config.keywords || ''}
                        onChange={(e) => onUpdate('keywords', e.target.value)}
                        className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                        placeholder="keyword1, keyword2, ..."
                    />
                </div>
            )}
        </div>
    );
}

function TransformConfig({ config, onUpdate }: { config: Record<string, any>; onUpdate: (k: string, v: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase">变换操作 / Transform Operation</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {TRANSFORM_OPS.map(op => (
                        <button
                            key={op.id}
                            onClick={() => onUpdate('operation', op.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                                (config.operation || 'passthrough') === op.id
                                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            <div className="text-[10px] font-mono">{op.label}</div>
                            <div className="text-[8px] font-mono opacity-50 mt-0.5">{op.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 操作参数 / Operation parameters */}
            {config.operation === 'truncate' && (
                <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase">最大长度 / Max Length</span>
                    <Input
                        type="number"
                        value={config.maxLength || 500}
                        onChange={(e) => onUpdate('maxLength', parseInt(e.target.value) || 500)}
                        className="bg-black/40 border-white/10 text-gray-200 font-mono text-[10px] h-7"
                    />
                </div>
            )}
            {config.operation === 'template' && (
                <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase">模板 / Template</span>
                    <textarea
                        value={config.template || '{{input}}'}
                        onChange={(e) => onUpdate('template', e.target.value)}
                        className="w-full h-16 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-mono text-gray-300 resize-none focus:outline-none focus:border-sky-500/30"
                        placeholder="使用 {{input}} 引用上游数据...&#10;Use {{input}} to reference upstream data..."
                    />
                </div>
            )}
        </div>
    );
}
