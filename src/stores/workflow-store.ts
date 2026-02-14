/**
 * YYC3 Workflow Store (Zustand) - V2 阶段三 "引擎点火"
 * 言语云立方 - 工作流 DAG 全局状态管理
 * 
 * 职责：React Flow 节点/边管理、工作流 CRUD、
 *       DAG 真实执行（调用 LLM API）、PG 同步
 * 
 * V2 变更：集成 DAGEngineV2 执行真实 LLM 调用，
 *          节点输出存储在 config._lastOutput
 */

import { create } from 'zustand';
import { workflowsApi, offlineStore, type WorkflowRow, type WorkflowCreate, type WorkflowRunRow } from '@/lib/pg-api';
import { useAuthStore } from './auth-store';
import { useConfigStore } from './config-store';
import { DAGEngineV2, type DAGNode, type ExecutionContext } from '@/utils/dag-engine';
import type { Node, Edge } from '@xyflow/react';

// ============================================================
// 节点类型定义 / Node Type Definitions
// ============================================================

export type CyberNodeType = 'text_input' | 'llm_process' | 'image_gen' | 'audio_synth' | 'output' | 'condition' | 'transform';

export interface CyberNodeData {
    label: string;
    type: CyberNodeType;
    config: Record<string, any>;
    status?: 'idle' | 'running' | 'completed' | 'failed' | 'fault';
    [key: string]: unknown;
}

// ============================================================
// 默认工作流模板 / Default Workflow Templates
// ============================================================

