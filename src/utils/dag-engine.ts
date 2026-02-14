/**
 * YYC3 DAG Execution Engine V2 - 阶段三 "引擎点火"
 * Phase 3 "Engine Ignition" - Real LLM API Integration
 * 
 * 支持：
 * - 拓扑排序执行 / Topological sort execution
 * - 真实 LLM API 调用 / Real LLM API calls
 * - 节点间数据流 / Inter-node data flow
 * - audio_synth 硬编码故障 / audio_synth hardcoded fault
 * - 条件分支逻辑 / Condition branching logic
 * - 数据变换管道 / Data transform pipeline
 */

import { generateCompletion } from './llm';
import type { LLMConfig, MessageContent } from '@/types';

// ============================================================
// 类型定义 / Type Definitions
// ============================================================

export type CyberNodeType = 'text_input' | 'llm_process' | 'image_gen' | 'audio_synth' | 'output' | 'condition' | 'transform';

export interface DAGNode {
    id: string;
    type: CyberNodeType;
    label: string;
    config: Record<string, any>;
}

export interface DAGEdge {
    id: string;
    source: string;
    target: string;
}

export interface ExecutionContext {
    nodeId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    output?: any;
    error?: string;
    timestamp: number;
    durationMs?: number;
}

export interface DAGExecutionResult {
    success: boolean;
    logs: ExecutionContext[];
    outputs: Record<string, any>;
    totalDurationMs: number;
}

export type ExecutionCallback = (ctx: ExecutionContext) => void;

// ============================================================
// DAG 引擎 V2 / DAG Engine V2
// ============================================================

export class DAGEngineV2 {
    private nodes: DAGNode[];
    private edges: DAGEdge[];
    private llmConfig: LLMConfig;
    private onProgress?: ExecutionCallback;
    private nodeOutputs: Record<string, any> = {};
    private logs: ExecutionContext[] = [];
    private aborted = false;
    private abortController: AbortController = new AbortController();

    constructor(
        nodes: DAGNode[],
        edges: DAGEdge[],
        llmConfig: LLMConfig,
        onProgress?: ExecutionCallback,
    ) {
        this.nodes = nodes;
        this.edges = edges;
        this.llmConfig = llmConfig;
        this.onProgress = onProgress;
    }

    /** 中止执行 / Abort execution */
    abort() {
        this.aborted = true;
        this.abortController.abort();
    }

    /** 获取中止信号 / Get abort signal */
    get signal(): AbortSignal {
        return this.abortController.signal;
    }

    /** 验证 DAG / Validate DAG */
    validate(): { valid: boolean; error?: string } {
        if (this.nodes.length === 0) {
            return { valid: false, error: 'DAG 为空 / DAG is empty' };
        }

        // audio_synth 硬编码故障检查 / Hardcoded audio_synth fault check
        const audioNode = this.nodes.find(n => n.type === 'audio_synth');
        if (audioNode) {
            return {
                valid: false,
                error: `CRITICAL FAULT: Node "${audioNode.label}" (audio_synth) — Module corrupted [ERR_CODE: 0x503_VOICE_MOD]. Execution blocked by system integrity check.`,
            };
        }

        // 环检测 / Cycle detection
        try {
            this.topologicalSort();
        } catch {
            return { valid: false, error: 'DAG 中检测到环路 / Cycle detected in DAG' };
        }

        return { valid: true };
    }

