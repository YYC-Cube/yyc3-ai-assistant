/**
 * YYC3 DAG Engine V2 — Full Test Suite
 * 言语云立方 - DAG 引擎全量测试
 *
 * Coverage targets:
 * - Topological sort / 拓扑排序
 * - Cycle detection / 环检测
 * - Node execution (all 7 types) / 节点执行
 * - audio_synth hardcoded fault / 语音合成硬故障
 * - Condition branching & skip / 条件分支与跳过
 * - Transform operations (all 8) / 数据变换
 * - Abort mechanism / 中止机制
 * - Edge cases / 边界情况
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DAGEngineV2,
  type DAGNode,
  type DAGEdge,
  type ExecutionContext,
  type DAGExecutionResult,
} from '../dag-engine';
import type { LLMConfig } from '@/types';

// ============================================================
// Mock LLM module / 模拟 LLM 模块
// ============================================================

vi.mock('../llm', () => ({
  generateCompletion: vi.fn().mockResolvedValue('Mock LLM response'),
}));

// ============================================================
// Helpers / 辅助工具
// ============================================================

const MOCK_LLM_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  ttsProvider: 'browser',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  ttsSpeed: 1.0,
};

function makeNode(id: string, type: DAGNode['type'], config: Record<string, any> = {}, label?: string): DAGNode {
  return { id, type, label: label || `Node_${id}`, config };
}

function makeEdge(source: string, target: string): DAGEdge {
  return { id: `e_${source}_${target}`, source, target };
}

function collectNodeOrder(logs: ExecutionContext[]): string[] {
  return logs
    .filter(l => l.nodeId !== 'system' && l.status === 'running')
    .map(l => l.nodeId);
}

// ============================================================
// Test Suite
// ============================================================

describe('DAGEngineV2', () => {

  // ──────────────────────────────────────────────
  // 1. Validation / 验证
  // ──────────────────────────────────────────────

  describe('validate()', () => {
    it('should reject empty DAG', () => {
      const engine = new DAGEngineV2([], [], MOCK_LLM_CONFIG);
      const v = engine.validate();
      expect(v.valid).toBe(false);
      expect(v.error).toContain('empty');
    });

    it('should reject DAG containing audio_synth node (hardcoded fault)', () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'test' }),
        makeNode('n2', 'audio_synth'),
      ];
      const edges = [makeEdge('n1', 'n2')];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);

      const v = engine.validate();
      expect(v.valid).toBe(false);
      expect(v.error).toContain('0x503_VOICE_MOD');
      expect(v.error).toContain('CRITICAL FAULT');
    });

    it('should reject DAG with cycle (A→B→A)', () => {
      const nodes = [
        makeNode('a', 'text_input', { value: 'x' }),
        makeNode('b', 'transform', { operation: 'passthrough' }),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);

      const v = engine.validate();
      expect(v.valid).toBe(false);
      expect(v.error).toContain('Cycle');
    });

    it('should reject DAG with 3-node cycle (A→B→C→A)', () => {
      const nodes = [
        makeNode('a', 'transform', { operation: 'passthrough' }),
        makeNode('b', 'transform', { operation: 'passthrough' }),
        makeNode('c', 'transform', { operation: 'passthrough' }),
      ];
      const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'a')];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);

      expect(engine.validate().valid).toBe(false);
    });

    it('should accept valid linear DAG', () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'hello' }),
        makeNode('n2', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2')];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);

      expect(engine.validate().valid).toBe(true);
    });

    it('should accept single-node DAG (no edges)', () => {
      const nodes = [makeNode('n1', 'text_input', { value: 'solo' })];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);

      expect(engine.validate().valid).toBe(true);
    });

    it('should accept diamond-shaped DAG (fan-out + fan-in)', () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'start' }),
        makeNode('n2', 'transform', { operation: 'uppercase' }),
        makeNode('n3', 'transform', { operation: 'lowercase' }),
        makeNode('n4', 'output'),
      ];
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n1', 'n3'),
        makeEdge('n2', 'n4'),
        makeEdge('n3', 'n4'),
      ];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);

      expect(engine.validate().valid).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // 2. Topological Sort & Execution Order / 拓扑排序
  // ──────────────────────────────────────────────

  describe('Execution Order / 执行顺序', () => {
    it('should execute linear chain in order: n1→n2→n3', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'hello' }),
        makeNode('n2', 'transform', { operation: 'uppercase' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const logs: ExecutionContext[] = [];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG, ctx => logs.push(ctx));

      const result = await engine.execute();
      expect(result.success).toBe(true);

      const order = collectNodeOrder(logs);
      expect(order).toEqual(['n1', 'n2', 'n3']);
    });

    it('should execute fan-out: n1 before both n2 and n3', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'start' }),
        makeNode('n2', 'transform', { operation: 'uppercase' }),
        makeNode('n3', 'transform', { operation: 'lowercase' }),
        makeNode('n4', 'output'),
      ];
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n1', 'n3'),
        makeEdge('n2', 'n4'),
        makeEdge('n3', 'n4'),
      ];

      const logs: ExecutionContext[] = [];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG, ctx => logs.push(ctx));

      const result = await engine.execute();
      expect(result.success).toBe(true);

      const order = collectNodeOrder(logs);
      // n1 must be first, n4 must be last
      expect(order[0]).toBe('n1');
      expect(order[order.length - 1]).toBe('n4');
      // n2 and n3 both appear before n4
      expect(order.indexOf('n2')).toBeLessThan(order.indexOf('n4'));
      expect(order.indexOf('n3')).toBeLessThan(order.indexOf('n4'));
    });

    it('should execute single node DAG', async () => {
      const nodes = [makeNode('solo', 'text_input', { value: 'alone' })];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.outputs['solo']).toBe('alone');
    });
  });

  // ──────────────────────────────────────────────
  // 3. Node Type Execution / 各节点类型执行
  // ──────────────────────────────────────────────

  describe('text_input node', () => {
    it('should output configured value', async () => {
      const nodes = [makeNode('n1', 'text_input', { value: 'Hello World' })];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);

      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.outputs['n1']).toBe('Hello World');
    });

    it('should output prompt if value is missing', async () => {
      const nodes = [makeNode('n1', 'text_input', { prompt: 'Alternative prompt' })];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);

      const result = await engine.execute();
      expect(result.outputs['n1']).toBe('Alternative prompt');
    });

    it('should output fallback for empty config', async () => {
      const nodes = [makeNode('n1', 'text_input', {})];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);

      const result = await engine.execute();
      expect(result.outputs['n1']).toContain('Empty input');
    });
  });

  describe('llm_process node', () => {
    it('should call LLM and return mock response', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'What is AI?' }),
        makeNode('n2', 'llm_process', { model: 'auto' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.outputs['n2']).toBe('Mock LLM response');
      expect(result.outputs['n3']).toBe('Mock LLM response');
    });

    it('should use node-level prompt override', async () => {
      const { generateCompletion } = await import('../llm');
      const nodes = [
        makeNode('n1', 'text_input', { value: 'data' }),
        makeNode('n2', 'llm_process', { model: 'auto', prompt: 'Custom system prompt' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      await engine.execute();

      expect(generateCompletion).toHaveBeenCalled();
    });
  });

  describe('image_gen node', () => {
    it('should return simulation output when no API endpoint', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'cyberpunk city' }),
        makeNode('n2', 'image_gen', {}),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.outputs['n2']).toContain('Image Gen Simulation');
      expect(result.outputs['n2']).toContain('cyberpunk city');
    });
  });

  describe('output node', () => {
    it('should pass through single input', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'data-pass' }),
        makeNode('n2', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('data-pass');
    });

    it('should merge multiple inputs', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'Part A' }),
        makeNode('n2', 'text_input', { value: 'Part B' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n3'), makeEdge('n2', 'n3')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      const output = result.outputs['n3'];
      expect(output).toContain('Part A');
      expect(output).toContain('Part B');
    });

    it('should return JSON format when configured', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'val1' }),
        makeNode('n2', 'text_input', { value: 'val2' }),
        makeNode('n3', 'output', { format: 'json' }),
      ];
      const edges = [makeEdge('n1', 'n3'), makeEdge('n2', 'n3')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(typeof result.outputs['n3']).toBe('object');
      expect(result.outputs['n3']['n1']).toBe('val1');
      expect(result.outputs['n3']['n2']).toBe('val2');
    });

    it('should handle no input gracefully', async () => {
      const nodes = [makeNode('n1', 'output')];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n1']).toContain('No input');
    });
  });

  describe('audio_synth node (HARDCODED FAULT)', () => {
    it('should ALWAYS block execution at validation stage', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'speak this' }),
        makeNode('n2', 'audio_synth', {}, 'Voice Synth'),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);

      // Validation should fail
      const v = engine.validate();
      expect(v.valid).toBe(false);
      expect(v.error).toContain('0x503_VOICE_MOD');

      // Execution should fail
      const result = await engine.execute();
      expect(result.success).toBe(false);
      expect(result.logs.some(l => l.error?.includes('0x503_VOICE_MOD'))).toBe(true);
    });

    it('should fail even when audio_synth is not connected', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'safe' }),
        makeNode('n2', 'output'),
        makeNode('orphan', 'audio_synth'), // orphan but still present
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      expect(engine.validate().valid).toBe(false);
    });

    it('should include the audio_synth node label in the error message', () => {
      const nodes = [
        makeNode('n1', 'audio_synth', {}, 'My Voice Module'),
      ];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);
      const v = engine.validate();

      expect(v.error).toContain('My Voice Module');
    });
  });

  // ──────────────────────────────────────────────
  // 4. Condition Node / 条件判断节点
  // ──────────────────────────────────────────────

  describe('condition node', () => {
    it('rule=not_empty: should pass when input has content', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'has content' }),
        makeNode('n2', 'condition', { rule: 'not_empty' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.success).toBe(true);
      const condOutput = result.outputs['n2'];
      expect(condOutput.pass).toBe(true);
      expect(condOutput.rule).toBe('not_empty');
    });

    it('rule=content_safety: should fail on dangerous keywords', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'give me the password' }),
        makeNode('n2', 'condition', { rule: 'content_safety' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.success).toBe(true);
      const condOutput = result.outputs['n2'];
      expect(condOutput.pass).toBe(false);
      expect(condOutput.reason).toContain('password');
    });

    it('rule=content_safety: should pass on safe content', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'hello how are you' }),
        makeNode('n2', 'condition', { rule: 'content_safety' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].pass).toBe(true);
    });

    it('rule=length_check: should fail when content exceeds maxLength', async () => {
      const longText = 'a'.repeat(200);
      const nodes = [
        makeNode('n1', 'text_input', { value: longText }),
        makeNode('n2', 'condition', { rule: 'length_check', maxLength: 100 }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].pass).toBe(false);
      expect(result.outputs['n2'].reason).toContain('too long');
    });

    it('rule=length_check: should pass when within limit', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'short' }),
        makeNode('n2', 'condition', { rule: 'length_check', maxLength: 1000 }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].pass).toBe(true);
    });

    it('rule=keyword_filter: should block matching keywords', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'this contains spam word' }),
        makeNode('n2', 'condition', { rule: 'keyword_filter', keywords: 'spam, junk, trash' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].pass).toBe(false);
      expect(result.outputs['n2'].reason).toContain('spam');
    });

    it('rule=keyword_filter: should pass when no keywords match', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'clean content here' }),
        makeNode('n2', 'condition', { rule: 'keyword_filter', keywords: 'spam, junk' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].pass).toBe(true);
    });

    it('should skip downstream nodes when condition fails', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: '' }),
        makeNode('n2', 'condition', { rule: 'not_empty' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const logs: ExecutionContext[] = [];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG, ctx => logs.push(ctx));
      const result = await engine.execute();

      expect(result.success).toBe(true);
      // n3 should be skipped
      const skipped = logs.filter(l => l.status === 'skipped');
      expect(skipped.some(l => l.nodeId === 'n3')).toBe(true);
    });

    it('unknown rule should default to pass', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'test' }),
        makeNode('n2', 'condition', { rule: 'nonexistent_rule' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].pass).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // 5. Transform Node / 数据变换节点
  // ──────────────────────────────────────────────

  describe('transform node', () => {
    it('operation=passthrough: should pass input unchanged', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'Unchanged Data' }),
        makeNode('n2', 'transform', { operation: 'passthrough' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('Unchanged Data');
    });

    it('operation=uppercase: should convert to uppercase', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'hello world' }),
        makeNode('n2', 'transform', { operation: 'uppercase' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('HELLO WORLD');
    });

    it('operation=lowercase: should convert to lowercase', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'HELLO WORLD' }),
        makeNode('n2', 'transform', { operation: 'lowercase' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('hello world');
    });

    it('operation=sanitize: should strip HTML tags and special chars', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: '<script>alert("xss")</script>Clean Text' }),
        makeNode('n2', 'transform', { operation: 'sanitize' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).not.toContain('<script>');
      expect(result.outputs['n2']).not.toContain('</script>');
      expect(result.outputs['n2']).toContain('Clean Text');
    });

    it('operation=truncate: should truncate long text', async () => {
      const longText = 'a'.repeat(600);
      const nodes = [
        makeNode('n1', 'text_input', { value: longText }),
        makeNode('n2', 'transform', { operation: 'truncate', maxLength: 100 }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2'].length).toBeLessThan(longText.length);
      expect(result.outputs['n2']).toContain('Truncated');
    });

    it('operation=truncate: should not truncate short text', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'short' }),
        makeNode('n2', 'transform', { operation: 'truncate', maxLength: 500 }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('short');
    });

    it('operation=extract_json: should extract JSON from markdown code block', async () => {
      const input = 'Here is the data:\n```json\n{"key": "value"}\n```\nDone.';
      const nodes = [
        makeNode('n1', 'text_input', { value: input }),
        makeNode('n2', 'transform', { operation: 'extract_json' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      const parsed = JSON.parse(result.outputs['n2']);
      expect(parsed.key).toBe('value');
    });

    it('operation=extract_json: should handle no JSON gracefully', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'No JSON here at all' }),
        makeNode('n2', 'transform', { operation: 'extract_json' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toContain('No JSON found');
    });

    it('operation=word_count: should count words and characters', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'Hello World Test' }),
        makeNode('n2', 'transform', { operation: 'word_count' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toContain('Words: 3');
      expect(result.outputs['n2']).toContain('Characters: 16');
    });

    it('operation=template: should substitute {{input}} placeholder', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'World' }),
        makeNode('n2', 'transform', { operation: 'template', template: 'Hello, {{input}}!' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('Hello, World!');
    });

    it('operation=split_lines: should split into JSON array', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'line1\nline2\nline3' }),
        makeNode('n2', 'transform', { operation: 'split_lines' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      const parsed = JSON.parse(result.outputs['n2']);
      expect(parsed).toEqual(['line1', 'line2', 'line3']);
    });

    it('unknown operation should default to passthrough', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'test data' }),
        makeNode('n2', 'transform', { operation: 'nonexistent_op' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n2']).toBe('test data');
    });
  });

  // ──────────────────────────────────────────────
  // 6. Data Flow / 节点间数据流
  // ──────────────────────────────────────────────

  describe('Inter-node Data Flow / 数据流', () => {
    it('should chain text_input→transform→output correctly', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'hello world' }),
        makeNode('n2', 'transform', { operation: 'uppercase' }),
        makeNode('n3', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n1']).toBe('hello world');
      expect(result.outputs['n2']).toBe('HELLO WORLD');
      expect(result.outputs['n3']).toBe('HELLO WORLD');
    });

    it('should merge multiple inputs into output node', async () => {
      const nodes = [
        makeNode('a', 'text_input', { value: 'Alpha' }),
        makeNode('b', 'text_input', { value: 'Beta' }),
        makeNode('c', 'text_input', { value: 'Gamma' }),
        makeNode('out', 'output'),
      ];
      const edges = [
        makeEdge('a', 'out'),
        makeEdge('b', 'out'),
        makeEdge('c', 'out'),
      ];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      const output = result.outputs['out'];
      expect(output).toContain('Alpha');
      expect(output).toContain('Beta');
      expect(output).toContain('Gamma');
    });

    it('should chain multiple transforms', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: '  Hello World  ' }),
        makeNode('n2', 'transform', { operation: 'sanitize' }), // trims
        makeNode('n3', 'transform', { operation: 'uppercase' }),
        makeNode('n4', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3'), makeEdge('n3', 'n4')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.outputs['n4']).toBe('HELLO WORLD');
    });
  });

  // ──────────────────────────────────────────────
  // 7. Abort Mechanism / 中止机制
  // ──────────────────────────────────────────────

  describe('Abort / 中止', () => {
    it('should stop execution when abort() is called before execute', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'test' }),
        makeNode('n2', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      engine.abort();

      const result = await engine.execute();
      expect(result.success).toBe(false);
    });

    it('should provide abort signal', () => {
      const engine = new DAGEngineV2([], [], MOCK_LLM_CONFIG);
      expect(engine.signal).toBeInstanceOf(AbortSignal);
      expect(engine.signal.aborted).toBe(false);

      engine.abort();
      expect(engine.signal.aborted).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // 8. Execution Result / 执行结果
  // ──────────────────────────────────────────────

  describe('Execution Result / 执行结果', () => {
    it('should include totalDurationMs', async () => {
      const nodes = [makeNode('n1', 'text_input', { value: 'test' })];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG);

      const result = await engine.execute();
      expect(typeof result.totalDurationMs).toBe('number');
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include logs with timestamps and durations', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'test' }),
        makeNode('n2', 'transform', { operation: 'uppercase' }),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.logs.length).toBeGreaterThan(0);
      result.logs.forEach(log => {
        expect(log.timestamp).toBeGreaterThan(0);
        expect(log.nodeId).toBeDefined();
        expect(log.status).toBeDefined();
      });
    });

    it('should truncate long outputs in logs (>500 chars)', async () => {
      const longValue = 'x'.repeat(600);
      const nodes = [makeNode('n1', 'text_input', { value: longValue })];

      const logs: ExecutionContext[] = [];
      const engine = new DAGEngineV2(nodes, [], MOCK_LLM_CONFIG, ctx => logs.push(ctx));
      await engine.execute();

      const completedLog = logs.find(l => l.nodeId === 'n1' && l.status === 'completed');
      expect(completedLog?.output?.length).toBeLessThanOrEqual(503); // 500 + "..."
    });
  });

  // ──────────────────────────────────────────────
  // 9. Complex Scenarios / 复杂场景
  // ──────────────────────────────────────────────

  describe('Complex Scenarios / 复杂场景', () => {
    it('should execute the "Security Audit Chain" template pattern', async () => {
      // Input → Sanitize → [Condition + LLM] → Output
      const nodes = [
        makeNode('n1', 'text_input', { value: 'analyze this safe report' }),
        makeNode('n2', 'transform', { operation: 'sanitize' }),
        makeNode('n3', 'condition', { rule: 'content_safety' }),
        makeNode('n4', 'llm_process', { model: 'auto' }),
        makeNode('n5', 'output'),
      ];
      const edges = [
        makeEdge('n1', 'n2'),
        makeEdge('n2', 'n3'),
        makeEdge('n2', 'n4'),
        makeEdge('n3', 'n5'),
        makeEdge('n4', 'n5'),
      ];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.outputs['n3'].pass).toBe(true);
      expect(result.outputs['n5']).toBeDefined();
    });

    it('should handle disconnected subgraphs (no edges between groups)', async () => {
      const nodes = [
        makeNode('a1', 'text_input', { value: 'group A' }),
        makeNode('a2', 'output'),
        makeNode('b1', 'text_input', { value: 'group B' }),
        makeNode('b2', 'output'),
      ];
      const edges = [
        makeEdge('a1', 'a2'),
        makeEdge('b1', 'b2'),
      ];

      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG);
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.outputs['a2']).toBe('group A');
      expect(result.outputs['b2']).toBe('group B');
    });

    it('should handle progress callback for all node state transitions', async () => {
      const nodes = [
        makeNode('n1', 'text_input', { value: 'test' }),
        makeNode('n2', 'output'),
      ];
      const edges = [makeEdge('n1', 'n2')];

      const statuses: string[] = [];
      const engine = new DAGEngineV2(nodes, edges, MOCK_LLM_CONFIG, ctx => {
        statuses.push(`${ctx.nodeId}:${ctx.status}`);
      });

      await engine.execute();

      // Should have: system:running, n1:running, n1:completed, n2:running, n2:completed, system:completed
      expect(statuses).toContain('system:running');
      expect(statuses).toContain('n1:running');
      expect(statuses).toContain('n1:completed');
      expect(statuses).toContain('n2:running');
      expect(statuses).toContain('n2:completed');
      expect(statuses).toContain('system:completed');
    });
  });
});