export const WORKFLOW_TEMPLATES: Array<{
    id: string;
    name: string;
    description: string;
    nodes: Node<CyberNodeData>[];
    edges: Edge[];
}> = [
    {
        id: 'template_basic',
        name: '基础对话链 / Basic Chat Chain',
        description: '输入 → LLM → 输出 / Input → LLM → Output',
        nodes: [
            { id: 'n1', type: 'cyber_node', position: { x: 100, y: 200 }, data: { label: '文本输入 / Text Input', type: 'text_input', config: { value: '请用一句话解释量子计算 / Explain quantum computing in one sentence' } } },
            { id: 'n2', type: 'cyber_node', position: { x: 400, y: 200 }, data: { label: 'LLM 处理 / LLM Process', type: 'llm_process', config: { model: 'auto' } } },
            { id: 'n3', type: 'cyber_node', position: { x: 700, y: 200 }, data: { label: '输出节点 / Output', type: 'output', config: {} } },
        ],
        edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', type: 'cyber_edge' },
            { id: 'e2-3', source: 'n2', target: 'n3', type: 'cyber_edge' },
        ],
    },
    {
        id: 'template_multimodal',
        name: '多模态管道 / Multimodal Pipeline',
        description: '文本+图像 → LLM → 图像生成 → 输出',
        nodes: [
            { id: 'n1', type: 'cyber_node', position: { x: 100, y: 150 }, data: { label: '文本输入 / Text Input', type: 'text_input', config: { value: 'A futuristic cyberpunk city at night' } } },
            { id: 'n2', type: 'cyber_node', position: { x: 400, y: 150 }, data: { label: 'LLM 推理 / LLM Reason', type: 'llm_process', config: { model: 'auto', prompt: '将用户输入扩展为详细的图像生成提示词。/ Expand user input into detailed image generation prompt.' } } },
            { id: 'n3', type: 'cyber_node', position: { x: 400, y: 350 }, data: { label: '图像生成 / Image Gen', type: 'image_gen', config: {} } },
            { id: 'n4', type: 'cyber_node', position: { x: 700, y: 250 }, data: { label: '聚合输出 / Merge Output', type: 'output', config: {} } },
        ],
        edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', type: 'cyber_edge' },
            { id: 'e2-3', source: 'n2', target: 'n3', type: 'cyber_edge' },
            { id: 'e2-4', source: 'n2', target: 'n4', type: 'cyber_edge' },
            { id: 'e3-4', source: 'n3', target: 'n4', type: 'cyber_edge' },
        ],
    },
    {
        id: 'template_audit',
        name: '安全审计链 / Security Audit Chain',
        description: '输入 → 清洗 → 安全检查 + LLM审计 → 输出',
        nodes: [
            { id: 'n1', type: 'cyber_node', position: { x: 100, y: 200 }, data: { label: '输入源 / Input Source', type: 'text_input', config: { value: 'Please analyze this security report for any vulnerabilities.' } } },
            { id: 'n2', type: 'cyber_node', position: { x: 350, y: 200 }, data: { label: '数据变换 / Transform', type: 'transform', config: { operation: 'sanitize' } } },
            { id: 'n3', type: 'cyber_node', position: { x: 600, y: 120 }, data: { label: '安全检查 / Security Check', type: 'condition', config: { rule: 'content_safety' } } },
            { id: 'n4', type: 'cyber_node', position: { x: 600, y: 320 }, data: { label: 'LLM 审计 / LLM Audit', type: 'llm_process', config: { model: 'auto', prompt: '你是一个安全审计助手，分析以下内容存在安全风险。/ You are a security audit assistant, analyze the following content for security risks.' } } },
            { id: 'n5', type: 'cyber_node', position: { x: 900, y: 200 }, data: { label: '审计报告 / Report', type: 'output', config: {} } },
        ],
        edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', type: 'cyber_edge' },
            { id: 'e2-3', source: 'n2', target: 'n3', type: 'cyber_edge' },
            { id: 'e2-4', source: 'n2', target: 'n4', type: 'cyber_edge' },
            { id: 'e3-5', source: 'n3', target: 'n5', type: 'cyber_edge' },
            { id: 'e4-5', source: 'n4', target: 'n5', type: 'cyber_edge' },
        ],
    },
    {
        id: 'template_chain_of_thought',
        name: '思维链 / Chain of Thought',
        description: '输入 → 分析LLM → 变换 → 总结LLM → 输出',
        nodes: [
            { id: 'n1', type: 'cyber_node', position: { x: 80, y: 200 }, data: { label: '问题输入 / Question', type: 'text_input', config: { value: '为什么天空是蓝色的？/ Why is the sky blue?' } } },
            { id: 'n2', type: 'cyber_node', position: { x: 320, y: 200 }, data: { label: '分析推理 / Analyze', type: 'llm_process', config: { model: 'auto', prompt: '请对以下问题进行详细的科学分析，列出关键原理。/ Analyze the following question scientifically, list key principles.' } } },
            { id: 'n3', type: 'cyber_node', position: { x: 560, y: 200 }, data: { label: '精炼 / Refine', type: 'transform', config: { operation: 'template', template: '基于以下分析，请总结核心要点：\n\n{{input}}\n\nBased on the analysis above, summarize the key points:' } } },
            { id: 'n4', type: 'cyber_node', position: { x: 800, y: 200 }, data: { label: '总结输出 / Summarize', type: 'llm_process', config: { model: 'auto', prompt: '请用简洁明了的语言总结，适合非专业读者。/ Summarize in clear language suitable for non-expert readers.', temperature: 0.3 } } },
            { id: 'n5', type: 'cyber_node', position: { x: 1040, y: 200 }, data: { label: '最终输出 / Final', type: 'output', config: {} } },
        ],
        edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', type: 'cyber_edge' },
            { id: 'e2-3', source: 'n2', target: 'n3', type: 'cyber_edge' },
            { id: 'e3-4', source: 'n3', target: 'n4', type: 'cyber_edge' },
            { id: 'e4-5', source: 'n4', target: 'n5', type: 'cyber_edge' },
        ],
    },
];

// ============================================================
// Store 定义 / Store Definition
// ============================================================

interface WorkflowState {
    // 工作流列表 / Workflow list
    workflows: WorkflowRow[];
    activeWorkflowId: string | null;
    isLoading: boolean;
    isSynced: boolean;

    // React Flow 画布状态 / Canvas state
    nodes: Node<CyberNodeData>[];
    edges: Edge[];
    selectedNodeId: string | null;

    // 执行状态 / Execution state
    executionStatus: 'idle' | 'running' | 'completed' | 'failed';
    executionLogs: Array<{ nodeId: string; status: string; message?: string; output?: any; timestamp: number; durationMs?: number }>;
    executionOutputs: Record<string, any>;
    currentEngineRef: DAGEngineV2 | null;