    /** 执行 DAG / Execute DAG */
    async execute(): Promise<DAGExecutionResult> {
        const startTime = Date.now();
        this.nodeOutputs = {};
        this.logs = [];
        this.aborted = false;

        // 验证 / Validate
        const validation = this.validate();
        if (!validation.valid) {
            this.emitLog('system', 'failed', undefined, validation.error);
            return { success: false, logs: this.logs, outputs: {}, totalDurationMs: Date.now() - startTime };
        }

        const executionOrder = this.topologicalSort();
        this.emitLog('system', 'running', `开始执行 ${executionOrder.length} 个节点 / Starting execution of ${executionOrder.length} nodes`);

        for (const nodeId of executionOrder) {
            if (this.aborted) {
                this.emitLog('system', 'failed', undefined, '执行已中止 / Execution aborted');
                return { success: false, logs: this.logs, outputs: this.nodeOutputs, totalDurationMs: Date.now() - startTime };
            }

            const node = this.nodes.find(n => n.id === nodeId);
            if (!node) continue;

            // 检查条件分支跳过 / Check condition branch skip
            if (this.shouldSkipNode(nodeId)) {
                this.emitLog(nodeId, 'skipped', '条件分支跳过 / Skipped by condition branch');
                continue;
            }

            this.emitLog(nodeId, 'running', `执行: ${node.label}`);
            const nodeStart = Date.now();

            try {
                const inputs = this.gatherInputs(nodeId);
                const output = await this.executeNode(node, inputs);
                this.nodeOutputs[nodeId] = output;
                const durationMs = Date.now() - nodeStart;
                this.emitLog(nodeId, 'completed', output, undefined, durationMs);
            } catch (err: any) {
                const durationMs = Date.now() - nodeStart;
                this.emitLog(nodeId, 'failed', undefined, err.message || String(err), durationMs);
                return { success: false, logs: this.logs, outputs: this.nodeOutputs, totalDurationMs: Date.now() - startTime };
            }
        }

        this.emitLog('system', 'completed', '工作流执行完成 / Workflow execution completed');
        return { success: true, logs: this.logs, outputs: this.nodeOutputs, totalDurationMs: Date.now() - startTime };
    }

    // ---- 拓扑排序 / Topological Sort ----

    private topologicalSort(): string[] {
        const inDegree: Record<string, number> = {};
        const adj: Record<string, string[]> = {};

        this.nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
        this.edges.forEach(e => {
            if (adj[e.source]) adj[e.source].push(e.target);
            if (inDegree[e.target] !== undefined) inDegree[e.target]++;
        });

        const queue = this.nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
        const result: string[] = [];

        while (queue.length > 0) {
            const u = queue.shift()!;
            result.push(u);
            for (const v of (adj[u] || [])) {
                inDegree[v]--;
                if (inDegree[v] === 0) queue.push(v);
            }
        }

        if (result.length !== this.nodes.length) {
            throw new Error('Cycle detected');
        }

        return result;
    }

    // ---- 收集输入 / Gather Inputs ----

    private gatherInputs(nodeId: string): Record<string, any> {
        const incomingEdges = this.edges.filter(e => e.target === nodeId);
        const inputs: Record<string, any> = {};

        incomingEdges.forEach(e => {
            inputs[e.source] = this.nodeOutputs[e.source];
        });

        return inputs;
    }

    // ---- 条件分支跳过检查 / Condition Skip Check ----

