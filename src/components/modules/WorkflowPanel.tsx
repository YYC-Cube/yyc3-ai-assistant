/**
 * WorkflowPanel - 阶段二+三 "工作流突触 → 引擎点火" DAG 编排器
 * Phase 2+3 "Workflow Synapse → Engine Ignition" - Visual DAG Orchestrator
 * 
 * 基于 React Flow 的可视化 DAG 编排界面
 * 赛博朋克暗夜玻璃态设计，支持拖放、执行、保存
 * audio_synth 节点硬编码故障状态
 * 阶段三：LLM 节点调用真实 API
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    Connection,
    ReactFlowProvider,
    useReactFlow,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    GitBranch, Play, Pause, X, Plus, Save, Trash2,
    RotateCcw, ChevronRight, ChevronLeft,
    FileText, Layers, FolderOpen, StopCircle,
    ScanEye, Zap, History
} from 'lucide-react';
import { GestureContainer } from '@/components/ui/GestureContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { nodeTypes, CYBER_EDGE_STYLE } from '@/components/workflow/CyberNodes';
import { NodePalette } from '@/components/workflow/NodePalette';
import { ExecutionLog } from '@/components/workflow/ExecutionLog';
import { NodeInspector } from '@/components/workflow/NodeInspector';
import { ApiStatusBadge } from '@/components/workflow/ApiStatusBadge';
import { RunHistory } from '@/components/workflow/RunHistory';
import { useWorkflowStore, WORKFLOW_TEMPLATES, type CyberNodeType, type CyberNodeData } from '@/stores/workflow-store';
import bgImage from "figma:asset/70d40eb9c421e3d0e166efde6c7aa221f28e3612.png";

interface WorkflowPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onShowSwitcher?: () => void;
}

// ============================================================
// 内部画布组件 / Inner Canvas Component
// 使用 Zustand 作为唯一状态源，通过 applyNodeChanges/applyEdgeChanges 处理 RF 变更
// ============================================================

function DAGCanvas() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const {
        nodes, edges, setNodes, setEdges,
        addNode, removeNode, selectNode, selectedNodeId,
        saveWorkflow,
        executionStatus, executeWorkflow, resetExecution,
        loadTemplate,
        workflows, activeWorkflowId: currentId,
        selectWorkflow, createWorkflow, deleteWorkflow,
        loadWorkflows,
    } = useWorkflowStore();

    const [showSidebar, setShowSidebar] = useState(true);
    const [showLog, setShowLog] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showNewDialog, setShowNewDialog] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [showInspector, setShowInspector] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    // 加载工作流列表 / Load workflow list on mount
    useEffect(() => {
        loadWorkflows();
    }, []);

    // React Flow 变更回调 → 直接更新 Zustand / RF changes → update Zustand directly
    const onNodesChange = useCallback((changes: NodeChange[]) => {
        setNodes((nds: Node<CyberNodeData>[]) => applyNodeChanges(changes, nds) as Node<CyberNodeData>[]);
    }, [setNodes]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        setEdges((eds: Edge[]) => applyEdgeChanges(changes, eds));
    }, [setEdges]);

    // 连接处理 / Connection handler
    const onConnect = useCallback((params: Connection) => {
        setEdges((eds: Edge[]) => addEdge({
            ...params,
            type: 'smoothstep',
            style: CYBER_EDGE_STYLE,
            animated: false,
        }, eds));
    }, [setEdges]);

    // 拖放处理 / Drop handler
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/yyc3-node-type') as CyberNodeType;
        if (!type) return;

        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        addNode(type, position);
    }, [screenToFlowPosition, addNode]);

    // 节点选择 / Node selection
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        selectNode(node.id);
    }, [selectNode]);

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    // 保存 / Save
    const handleSave = useCallback(async () => {
        if (currentId) {
            await saveWorkflow(currentId);
            toast.success('工作流已保存 / Workflow Saved', {
                description: `ID: ${currentId.substring(0, 8)}`,
                icon: <Save className="w-4 h-4 text-emerald-400" />,
            });
        } else {
            setShowNewDialog(true);
        }
    }, [currentId, saveWorkflow]);

    // 新建 / Create new
    const handleCreate = useCallback(async () => {
        if (!newWorkflowName.trim()) return;
        const id = await createWorkflow(newWorkflowName.trim());
        if (id) {
            toast.success('工作流已创建 / Workflow Created', {
                icon: <Plus className="w-4 h-4 text-pink-400" />,
            });
            setShowNewDialog(false);
            setNewWorkflowName('');
        }
    }, [newWorkflowName, createWorkflow]);

    // 执行 / Execute
    const handleExecute = useCallback(async () => {
        if (executionStatus === 'running') return;
        if (nodes.length === 0) {
            toast.error('空画布 / Empty Canvas', { description: '请先添加节点 / Add nodes first' });
            return;
        }
        setShowLog(true);
        setShowHistory(false);
        resetExecution();
        
        toast('引擎启动 / Engine Ignition', {
            description: `${nodes.length} 个节点排队执行 / ${nodes.length} nodes queued for execution`,
            icon: <Zap className="w-4 h-4 text-pink-400" />,
        });
        
        await executeWorkflow();
        
        const status = useWorkflowStore.getState().executionStatus;
        if (status === 'completed') {
            toast.success('执行完成 / Execution Complete', {
                icon: <Play className="w-4 h-4 text-emerald-400" />,
            });
        } else if (status === 'failed') {
            toast.error('执行失败 / Execution Failed', {
                description: '查看日志获取详情 / Check logs for details',
            });
        }
    }, [executionStatus, nodes, executeWorkflow, resetExecution]);

    // 点击添加节点到画布中心 / Add node to center on click
    const handleAddNodeFromPalette = useCallback((type: CyberNodeType) => {
        const centerX = 300 + Math.random() * 200;
        const centerY = 200 + Math.random() * 100;
        addNode(type, { x: centerX, y: centerY });
    }, [addNode]);

    // 删除选中节点 / Delete selected
    const handleDeleteSelected = useCallback(() => {
        if (selectedNodeId) {
            removeNode(selectedNodeId);
            toast('节点已移除 / Node Removed', {
                icon: <Trash2 className="w-4 h-4 text-red-400" />,
            });
        }
    }, [selectedNodeId, removeNode]);

    // 边的默认样式 / Edge defaults
    const defaultEdgeOptions = {
        style: CYBER_EDGE_STYLE,
        type: 'smoothstep',
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* ====== 左侧边栏 / Left Sidebar ====== */}
            <AnimatePresence>
                {showSidebar && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="border-r border-white/5 bg-black/30 flex flex-col overflow-hidden shrink-0"
                    >
                        {/* 工作流列表 / Workflow list */}
                        <div className="p-3 border-b border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <FolderOpen className="w-3 h-3" />
                                    工作流 / Workflows
                                </span>
                                <button
                                    onClick={() => setShowNewDialog(true)}
                                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                {workflows.length === 0 ? (
                                    <div className="text-[9px] font-mono text-gray-600 py-2 text-center">
                                        暂无工作流 / No workflows
                                    </div>
                                ) : (
                                    workflows.map(wf => (
                                        <button
                                            key={wf.id}
                                            onClick={() => selectWorkflow(wf.id)}
                                            className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono transition-all flex items-center justify-between ${
                                                currentId === wf.id
                                                    ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                                            }`}
                                        >
                                            <span className="truncate">{wf.name}</span>
                                            {currentId === wf.id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteWorkflow(wf.id); }}
                                                    className="p-0.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 模板 / Templates */}
                        <div className="p-3 border-b border-white/5">
                            <button
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="flex items-center justify-between w-full text-[10px] font-mono text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" />
                                    模板 / Templates
                                </span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${showTemplates ? 'rotate-90' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {showTemplates && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-2 space-y-1 overflow-hidden"
                                    >
                                        {WORKFLOW_TEMPLATES.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => {
                                                    loadTemplate(t.id);
                                                    toast.success(`模板已加载 / Template Loaded: ${t.name}`);
                                                }}
                                                className="w-full text-left px-2 py-2 rounded bg-white/[0.02] border border-white/5 hover:border-pink-500/30 hover:bg-pink-500/5 transition-all"
                                            >
                                                <div className="text-[10px] font-mono text-gray-300">{t.name}</div>
                                                <div className="text-[8px] font-mono text-gray-600 mt-0.5">{t.description}</div>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* 节点面板 / Node palette */}
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                            <NodePalette onAddNode={handleAddNodeFromPalette} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ====== 中央画布 / Central Canvas ====== */}
            <div className="flex-1 flex flex-col relative" ref={reactFlowWrapper}>
                {/* 画布工具栏 / Canvas Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#050a10]/50 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                            title="Toggle sidebar"
                        >
                            {showSidebar ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        <div className="h-4 w-px bg-white/10" />

                        <button
                            onClick={handleSave}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-mono transition-colors border border-white/5"
                        >
                            <Save className="w-3 h-3" /> 保存 / Save
                        </button>

                        <button
                            onClick={handleDeleteSelected}
                            disabled={!selectedNodeId}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 text-[10px] font-mono transition-colors border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-3 h-3" /> 删除 / Del
                        </button>

                        <button
                            onClick={resetExecution}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-mono transition-colors border border-white/5"
                        >
                            <RotateCcw className="w-3 h-3" /> 重置 / Reset
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowLog(!showLog)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-colors border ${
                                showLog ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' : 'bg-white/5 text-gray-400 hover:text-white border-white/5'
                            }`}
                        >
                            <Layers className="w-3 h-3" /> 日志 / Log
                        </button>

                        <button
                            onClick={() => { setShowHistory(!showHistory); if (!showHistory) setShowLog(false); }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-colors border ${
                                showHistory ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-white/5 text-gray-400 hover:text-white border-white/5'
                            }`}
                        >
                            <History className="w-3 h-3" /> 历史 / Runs
                        </button>

                        <button
                            onClick={handleExecute}
                            disabled={executionStatus === 'running' || nodes.length === 0}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-[10px] font-mono tracking-widest transition-all border ${
                                executionStatus === 'running'
                                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse'
                                    : 'bg-pink-600/80 hover:bg-pink-500/80 text-white border-pink-400/30 shadow-[0_0_15px_rgba(236,72,153,0.2)] hover:shadow-[0_0_25px_rgba(236,72,153,0.4)]'
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                        >
                            {executionStatus === 'running' ? (
                                <><Pause className="w-3.5 h-3.5" /> 执行中 / RUNNING</>
                            ) : (
                                <><Play className="w-3.5 h-3.5 fill-current" /> 执行 / EXECUTE</>
                            )}
                        </button>
                    </div>
                </div>

                {/* React Flow 画布 / Canvas */}
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        defaultEdgeOptions={defaultEdgeOptions}
                        fitView
                        snapToGrid
                        snapGrid={[20, 20]}
                        minZoom={0.3}
                        maxZoom={2}
                        proOptions={{ hideAttribution: true }}
                        className="!bg-transparent"
                        style={{ backgroundColor: 'transparent' }}
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={20}
                            size={1}
                            color="rgba(236, 72, 153, 0.08)"
                        />
                        <Controls
                            showInteractive={false}
                            className="!bg-[#050a10]/80 !border-white/10 !rounded-lg !shadow-none [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-gray-400 [&>button:hover]:!bg-white/10 [&>button:hover]:!text-white [&>button>svg]:!fill-current"
                        />
                        <MiniMap
                            nodeColor={(node) => {
                                const data = node.data as CyberNodeData;
                                if (data.type === 'audio_synth') return '#ef4444';
                                if (data.type === 'llm_process') return '#a855f7';
                                if (data.type === 'image_gen') return '#34d399';
                                if (data.type === 'output') return '#f59e0b';
                                if (data.type === 'condition') return '#ec4899';
                                return '#22d3ee';
                            }}
                            maskColor="rgba(5,10,16,0.85)"
                            className="!bg-[#050a10]/80 !border-white/10 !rounded-lg"
                            style={{ height: 80, width: 120 }}
                        />
                    </ReactFlow>

                    {/* 空画布提示 / Empty canvas hint */}
                    {nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="text-center space-y-3">
                                <GitBranch className="w-16 h-16 text-pink-500/10 mx-auto" />
                                <div className="text-gray-600 font-mono text-sm">
                                    拖放节点到此处构建工作流<br />
                                    <span className="text-gray-700 text-[10px]">
                                        Drag & drop nodes here to build your workflow
                                    </span>
                                </div>
                                <div className="text-[9px] font-mono text-gray-700">
                                    或选择一个模板快速开始 / Or select a template to quick start
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ====== 右侧日志面板 / Right Log Panel ====== */}
            <AnimatePresence>
                {showLog && !showHistory && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 240, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="border-l border-white/5 bg-black/30 overflow-hidden shrink-0"
                    >
                        <ExecutionLog />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ====== 右侧执行历史面板 / Right Run History Panel ====== */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="border-l border-white/5 bg-black/30 overflow-hidden shrink-0"
                    >
                        <RunHistory workflowId={currentId} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ====== 节点检查器面板 / Node Inspector Panel ====== */}
            <AnimatePresence>
                {selectedNodeId && showInspector && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="border-l border-white/5 bg-black/30 overflow-hidden shrink-0"
                    >
                        <NodeInspector onClose={() => selectNode(null)} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ====== 新建对话框 / New Workflow Dialog ====== */}
            <AnimatePresence>
                {showNewDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowNewDialog(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#050a10]/90 border border-pink-500/30 rounded-xl p-6 w-80 shadow-[0_0_40px_rgba(236,72,153,0.15)]"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-sm font-mono text-white mb-1">新建工作流 / New Workflow</h3>
                            <p className="text-[9px] font-mono text-gray-500 mb-4">创建一个新的 DAG 编排 / Create a new DAG orchestration</p>
                            <Input
                                value={newWorkflowName}
                                onChange={e => setNewWorkflowName(e.target.value)}
                                placeholder="输入名称... / Enter name..."
                                className="bg-black/40 border-white/10 text-cyan-100 font-mono text-xs h-9 mb-4"
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowNewDialog(false)}
                                    variant="ghost"
                                    className="flex-1 h-8 text-xs font-mono text-gray-400 border border-white/10"
                                >
                                    取消 / Cancel
                                </Button>
                                <Button
                                    onClick={handleCreate}
                                    disabled={!newWorkflowName.trim()}
                                    className="flex-1 h-8 text-xs font-mono bg-pink-600 hover:bg-pink-500 text-white"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> 创建 / Create
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================
// 外部容器 / Outer Container (with ReactFlowProvider)
// ============================================================

export function WorkflowPanel({ isOpen, onClose, onShowSwitcher }: WorkflowPanelProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                >
                    {/* Background Layer */}
                    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                        <img src={bgImage} alt="Background" className="w-full h-full object-cover grayscale mix-blend-overlay" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050a10] via-transparent to-transparent" />
                    </div>

                    <GestureContainer
                        onClose={onClose}
                        onMenu={() => onShowSwitcher && onShowSwitcher()}
                        className="relative z-10 w-full h-full md:max-w-[95vw] md:h-[92vh] flex items-center justify-center p-2 md:p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="w-full h-full bg-[#050a10]/70 border border-pink-500/30 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(236,72,153,0.15)] flex flex-col pointer-events-auto relative"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center px-5 py-3 border-b border-pink-500/20 bg-gradient-to-r from-pink-950/30 to-transparent shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                                        <GitBranch className="w-5 h-5 text-pink-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-mono tracking-widest text-white uppercase">
                                            工作流突触 / WORKFLOW_SYNAPSE
                                        </h2>
                                        <div className="text-[9px] font-mono text-pink-500/60 tracking-[0.2em] mt-0.5 uppercase">
                                            Phase 2+3 // DAG Orchestrator + Engine Ignition
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="hidden md:block">
                                        <ApiStatusBadge />
                                    </div>
                                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content - React Flow Canvas */}
                            <ReactFlowProvider>
                                <DAGCanvas />
                            </ReactFlowProvider>
                        </motion.div>
                    </GestureContainer>
                </motion.div>
            )}
        </AnimatePresence>
    );
}