    // 操作 / Actions
    loadWorkflows: () => Promise<void>;
    createWorkflow: (name: string, description?: string) => Promise<string | null>;
    saveWorkflow: (id: string) => Promise<boolean>;
    deleteWorkflow: (id: string) => Promise<boolean>;
    selectWorkflow: (id: string | null) => void;

    // React Flow 操作 / React Flow actions
    setNodes: (nodes: Node<CyberNodeData>[] | ((prev: Node<CyberNodeData>[]) => Node<CyberNodeData>[])) => void;
    setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
    addNode: (type: CyberNodeType, position: { x: number; y: number }) => void;
    removeNode: (nodeId: string) => void;
    selectNode: (nodeId: string | null) => void;
    updateNodeData: (nodeId: string, data: Partial<CyberNodeData>) => void;
    loadTemplate: (templateId: string) => void;

    // 执行 / Execution
    executeWorkflow: () => Promise<void>;
    abortExecution: () => void;
    resetExecution: () => void;
}

const NODE_LABELS: Record<CyberNodeType, string> = {
    text_input: '文本输入 / Text Input',
    llm_process: 'LLM 处理 / LLM Process',
    image_gen: '图像生成 / Image Gen',
    audio_synth: '语音合成 / Voice Synth',
    output: '输出节点 / Output',
    condition: '条件判断 / Condition',
    transform: '数据变换 / Transform',
};