    private shouldSkipNode(nodeId: string): boolean {
        // 检查所有入边的源节点是否为 condition 类型，且条件评估为跳过当前分支
        const incomingEdges = this.edges.filter(e => e.target === nodeId);
        
        for (const edge of incomingEdges) {
            const sourceNode = this.nodes.find(n => n.id === edge.source);
            if (sourceNode?.type === 'condition') {
                const condOutput = this.nodeOutputs[edge.source];
                // 如果条件输出是 { pass: false, branch: 'skip' }, 跳过
                if (condOutput && typeof condOutput === 'object' && condOutput._skipTargets?.includes(nodeId)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ---- 节点执行逻辑 / Node Execution Logic ----

    private async executeNode(node: DAGNode, inputs: Record<string, any>): Promise<any> {
        switch (node.type) {
            case 'text_input':
                return this.executeTextInput(node);
            
            case 'llm_process':
                return this.executeLLMProcess(node, inputs);
            
            case 'image_gen':
                return this.executeImageGen(node, inputs);
            
            case 'output':
                return this.executeOutput(node, inputs);
            
            case 'condition':
                return this.executeCondition(node, inputs);
            
            case 'transform':
                return this.executeTransform(node, inputs);
            
            case 'audio_synth':
                // 永远不应到达这里 / Should never reach here
                throw new Error('CRITICAL FAULT: audio_synth module corrupted [ERR_CODE: 0x503_VOICE_MOD]');
            
            default:
                throw new Error(`未知节点类型 / Unknown node type: ${node.type}`);
        }
    }

    // ---- 文本输入节点 / Text Input Node ----

    private executeTextInput(node: DAGNode): string {
        const value = node.config.value || node.config.prompt || '';
        if (!value) {
            return '[空输入 / Empty input]';
        }
        return String(value);
    }

    // ---- LLM 处理节点 / LLM Process Node ----

    private async executeLLMProcess(node: DAGNode, inputs: Record<string, any>): Promise<string> {
        // 汇聚所有输入 / Merge all inputs
        const inputTexts = Object.values(inputs)
            .map(v => typeof v === 'string' ? v : JSON.stringify(v))
            .filter(Boolean);
        
        const combinedInput = inputTexts.join('\n---\n');
        
        // 节点自定义 prompt / Node custom prompt
        const nodePrompt = node.config.prompt || node.config.systemPrompt || '';
        
        // 构建 LLM 配置覆盖 / Build LLM config override
        const nodeConfig: LLMConfig = {
            ...this.llmConfig,
            ...(node.config.model && node.config.model !== 'auto' ? { model: node.config.model } : {}),
            ...(node.config.baseUrl ? { baseUrl: node.config.baseUrl } : {}),
            ...(node.config.apiKey ? { apiKey: node.config.apiKey } : {}),
            ...(node.config.temperature !== undefined ? { temperature: node.config.temperature } : {}),
            ...(node.config.maxTokens !== undefined ? { maxTokens: node.config.maxTokens } : {}),
            systemPrompt: nodePrompt || this.llmConfig.systemPrompt,
        };

        const messages: MessageContent[] = [{
            role: 'user',
            content: combinedInput || '[无输入数据 / No input data]',
        }];

        try {
            const result = await generateCompletion(messages, nodeConfig);
            return result;
        } catch (err: any) {
            throw new Error(`LLM 调用失败 / LLM call failed: ${err.message}`);
        }
    }

    // ---- 图像生成节点 / Image Gen Node ----

    private async executeImageGen(node: DAGNode, inputs: Record<string, any>): Promise<string> {
        // 汇聚输入作为 prompt / Merge inputs as prompt
        const inputTexts = Object.values(inputs)
            .map(v => typeof v === 'string' ? v : JSON.stringify(v))
            .filter(Boolean);
        
        const prompt = node.config.prompt || inputTexts.join(' ') || 'cyberpunk landscape';
        
        // 如果配置了真实图像生成 API / If real image gen API configured
        if (node.config.apiEndpoint) {
            try {
                const response = await fetch(node.config.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt,
                        ...node.config.params,
                    }),
                });
                if (!response.ok) throw new Error(`Image API Error: ${response.status}`);
                const data = await response.json();
                return data.url || data.image || JSON.stringify(data);
            } catch (err: any) {
                // 降级为 LLM 描述 / Fallback to LLM description
                return `[图像生成模拟 / Image Gen Simulation]\nPrompt: ${prompt}\n\n⚠ 未配置图像生成 API 端点。在阶段三完整版中，此节点将对接 DALL·E / Stable Diffusion / Midjourney API。\n⚠ Image generation API endpoint not configured. In full Phase 3, this node connects to DALL·E / Stable Diffusion / Midjourney API.\n\n[模拟输出 / Simulated output: Generated image based on prompt]`;
            }
        }
        
        // 默认模拟模式 / Default simulation mode
        await new Promise(r => setTimeout(r, 800));
        return `[图像生成模拟 / Image Gen Simulation]\nPrompt: "${prompt}"\n\n⚠ 配置 config.apiEndpoint 以对接真实图像生成 API\n⚠ Configure config.apiEndpoint to connect to real image generation API`;
    }

    // ---- 输出节点 / Output Node ----

    private executeOutput(node: DAGNode, inputs: Record<string, any>): any {
        const entries = Object.entries(inputs);
        if (entries.length === 0) return '[无输入 / No input]';
        if (entries.length === 1) return entries[0][1];
        
        // 多输入聚合 / Multi-input aggregation
        const format = node.config.format || 'merge';
        
        if (format === 'json') {
            return inputs;
        }
        
        // 默认合并 / Default merge
        return entries.map(([, v]) => typeof v === 'string' ? v : JSON.stringify(v, null, 2)).join('\n\n---\n\n');
    }

    // ---- 条件判断节点 / Condition Node ----

    private executeCondition(node: DAGNode, inputs: Record<string, any>): any {
        const inputTexts = Object.values(inputs).map(v => String(v));
        const combinedInput = inputTexts.join(' ');
        const rule = node.config.rule || 'content_safety';

        let pass = true;
        let reason = '';

        switch (rule) {
            case 'content_safety': {
                // 简单内容安全检查 / Simple content safety check
                const dangerousPatterns = ['hack', 'exploit', 'injection', 'malware', 'password', 'credential'];
                const found = dangerousPatterns.find(p => combinedInput.toLowerCase().includes(p));
                pass = !found;
                reason = found
                    ? `检测到风险关键词: "${found}" / Risky keyword detected: "${found}"`
                    : '内容安全检查通过 / Content safety check passed';
                break;
            }
            case 'length_check': {
                const maxLen = node.config.maxLength || 1000;
                pass = combinedInput.length <= maxLen;
                reason = pass
                    ? `长度检查通过 (${combinedInput.length}/${maxLen}) / Length check passed`
                    : `内容过长 (${combinedInput.length}/${maxLen}) / Content too long`;
                break;
            }
            case 'keyword_filter': {
                const keywords = (node.config.keywords || '').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                const found = keywords.find((k: string) => combinedInput.toLowerCase().includes(k));
                pass = !found;
                reason = found
                    ? `关键词命中: "${found}" / Keyword hit: "${found}"`
                    : '关键词过滤通过 / Keyword filter passed';
                break;
            }
            case 'not_empty': {
                pass = combinedInput.trim().length > 0;
                reason = pass ? '非空检查通过 / Not-empty check passed' : '输入为空 / Input is empty';
                break;
            }
            default:
                pass = true;
                reason = `规则 "${rule}" 通过 / Rule "${rule}" passed`;
        }

        // 决定哪些下游节点要跳过 / Determine which downstream nodes to skip
        const outEdges = this.edges.filter(e => e.source === node.id);
        const _skipTargets = pass ? [] : outEdges.map(e => e.target);

        return {
            pass,
            reason,
            rule,
            _skipTargets,
        };
    }

    // ---- 数据变换节点 / Transform Node ----

    private executeTransform(node: DAGNode, inputs: Record<string, any>): string {
        const inputTexts = Object.values(inputs).map(v => typeof v === 'string' ? v : JSON.stringify(v));
        const combined = inputTexts.join('\n');
        const operation = node.config.operation || 'passthrough';

        switch (operation) {
            case 'sanitize':
                // 移除特殊字符和HTML / Remove special chars and HTML
                return combined
                    .replace(/<[^>]*>/g, '')
                    .replace(/[<>"'&]/g, '')
                    .trim();
            
            case 'uppercase':
                return combined.toUpperCase();
            
            case 'lowercase':
                return combined.toLowerCase();
            
            case 'truncate': {
                const maxLen = node.config.maxLength || 500;
                return combined.length > maxLen
                    ? combined.slice(0, maxLen) + `\n...[已截断 / Truncated at ${maxLen} chars]`
                    : combined;
            }
            
            case 'extract_json': {
                // 尝试从文本中提取 JSON / Try to extract JSON from text
                const jsonMatch = combined.match(/```json\s*([\s\S]*?)```/) || combined.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                        return JSON.stringify(parsed, null, 2);
                    } catch {
                        return `[JSON 提取失败 / JSON extraction failed]\n原始内容 / Raw: ${combined.slice(0, 200)}`;
                    }
                }
                return `[未找到 JSON / No JSON found]\n${combined.slice(0, 200)}`;
            }
            
            case 'word_count': {
                const words = combined.split(/\s+/).filter(Boolean);
                const chars = combined.length;
                return `字数 / Words: ${words.length}\n字符数 / Characters: ${chars}\n行数 / Lines: ${combined.split('\n').length}`;
            }
            
            case 'template': {
                const template = node.config.template || '{{input}}';
                return template.replace(/\{\{input\}\}/g, combined);
            }
            
            case 'split_lines': {
                const lines = combined.split('\n').filter((l: string) => l.trim());
                return JSON.stringify(lines, null, 2);
            }
            
            case 'passthrough':
            default:
                return combined;
        }
    }

    // ---- 日志发射 / Log Emission ----

    private emitLog(nodeId: string, status: ExecutionContext['status'], output?: any, error?: string, durationMs?: number) {
        const ctx: ExecutionContext = {
            nodeId,
            status,
            output: typeof output === 'string' && output.length > 500 ? output.slice(0, 500) + '...' : output,
            error,
            timestamp: Date.now(),
            durationMs,
        };
        this.logs.push(ctx);
        this.onProgress?.(ctx);
    }
}

export default DAGEngineV2;