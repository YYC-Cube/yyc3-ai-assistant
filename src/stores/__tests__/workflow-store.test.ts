/**
 * YYC3 Workflow Store — Full Test Suite
 * 言语云立方 - 工作流 Store 全量测试
 *
 * Coverage:
 * - Template loading
 * - Node CRUD (add, remove, update, select)
 * - Edge management
 * - Workflow CRUD (create, save, delete, select)
 * - Execution lifecycle (idle → running → completed/failed)
 * - audio_synth fault propagation
 * - Reset & abort
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock dependencies
// ============================================================

const mockWorkflowsList = vi.fn().mockResolvedValue({ success: false, offline: true });
const mockWorkflowsCreate = vi.fn().mockResolvedValue({ success: false, offline: true });
const mockWorkflowsUpdate = vi.fn().mockResolvedValue({ success: false, offline: true });
const mockWorkflowsDelete = vi.fn().mockResolvedValue({ success: false, offline: true });
const mockWorkflowsCreateRun = vi.fn().mockResolvedValue({ success: false });
const mockWorkflowsUpdateRun = vi.fn().mockResolvedValue({ success: false });
const mockWorkflowsAppendRunLogs = vi.fn().mockResolvedValue({ success: false });

vi.mock('@/lib/pg-api', () => ({
  workflowsApi: {
    list: () => mockWorkflowsList(),
    create: (...args: any[]) => mockWorkflowsCreate(...args),
    update: (...args: any[]) => mockWorkflowsUpdate(...args),
    delete: (...args: any[]) => mockWorkflowsDelete(...args),
    createRun: (...args: any[]) => mockWorkflowsCreateRun(...args),
    updateRun: (...args: any[]) => mockWorkflowsUpdateRun(...args),
    appendRunLogs: (...args: any[]) => mockWorkflowsAppendRunLogs(...args),
  },
  offlineStore: {
    getWorkflows: vi.fn().mockReturnValue([]),
    saveWorkflows: vi.fn(),
  },
}));

vi.mock('./auth-store', () => ({
  useAuthStore: {
    getState: () => ({ connectionStatus: 'offline' }),
  },
}));

vi.mock('./config-store', () => ({
  useConfigStore: {
    getState: () => ({
      getActiveAsLLMConfig: () => ({
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        model: 'llama3',
        ttsProvider: 'browser',
        ttsModel: 'tts-1',
        ttsVoice: 'alloy',
        ttsSpeed: 1.0,
      }),
    }),
  },
}));

vi.mock('@/utils/dag-engine', () => {
  return {
    DAGEngineV2: vi.fn().mockImplementation((nodes: any[], edges: any[], config: any, cb: any) => ({
      validate: () => {
        const hasAudio = nodes.some((n: any) => n.type === 'audio_synth');
        if (hasAudio) return { valid: false, error: 'CRITICAL FAULT: audio_synth 0x503_VOICE_MOD' };
        if (nodes.length === 0) return { valid: false, error: 'DAG is empty' };
        return { valid: true };
      },
      execute: async () => {
        const hasAudio = nodes.some((n: any) => n.type === 'audio_synth');
        if (hasAudio) {
          cb?.({ nodeId: 'system', status: 'failed', error: '0x503_VOICE_MOD', timestamp: Date.now() });
          return { success: false, logs: [], outputs: {}, totalDurationMs: 1 };
        }
        // Simulate execution
        for (const node of nodes) {
          cb?.({ nodeId: node.id, status: 'running', timestamp: Date.now() });
          cb?.({ nodeId: node.id, status: 'completed', output: `output_${node.id}`, timestamp: Date.now(), durationMs: 10 });
        }
        cb?.({ nodeId: 'system', status: 'completed', output: 'done', timestamp: Date.now() });
        const outputs: Record<string, any> = {};
        nodes.forEach((n: any) => { outputs[n.id] = `output_${n.id}`; });
        return { success: true, logs: [], outputs, totalDurationMs: 50 };
      },
      abort: vi.fn(),
    })),
  };
});

import { useWorkflowStore, WORKFLOW_TEMPLATES, type CyberNodeData } from '../workflow-store';

beforeEach(() => {
  useWorkflowStore.setState({
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
  });
  vi.clearAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('WORKFLOW_TEMPLATES', () => {
  it('should have 4 templates', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(4);
  });

  it('each template should have id, name, description, nodes, edges', () => {
    WORKFLOW_TEMPLATES.forEach(t => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(Array.isArray(t.nodes)).toBe(true);
      expect(Array.isArray(t.edges)).toBe(true);
      expect(t.nodes.length).toBeGreaterThan(0);
    });
  });

  it('should have unique template IDs', () => {
    const ids = WORKFLOW_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('template_basic should be Input→LLM→Output (3 nodes, 2 edges)', () => {
    const basic = WORKFLOW_TEMPLATES.find(t => t.id === 'template_basic')!;
    expect(basic.nodes).toHaveLength(3);
    expect(basic.edges).toHaveLength(2);
    expect(basic.nodes[0].data.type).toBe('text_input');
    expect(basic.nodes[1].data.type).toBe('llm_process');
    expect(basic.nodes[2].data.type).toBe('output');
  });

  it('no template should contain audio_synth nodes', () => {
    WORKFLOW_TEMPLATES.forEach(t => {
      t.nodes.forEach(n => {
        expect(n.data.type).not.toBe('audio_synth');
      });
    });
  });
});

describe('loadTemplate() / 加载模板', () => {
  it('should populate nodes and edges from template', () => {
    useWorkflowStore.getState().loadTemplate('template_basic');

    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(3);
    expect(state.edges).toHaveLength(2);
    expect(state.executionStatus).toBe('idle');
    expect(state.executionLogs).toEqual([]);
  });

  it('should do nothing for invalid template ID', () => {
    useWorkflowStore.getState().loadTemplate('nonexistent');
    expect(useWorkflowStore.getState().nodes).toEqual([]);
  });

  it('should reset execution state when loading template', () => {
    useWorkflowStore.setState({ executionStatus: 'completed', executionLogs: [{ nodeId: 'x', status: 'ok', timestamp: 1 }] });
    useWorkflowStore.getState().loadTemplate('template_basic');
    expect(useWorkflowStore.getState().executionStatus).toBe('idle');
    expect(useWorkflowStore.getState().executionLogs).toEqual([]);
  });
});

describe('Node CRUD / 节点操作', () => {
  describe('addNode()', () => {
    it('should add a text_input node', () => {
      useWorkflowStore.getState().addNode('text_input', { x: 100, y: 200 });

      const nodes = useWorkflowStore.getState().nodes;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].data.type).toBe('text_input');
      expect(nodes[0].data.label).toContain('Text Input');
      expect(nodes[0].position).toEqual({ x: 100, y: 200 });
      expect(nodes[0].data.status).toBe('idle');
    });

    it('should add audio_synth with fault status', () => {
      useWorkflowStore.getState().addNode('audio_synth', { x: 0, y: 0 });

      const node = useWorkflowStore.getState().nodes[0];
      expect(node.data.type).toBe('audio_synth');
      expect(node.data.status).toBe('fault');
    });

    it('should set default config based on node type', () => {
      useWorkflowStore.getState().addNode('llm_process', { x: 0, y: 0 });
      expect(useWorkflowStore.getState().nodes[0].data.config.model).toBe('auto');

      useWorkflowStore.getState().addNode('transform', { x: 0, y: 0 });
      expect(useWorkflowStore.getState().nodes[1].data.config.operation).toBe('passthrough');

      useWorkflowStore.getState().addNode('condition', { x: 0, y: 0 });
      expect(useWorkflowStore.getState().nodes[2].data.config.rule).toBe('content_safety');
    });

    it('should generate unique IDs for each node', () => {
      useWorkflowStore.getState().addNode('text_input', { x: 0, y: 0 });
      useWorkflowStore.getState().addNode('text_input', { x: 0, y: 0 });

      const ids = useWorkflowStore.getState().nodes.map(n => n.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe('removeNode()', () => {
    it('should remove node and connected edges', () => {
      useWorkflowStore.getState().loadTemplate('template_basic');
      const nodeId = useWorkflowStore.getState().nodes[1].id; // LLM node (middle)

      useWorkflowStore.getState().removeNode(nodeId);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.find(n => n.id === nodeId)).toBeUndefined();
      // Edges connected to removed node should be gone
      state.edges.forEach(e => {
        expect(e.source).not.toBe(nodeId);
        expect(e.target).not.toBe(nodeId);
      });
    });

    it('should deselect if selected node is removed', () => {
      useWorkflowStore.getState().addNode('text_input', { x: 0, y: 0 });
      const nodeId = useWorkflowStore.getState().nodes[0].id;
      useWorkflowStore.getState().selectNode(nodeId);
      expect(useWorkflowStore.getState().selectedNodeId).toBe(nodeId);

      useWorkflowStore.getState().removeNode(nodeId);
      expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('selectNode()', () => {
    it('should set selectedNodeId', () => {
      useWorkflowStore.getState().selectNode('n1');
      expect(useWorkflowStore.getState().selectedNodeId).toBe('n1');
    });

    it('should allow deselection with null', () => {
      useWorkflowStore.getState().selectNode('n1');
      useWorkflowStore.getState().selectNode(null);
      expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('updateNodeData()', () => {
    it('should update specific node data fields', () => {
      useWorkflowStore.getState().loadTemplate('template_basic');
      const nodeId = useWorkflowStore.getState().nodes[0].id;

      useWorkflowStore.getState().updateNodeData(nodeId, {
        config: { value: 'Updated value' },
      });

      const node = useWorkflowStore.getState().nodes.find(n => n.id === nodeId)!;
      expect(node.data.config.value).toBe('Updated value');
    });

    it('should not affect other nodes', () => {
      useWorkflowStore.getState().loadTemplate('template_basic');
      const nodes = useWorkflowStore.getState().nodes;

      useWorkflowStore.getState().updateNodeData(nodes[0].id, { label: 'Changed' });

      expect(useWorkflowStore.getState().nodes[1].data.label).not.toBe('Changed');
    });
  });
});

describe('setNodes / setEdges', () => {
  it('setNodes should accept direct array', () => {
    useWorkflowStore.getState().setNodes([]);
    expect(useWorkflowStore.getState().nodes).toEqual([]);
  });

  it('setNodes should accept updater function', () => {
    useWorkflowStore.getState().loadTemplate('template_basic');
    const originalLength = useWorkflowStore.getState().nodes.length;

    useWorkflowStore.getState().setNodes(prev => prev.slice(0, 1));
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('setEdges should accept direct array', () => {
    useWorkflowStore.getState().setEdges([]);
    expect(useWorkflowStore.getState().edges).toEqual([]);
  });

  it('setEdges should accept updater function', () => {
    useWorkflowStore.getState().loadTemplate('template_basic');
    useWorkflowStore.getState().setEdges(prev => prev.slice(0, 1));
    expect(useWorkflowStore.getState().edges).toHaveLength(1);
  });
});

describe('Workflow CRUD / 工作流 CRUD', () => {
  describe('createWorkflow()', () => {
    it('should create offline workflow with local_ prefix', async () => {
      useWorkflowStore.getState().loadTemplate('template_basic');

      const id = await useWorkflowStore.getState().createWorkflow('My Flow', 'Description');

      expect(id).toMatch(/^local_/);
      expect(useWorkflowStore.getState().workflows).toHaveLength(1);
      expect(useWorkflowStore.getState().workflows[0].name).toBe('My Flow');
      expect(useWorkflowStore.getState().activeWorkflowId).toBe(id);
    });
  });

  describe('deleteWorkflow()', () => {
    it('should remove workflow from list', async () => {
      useWorkflowStore.setState({
        workflows: [
          { id: 'w1', user_id: 'u1', name: 'Flow 1', description: null, definition: {}, is_public: false, created_at: '', updated_at: '' },
        ],
        activeWorkflowId: 'w1',
        nodes: [{ id: 'n1', type: 'cyber_node', position: { x: 0, y: 0 }, data: { label: 'X', type: 'text_input' as const, config: {} } }],
      });

      await useWorkflowStore.getState().deleteWorkflow('w1');

      expect(useWorkflowStore.getState().workflows).toHaveLength(0);
      expect(useWorkflowStore.getState().activeWorkflowId).toBeNull();
      expect(useWorkflowStore.getState().nodes).toEqual([]);
    });
  });

  describe('selectWorkflow()', () => {
    it('should load definition into canvas', () => {
      const workflowDef = {
        nodes: [{ id: 'n1', type: 'cyber_node', position: { x: 0, y: 0 }, data: { label: 'Test', type: 'text_input', config: { value: 'hi' } } }],
        edges: [],
      };
      useWorkflowStore.setState({
        workflows: [
          { id: 'w1', user_id: 'u1', name: 'Flow', description: null, definition: workflowDef, is_public: false, created_at: '', updated_at: '' },
        ],
      });

      useWorkflowStore.getState().selectWorkflow('w1');

      expect(useWorkflowStore.getState().activeWorkflowId).toBe('w1');
      expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    });

    it('selectWorkflow(null) should clear canvas', () => {
      useWorkflowStore.setState({ nodes: [{ id: 'n1', type: 'cyber_node', position: { x: 0, y: 0 }, data: { label: 'X', type: 'text_input' as const, config: {} } }] });

      useWorkflowStore.getState().selectWorkflow(null);

      expect(useWorkflowStore.getState().nodes).toEqual([]);
      expect(useWorkflowStore.getState().edges).toEqual([]);
      expect(useWorkflowStore.getState().activeWorkflowId).toBeNull();
    });
  });
});

describe('Execution / 执行', () => {
  describe('executeWorkflow()', () => {
    it('should transition: idle → running → completed', async () => {
      useWorkflowStore.getState().loadTemplate('template_basic');

      const statusHistory: string[] = [];
      const unsubscribe = useWorkflowStore.subscribe(state => {
        if (!statusHistory.includes(state.executionStatus) || statusHistory[statusHistory.length - 1] !== state.executionStatus) {
          statusHistory.push(state.executionStatus);
        }
      });

      await useWorkflowStore.getState().executeWorkflow();
      unsubscribe();

      expect(statusHistory).toContain('running');
      expect(useWorkflowStore.getState().executionStatus).toBe('completed');
    });

    it('should populate executionOutputs', async () => {
      useWorkflowStore.getState().loadTemplate('template_basic');
      await useWorkflowStore.getState().executeWorkflow();

      const outputs = useWorkflowStore.getState().executionOutputs;
      expect(Object.keys(outputs).length).toBeGreaterThan(0);
    });

    it('should generate execution logs', async () => {
      useWorkflowStore.getState().loadTemplate('template_basic');
      await useWorkflowStore.getState().executeWorkflow();

      const logs = useWorkflowStore.getState().executionLogs;
      expect(logs.length).toBeGreaterThan(0);
      logs.forEach(log => {
        expect(log.nodeId).toBeDefined();
        expect(log.status).toBeDefined();
        expect(log.timestamp).toBeGreaterThan(0);
      });
    });

    it('should not execute when canvas is empty', async () => {
      useWorkflowStore.setState({ nodes: [], edges: [] });
      await useWorkflowStore.getState().executeWorkflow();
      expect(useWorkflowStore.getState().executionStatus).toBe('idle');
    });
  });

  describe('audio_synth fault during execution', () => {
    it('should fail execution when audio_synth node is present', async () => {
      useWorkflowStore.setState({
        nodes: [
          { id: 'n1', type: 'cyber_node', position: { x: 0, y: 0 }, data: { label: 'Input', type: 'text_input' as const, config: { value: 'test' }, status: 'idle' as const } },
          { id: 'n2', type: 'cyber_node', position: { x: 200, y: 0 }, data: { label: 'Voice', type: 'audio_synth' as const, config: {}, status: 'fault' as const } },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });

      await useWorkflowStore.getState().executeWorkflow();

      expect(useWorkflowStore.getState().executionStatus).toBe('failed');
    });
  });

  describe('abortExecution()', () => {
    it('should set status to failed', () => {
      useWorkflowStore.setState({ executionStatus: 'running' });
      useWorkflowStore.getState().abortExecution();
      expect(useWorkflowStore.getState().executionStatus).toBe('failed');
      expect(useWorkflowStore.getState().currentEngineRef).toBeNull();
    });
  });

  describe('resetExecution()', () => {
    it('should reset all execution state', () => {
      useWorkflowStore.setState({
        executionStatus: 'completed',
        executionLogs: [{ nodeId: 'n1', status: 'ok', timestamp: 1 }],
        executionOutputs: { n1: 'data' },
      });

      // Add a node to verify status reset
      useWorkflowStore.setState({
        nodes: [
          { id: 'n1', type: 'cyber_node', position: { x: 0, y: 0 }, data: { label: 'Test', type: 'text_input' as const, config: { value: 'x', _lastOutput: 'old' }, status: 'completed' as const } },
        ],
      });

      useWorkflowStore.getState().resetExecution();

      const state = useWorkflowStore.getState();
      expect(state.executionStatus).toBe('idle');
      expect(state.executionLogs).toEqual([]);
      expect(state.executionOutputs).toEqual({});
      expect(state.currentEngineRef).toBeNull();

      // Node statuses should be reset
      expect(state.nodes[0].data.status).toBe('idle');
      expect(state.nodes[0].data.config._lastOutput).toBeUndefined();
    });

    it('should reset audio_synth nodes to fault status', () => {
      useWorkflowStore.setState({
        nodes: [
          { id: 'n1', type: 'cyber_node', position: { x: 0, y: 0 }, data: { label: 'Voice', type: 'audio_synth' as const, config: {}, status: 'idle' as const } },
        ],
      });

      useWorkflowStore.getState().resetExecution();

      expect(useWorkflowStore.getState().nodes[0].data.status).toBe('fault');
    });
  });
});