let nodeCounter = 100;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
    workflows: [],
    activeWorkflowId: null,
    isLoading: false,
    isSynced: false,

    nodes: [],
    edges: [],
    selectedNodeId: null,

    executionStatus: 'idle',
    executionLogs: [],
    executionOutputs: {},
    currentEngineRef: null,

    // ---- 工作流 CRUD / Workflow CRUD ----

    loadWorkflows: async () => {
        set({ isLoading: true });

        // 先加载离线缓存 / Load offline cache first
        const cached = offlineStore.getWorkflows();
        if (cached.length > 0) {
            set({ workflows: cached });
        }

        // 尝试从 PG 拉取 / Try PG
        const { connectionStatus } = useAuthStore.getState();
        if (connectionStatus === 'online') {
            const res = await workflowsApi.list();
            if (res.success && res.data) {
                offlineStore.saveWorkflows(res.data);
                set({ workflows: res.data, isSynced: true });
            }
        }

        set({ isLoading: false });
    },

    createWorkflow: async (name, description) => {
        const { nodes, edges } = get();
        const data: WorkflowCreate = {
            name,
            description,
            definition: { nodes, edges },
        };

        const res = await workflowsApi.create(data);
        if (res.success && res.data) {
            set(state => ({
                workflows: [res.data!, ...state.workflows],
                activeWorkflowId: res.data!.id,
            }));
            return res.data.id;
        }

        // 离线模式 / Offline
        const tempId = 'local_' + Date.now();
        const tempRow: WorkflowRow = {
            id: tempId,
            user_id: 'local',
            name,
            description: description || null,
            definition: { nodes, edges },
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        set(state => ({
            workflows: [tempRow, ...state.workflows],
            activeWorkflowId: tempId,
        }));
        return tempId;
    },

    saveWorkflow: async (id) => {
        const { nodes, edges } = get();
        const workflow = get().workflows.find(w => w.id === id);
        if (!workflow) return false;

        const res = await workflowsApi.update(id, {
            definition: { nodes, edges },
        });

        if (res.success && res.data) {
            set(state => ({
                workflows: state.workflows.map(w => w.id === id ? res.data! : w),
            }));
            return true;
        }

        // 离线更新 / Offline update
        set(state => ({
            workflows: state.workflows.map(w =>
                w.id === id ? { ...w, definition: { nodes, edges }, updated_at: new Date().toISOString() } : w
            ),
        }));
        return true;
    },

    deleteWorkflow: async (id) => {
        const res = await workflowsApi.delete(id);
        set(state => ({
            workflows: state.workflows.filter(w => w.id !== id),
            activeWorkflowId: state.activeWorkflowId === id ? null : state.activeWorkflowId,
            nodes: state.activeWorkflowId === id ? [] : state.nodes,
            edges: state.activeWorkflowId === id ? [] : state.edges,
        }));
        return res.success || true;
    },

    selectWorkflow: (id) => {
        if (!id) {
            set({ activeWorkflowId: null, nodes: [], edges: [], selectedNodeId: null });
            return;
        }
        const workflow = get().workflows.find(w => w.id === id);
        if (workflow && workflow.definition) {
            const def = workflow.definition as any;
            set({
                activeWorkflowId: id,
                nodes: def.nodes || [],
                edges: def.edges || [],
                selectedNodeId: null,
                executionStatus: 'idle',
                executionLogs: [],
                executionOutputs: {},
            });
        } else {
            set({ activeWorkflowId: id, nodes: [], edges: [], selectedNodeId: null });
        }
    },

    // ---- React Flow 操作 / Canvas operations ----

    setNodes: (nodesOrUpdater) => {
        if (typeof nodesOrUpdater === 'function') {
            set(state => ({ nodes: nodesOrUpdater(state.nodes) }));
        } else {
            set({ nodes: nodesOrUpdater });
        }
    },

    setEdges: (edgesOrUpdater) => {
        if (typeof edgesOrUpdater === 'function') {
            set(state => ({ edges: edgesOrUpdater(state.edges) }));
        } else {
            set({ edges: edgesOrUpdater });
        }
    },

    addNode: (type, position) => {
        const id = `node_${++nodeCounter}_${Date.now()}`;
        const newNode: Node<CyberNodeData> = {
            id,
            type: 'cyber_node',
            position,
            data: {
                label: NODE_LABELS[type] || type,
                type,
                config: type === 'text_input' ? { value: '' }
                    : type === 'llm_process' ? { model: 'auto' }
                    : type === 'transform' ? { operation: 'passthrough' }
                    : type === 'condition' ? { rule: 'content_safety' }
                    : {},
                status: type === 'audio_synth' ? 'fault' : 'idle',
            },
        };
        set(state => ({ nodes: [...state.nodes, newNode] }));
    },

    removeNode: (nodeId) => {
        set(state => ({
            nodes: state.nodes.filter(n => n.id !== nodeId),
            edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        }));
    },

    selectNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
    },

    updateNodeData: (nodeId, data) => {
        set(state => ({
            nodes: state.nodes.map(n =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ),
        }));
    },

    loadTemplate: (templateId) => {
        const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            set({
                nodes: template.nodes.map(n => ({ ...n })),
                edges: template.edges.map(e => ({ ...e })),
                selectedNodeId: null,
                executionStatus: 'idle',
                executionLogs: [],
                executionOutputs: {},
            });
        }
    },

    // ---- 执行 V2 / Execution V2 ----

    executeWorkflow: async () => {
        const { nodes, edges, activeWorkflowId } = get();
        if (nodes.length === 0) return;

        set({ executionStatus: 'running', executionLogs: [], executionOutputs: {}, currentEngineRef: null });

        // 重置所有节点状态 / Reset all node statuses
        set(state => ({
            nodes: state.nodes.map(n => ({
                ...n,
                data: {
                    ...n.data,
                    status: n.data.type === 'audio_synth' ? 'fault' as const : 'idle' as const,
                    config: { ...n.data.config, _lastOutput: undefined, _lastDuration: undefined },
                },
            })),
        }));

        // PG 持久化：创建 Run 记录 / Create PG run record
        let pgRunId: string | null = null;
        const { connectionStatus } = useAuthStore.getState();
        if (connectionStatus === 'online' && activeWorkflowId && !activeWorkflowId.startsWith('local_')) {
            try {
                const runRes = await workflowsApi.createRun(activeWorkflowId);
                if (runRes.success && runRes.data) {
                    pgRunId = runRes.data.id;
                }
            } catch { /* PG 不影响执行 / PG doesn't block execution */ }
        }

        // 构建 DAG 节点 / Build DAG nodes
        const dagNodes: DAGNode[] = nodes.map(n => ({
            id: n.id,
            type: n.data.type,
            label: n.data.label,
            config: { ...n.data.config },
        }));

        const dagEdges = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
        }));

        // 获取当前 LLM 配置 / Get current LLM config
        const llmConfig = useConfigStore.getState().getActiveAsLLMConfig();

        // 批量日志缓冲 / Batch log buffer for PG persistence
        let logBuffer: any[] = [];
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const flushLogs = async () => {
            if (logBuffer.length === 0 || !pgRunId || !activeWorkflowId) return;
            const entries = [...logBuffer];
            logBuffer = [];
            try {
                await workflowsApi.appendRunLogs(activeWorkflowId, pgRunId, entries);
            } catch { /* best-effort */ }
        };

        // 进度回调 / Progress callback
        const onProgress = (ctx: ExecutionContext) => {
            // 更新执行日志 / Update execution logs
            const logEntry = {
                nodeId: ctx.nodeId,
                status: ctx.status,
                message: ctx.error || (typeof ctx.output === 'string' ? ctx.output.slice(0, 200) : ctx.output ? JSON.stringify(ctx.output).slice(0, 200) : undefined),
                output: ctx.output,
                timestamp: ctx.timestamp,
                durationMs: ctx.durationMs,
            };

            set(state => ({
                executionLogs: [...state.executionLogs, logEntry],
            }));

            // PG 日志缓冲（每 500ms 批量发送）/ Buffer logs for PG (batch every 500ms)
            if (pgRunId) {
                logBuffer.push({
                    node_id: ctx.nodeId,
                    status: ctx.status,
                    message: logEntry.message?.slice(0, 500),
                    timestamp: ctx.timestamp,
                    duration_ms: ctx.durationMs,
                });
                if (flushTimer) clearTimeout(flushTimer);
                flushTimer = setTimeout(flushLogs, 500);
            }

            // 更新节点视觉状态 / Update node visual status
            if (ctx.nodeId !== 'system') {
                const statusMap: Record<string, CyberNodeData['status']> = {
                    'running': 'running',
                    'completed': 'completed',
                    'failed': 'failed',
                    'skipped': 'idle',
                };
                set(state => ({
                    nodes: state.nodes.map(n =>
                        n.id === ctx.nodeId ? {
                            ...n,
                            data: {
                                ...n.data,
                                status: statusMap[ctx.status] || n.data.status,
                                config: {
                                    ...n.data.config,
                                    ...(ctx.status === 'completed' ? { _lastOutput: ctx.output, _lastDuration: ctx.durationMs } : {}),
                                    ...(ctx.status === 'failed' ? { _lastOutput: ctx.error, _lastDuration: ctx.durationMs } : {}),
                                },
                            },
                        } : n
                    ),
                }));
            }
        };

        // 创建引擎 / Create engine
        const engine = new DAGEngineV2(dagNodes, dagEdges, llmConfig, onProgress);
        set({ currentEngineRef: engine });

        // 执行 / Execute
        const result = await engine.execute();

        // 最后刷新日志 / Final flush
        if (flushTimer) clearTimeout(flushTimer);
        await flushLogs();

        const finalStatus = result.success ? 'completed' : 'failed';

        set({
            executionStatus: finalStatus,
            executionOutputs: result.outputs,
            currentEngineRef: null,
        });

        // PG 持久化：更新 Run 最终状态 / Update PG run final status
        if (pgRunId && activeWorkflowId && !activeWorkflowId.startsWith('local_')) {
            try {
                await workflowsApi.updateRun(activeWorkflowId, pgRunId, {
                    status: finalStatus,
                    duration_ms: result.totalDurationMs,
                    logs: get().executionLogs.map(l => ({
                        node_id: l.nodeId,
                        status: l.status,
                        message: l.message?.slice(0, 500),
                        timestamp: l.timestamp,
                        duration_ms: l.durationMs,
                    })),
                });
            } catch { /* best-effort */ }
        }
    },

    abortExecution: () => {
        const engine = get().currentEngineRef;
        if (engine) {
            engine.abort();
        }
        set({
            executionStatus: 'failed',
            currentEngineRef: null,
        });
    },

    resetExecution: () => {
        // 中止正在进行的执行 / Abort any ongoing execution
        const engine = get().currentEngineRef;
        if (engine) engine.abort();

        set(state => ({
            executionStatus: 'idle',
            executionLogs: [],
            executionOutputs: {},
            currentEngineRef: null,
            nodes: state.nodes.map(n => ({
                ...n,
                data: {
                    ...n.data,
                    status: n.data.type === 'audio_synth' ? 'fault' as const : 'idle' as const,
                    config: { ...n.data.config, _lastOutput: undefined, _lastDuration: undefined },
                },
            })),
        }));
    },
}));