# YanYuCloudCube - Supervisor Technical Guidance
# YanYuCloudCube - 导师技术指导文档

> **Version / 版本:** 1.0
> **Date / 日期:** 2026-02-15
> **Scope / 范围:** Testing Framework / TypeScript Definitions / MVP Expansion / Big Data Direction
> **Basis / 依据:** YYC3-AI-pi3-五维实施方案 v3.3.0

---

## Table of Contents / 目录

1. [Testing Framework / 测试框架体系](#1-testing-framework--测试框架体系)
2. [TypeScript Full Type Definitions / TypeScript 全量类型定义](#2-typescript-full-type-definitions--typescript-全量类型定义)
3. [MVP Definition Expansion / MVP 定义拓展](#3-mvp-definition-expansion--mvp-定义拓展)
4. [Big Data Analysis Direction / 大数据分析方向](#4-big-data-analysis-direction--大数据分析方向)
5. [Cross-Cutting Concerns / 横切关注点](#5-cross-cutting-concerns--横切关注点)

---

## 1. Testing Framework / 测试框架体系

### 1.1 Architecture Overview / 架构总览

```
Testing Pyramid / 测试金字塔:

                    ┌─────────┐
                    │  E2E    │  ← 5%   Playwright / Cypress
                   ─┼─────────┼─
                  │  Integration │  ← 15%  Vitest + MSW + TestContainers
                 ─┼──────────────┼─
                │    Unit Tests    │  ← 60%  Vitest + Testing Library
               ─┼──────────────────┼─
              │   Static Analysis    │  ← 20%  TypeScript strict + ESLint + Biome
             └────────────────────────┘

Specialty Testing / 专项测试:

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ Performance      │  │ Chaos Eng.       │  │ Security         │
  │ 性能测试         │  │ 混沌工程         │  │ 安全测试         │
  │ Lighthouse CI    │  │ Fault Injection  │  │ OWASP ZAP        │
  │ Web Vitals       │  │ Network Chaos    │  │ Dependency Audit │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 1.2 Layer 1: Static Analysis / 静态分析层

**Purpose / 目的:** Catch errors at compile time before any code runs.

```typescript
// tsconfig.json — recommended strict settings
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

**Toolchain / 工具链:**

| Tool / 工具 | Role / 角色 | Config / 配置 |
|---|---|---|
| TypeScript 5.x `strict` | Type safety / 类型安全 | `tsconfig.json` |
| Biome | Lint + Format (replaces ESLint+Prettier) | `biome.json` |
| `knip` | Dead code / unused exports detection | `knip.json` |
| `tsc --noEmit` | CI type check / CI 类型检查 | pre-commit hook |

### 1.3 Layer 2: Unit Tests / 单元测试层

**Current state / 现状:** Project has `utils/__tests__/validation.test.ts` with 7 test cases.

**Target state / 目标:** Cover ALL pure logic modules:

```
Test File Mapping / 测试文件映射:

utils/
├── __tests__/
│   ├── validation.test.ts        ✅ EXISTS (7 cases)
│   ├── dag-engine.test.ts        ✅ DONE  (52 cases) — Core DAG logic
│   ├── llm.test.ts               ✅ DONE  (18 cases) — LLM completion mock
│   ├── character.test.ts         ✅ DONE  (10 cases) — Character profiles
│   ├── cloud.test.ts             ✅ DONE  (12 cases) — Cloud utilities
│   ├── design-system.test.ts     ✅ DONE  (10 cases) — Design token validation
│   ├── model-presets.test.ts     ✅ DONE  (10 cases) — Preset integrity
│   └── rag.test.ts               ✅ DONE  (10 cases) — RAG retrieval logic

stores/
├── __tests__/
│   ├── auth-store.test.ts        ✅ DONE  (18 cases) — Preset login, session
│   ├── app-store.test.ts         ✅ DONE  (15 cases) — Theme, navigation
│   ├── config-store.test.ts      ✅ DONE  (14 cases) — Config CRUD
│   └── workflow-store.test.ts    ✅ DONE  (26 cases) — Template load, CRUD

lib/
├── __tests__/
│   └── pg-api.test.ts            ✅ DONE  (24 cases) — API client offline fallback
```

**DAG Engine Test Blueprint / DAG 引擎测试蓝图:**

```typescript
// utils/__tests__/dag-engine.test.ts — Critical test suite
import { describe, it, expect, vi } from 'vitest';
import { DAGEngineV2, DAGNode, DAGEdge } from '../dag-engine';

describe('DAGEngineV2', () => {

  // ── Topological Sort ──
  describe('Topological Sort / 拓扑排序', () => {
    it('should execute linear chain in order', async () => {
      // n1 → n2 → n3
      const nodes: DAGNode[] = [
        { id: 'n1', type: 'text_input', label: 'Input', config: { value: 'hello' } },
        { id: 'n2', type: 'transform', label: 'Pass', config: { operation: 'passthrough' } },
        { id: 'n3', type: 'output', label: 'Out', config: {} },
      ];
      const edges: DAGEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ];
      const llmConfig = { /* mock */ } as any;
      const logs: string[] = [];
      const engine = new DAGEngineV2(nodes, edges, llmConfig, (ctx) => logs.push(ctx.nodeId));
      const result = await engine.execute();

      expect(result.success).toBe(true);
      // Verify order: system → n1 → n2 → n3 → system
      const nodeOrder = logs.filter(id => id !== 'system');
      expect(nodeOrder).toEqual(['n1', 'n1', 'n2', 'n2', 'n3', 'n3']);
    });

    it('should detect cycles and reject', () => {
      // n1 → n2 → n1 (cycle)
      const nodes: DAGNode[] = [
        { id: 'n1', type: 'text_input', label: 'A', config: { value: 'x' } },
        { id: 'n2', type: 'transform', label: 'B', config: { operation: 'passthrough' } },
      ];
      const edges: DAGEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n1' },
      ];
      const engine = new DAGEngineV2(nodes, edges, {} as any);
      const validation = engine.validate();
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Cycle');
    });
  });

  // ── Audio Synth Hardcoded Fault ──
  describe('Audio Synth Fault / 语音合成硬故障', () => {
    it('should ALWAYS reject DAG containing audio_synth', () => {
      const nodes: DAGNode[] = [
        { id: 'n1', type: 'text_input', label: 'In', config: { value: 'test' } },
        { id: 'n2', type: 'audio_synth', label: 'Voice', config: {} },
      ];
      const edges: DAGEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
      ];
      const engine = new DAGEngineV2(nodes, edges, {} as any);
      const v = engine.validate();
      expect(v.valid).toBe(false);
      expect(v.error).toContain('0x503_VOICE_MOD');
    });
  });

  // ── Condition Branching ──
  describe('Condition Branching / 条件分支', () => {
    it('should skip downstream nodes when condition fails', async () => {
      const nodes: DAGNode[] = [
        { id: 'n1', type: 'text_input', label: 'In', config: { value: 'safe text' } },
        { id: 'n2', type: 'condition', label: 'Check', config: { rule: 'not_empty' } },
        { id: 'n3', type: 'output', label: 'Out', config: {} },
      ];
      const edges: DAGEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ];
      const engine = new DAGEngineV2(nodes, edges, {} as any);
      const result = await engine.execute();
      expect(result.success).toBe(true);
    });
  });

  // ── Transform Operations ──
  describe('Transform Operations / 数据变换', () => {
    it.each([
      ['sanitize', '<script>alert(1)</script>hello', 'alert(1)hello'],
      ['uppercase', 'hello world', 'HELLO WORLD'],
      ['lowercase', 'HELLO WORLD', 'hello world'],
    ])('operation=%s should transform correctly', async (op, input, expected) => {
      const nodes: DAGNode[] = [
        { id: 'n1', type: 'text_input', label: 'In', config: { value: input } },
        { id: 'n2', type: 'transform', label: 'T', config: { operation: op } },
        { id: 'n3', type: 'output', label: 'Out', config: {} },
      ];
      const edges: DAGEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ];
      const engine = new DAGEngineV2(nodes, edges, {} as any);
      const result = await engine.execute();
      expect(result.success).toBe(true);
      expect(result.outputs['n3']).toContain(expected);
    });
  });

  // ── Abort Mechanism ──
  describe('Abort / 中止执行', () => {
    it('should stop execution when abort() is called', async () => {
      const nodes: DAGNode[] = [
        { id: 'n1', type: 'text_input', label: 'In', config: { value: 'test' } },
        { id: 'n2', type: 'transform', label: 'Slow', config: { operation: 'passthrough' } },
        { id: 'n3', type: 'output', label: 'Out', config: {} },
      ];
      const edges: DAGEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ];
      const engine = new DAGEngineV2(nodes, edges, {} as any);
      // Abort immediately
      engine.abort();
      const result = await engine.execute();
      expect(result.success).toBe(false);
    });
  });
});
```

**Auth Store Test Blueprint / 鉴权 Store 测试蓝图:**

```typescript
// stores/__tests__/auth-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
// Direct import of tryPresetLogin logic for testing
// (Would need to export or test through store)

describe('Preset Operator Auth / 预置操作员验证', () => {
  it('yyc3_max should authenticate with correct password', () => {
    // Test: login('yyc3_max', 'yyc3_max') → success
  });

  it('yyc3_m4 should authenticate with correct password', () => {
    // Test: login('yyc3_m4', 'yyc3_m4') → success
  });

  it('should reject wrong password for preset operator', () => {
    // Test: login('yyc3_max', 'wrong') → fail
  });

  it('should reject unknown username in offline mode', () => {
    // Test: login('unknown_user', 'pass') → fail + error message
  });

  it('guest operator should have id starting with guest_', () => {
    // Test: continueAsGuest() → user.id.startsWith('guest_')
  });
});
```

### 1.4 Layer 3: Integration Tests / 集成测试层

```
Integration Test Scenarios / 集成测试场景:

┌─────────────────────────────────────────────────────────────┐
│ Scenario 1: Auth Flow / 鉴权流程                            │
│ AuthGate → AuthStore → pg-api → Express → PostgreSQL       │
│                     ↘ offlineStore (localStorage fallback)  │
├─────────────────────────────────────────────────────────────┤
│ Scenario 2: Config Sync / 配置同步                          │
│ ConfigPanel → ConfigStore → pg-api → Express → PG          │
│                          ↘ offlineStore (offline)           │
├─────────────────────────────────────────────────────────────┤
│ Scenario 3: Workflow Execution / 工作流执行                  │
│ WorkflowPanel → WorkflowStore → DAGEngineV2 → LLM API     │
│                              → pg-api (run persistence)    │
├─────────────────────────────────────────────────────────────┤
│ Scenario 4: Offline Degradation / 离线降级                   │
│ API offline → preset login → localStorage → pending queue  │
└─────────────────────────────────────────────────────────────┘
```

**MSW (Mock Service Worker) Setup / MSW 配置:**

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:3721/api';

export const handlers = [
  // Health check
  http.get(`${API_BASE}/health`, () =>
    HttpResponse.json({ status: 'ok', db: 'connected', version: '1.0.0' })
  ),

  // Auth login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const { username, password } = await request.json() as any;
    if (username === 'test_user' && password === 'test_pass') {
      return HttpResponse.json({
        token: 'mock_jwt_token',
        user: { id: 'test_1', username, avatar_url: null, theme_preference: 'cyan' },
      });
    }
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  // Configs list
  http.get(`${API_BASE}/configs`, () =>
    HttpResponse.json([])
  ),

  // Workflows list
  http.get(`${API_BASE}/workflows`, () =>
    HttpResponse.json([])
  ),

  // LLM Proxy — simulate completion
  http.post(`${API_BASE}/llm/proxy`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      choices: [{ message: { content: `Mock LLM response to: ${body.messages?.[0]?.content}` } }],
    });
  }),
];
```

### 1.5 Layer 4: E2E Tests / 端到端测试层

**Critical User Journeys / 关键用户旅程:**

| # | Journey / 旅程 | Steps / 步骤 | Priority |
|---|---|---|---|
| E1 | Preset Login | Open AuthGate → Enter yyc3_max/yyc3_max → See main UI | P0 |
| E2 | Guest Access | Click "Ghost Operator" → See main UI with guest badge | P0 |
| E3 | Workflow Create+Run | Load template → Execute → See logs in ExecutionLog | P0 |
| E4 | Config Change | Open ConfigPanel → Switch to DeepSeek → Save → Verify | P1 |
| E5 | Theme Toggle | Double-tap → Orbital Menu → Toggle theme → Verify HUD color | P1 |
| E6 | Audio Fault | Add audio_synth node → Attempt execute → See red fault UI | P1 |

### 1.6 Layer 5: Specialty Tests / 专项测试层

#### 1.6.1 Performance Testing / 性能测试

| Metric / 指标 | Target / 目标 | Tool / 工具 | Phase |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse CI | Current |
| FID (First Input Delay) | < 100ms | Web Vitals | Current |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse CI | Current |
| DAG execution (5-node chain) | < 500ms (local transform only) | Custom benchmark | Phase 3 |
| React Flow render (50 nodes) | > 30 FPS | Chrome DevTools | Phase 2 |
| Memory (30min session) | < 150MB | Chrome Memory Profiler | Phase 8 |
| Agent runtime startup | < 2s | Custom timer | Phase 8 |
| TF.js training throughput | > 100 experiences/sec | Custom benchmark | Phase 8 |

#### 1.6.2 Chaos Engineering / 混沌工程 (Phase 8+)

```
Fault Injection Scenarios / 故障注入场景:

┌─ Network Faults ────────────────────────────────────┐
│  F1: API server down mid-workflow execution          │
│  F2: 500ms+ latency on /api/llm/proxy               │
│  F3: Intermittent 503 from PostgreSQL                │
│  F4: WebSocket disconnect during P2P communication   │
└──────────────────────────────────────────────────────┘

┌─ Resource Faults ───────────────────────────────────┐
│  F5: localStorage quota exceeded (> 5MB)             │
│  F6: IndexedDB corruption (Phase 8 knowledge graph)  │
│  F7: Web Worker crash during TF.js training          │
│  F8: SharedArrayBuffer unavailable (COOP/COEP)       │
└──────────────────────────────────────────────────────┘

┌─ Application Faults ────────────────────────────────┐
│  F9: DAG cycle injected at runtime                   │
│  F10: Malformed LLM API response (non-JSON)          │
│  F11: Agent state machine invalid transition         │
│  F12: CRDT merge conflict (Phase 9 shared memory)    │
└──────────────────────────────────────────────────────┘
```

### 1.7 CI/CD Pipeline Integration / CI/CD 管线集成

```yaml
# Recommended pipeline stages / 推荐管线阶段:

Stage 1: Gate (每次 Push / Every Push)
  ├── tsc --noEmit (Type Check)
  ├── biome check (Lint + Format)
  └── knip (Dead Code)

Stage 2: Test (每次 PR / Every PR)
  ├── vitest run --coverage (Unit + Integration)
  ├── Coverage threshold: 80% lines, 75% branches
  └── MSW mock server for API tests

Stage 3: Quality (每日构建 / Nightly Build)
  ├── Playwright E2E (Critical journeys E1-E3)
  ├── Lighthouse CI (Performance budgets)
  └── npm audit (Security)

Stage 4: Chaos (每周 / Weekly — Phase 8+)
  ├── Fault injection suite
  ├── Memory leak detection
  └── Agent recovery validation
```

---

## 2. TypeScript Full Type Definitions / TypeScript 全量类型定义

### 2.1 Current Type Inventory / 现有类型清单

```
Type Definition Map / 类型定义分布图:

/types/
├── index.ts              — Domain types (LLMConfig, MessageContent, etc.)
├── database.ts           — Supabase/PG schema types
└── speech.d.ts           — Web Speech API ambient declarations

/lib/pg-api.ts (inline)   — API types (AuthUser, ApiResponse, WorkflowRow, etc.)
/stores/*.ts (inline)     — Store-specific types (PanelId, ThemeColor, etc.)
/utils/dag-engine.ts      — DAG execution types (DAGNode, ExecutionContext, etc.)
```

### 2.2 Type Architecture: Layered Namespace / 分层命名空间

```typescript
/**
 * Recommended type architecture for Phase 8-10
 * 推荐的 Phase 8-10 类型架构
 *
 * /types/
 * ├── core.ts          — Brand-level primitives
 * ├── domain.ts        — Business domain (LLM, Workflow, etc.)  ← current index.ts
 * ├── database.ts      — PG schema                              ← current database.ts
 * ├── api.ts           — API request/response contracts          ← extract from pg-api.ts
 * ├── agent.ts         — Phase 8: Agent system types
 * ├── p2p.ts           — Phase 9: P2P & collaboration types
 * ├── evolution.ts     — Phase 10: Digital life types
 * └── _internal.ts     — Private utility types (branded types, etc.)
 */
```

### 2.3 Phase 8 Type Definitions / Phase 8 类型定义

```typescript
// ================================================================
// types/agent.ts — Phase 8: 自主自治系统类型定义
// Autonomous System Type Definitions
// ================================================================

// ── N8.1: Agent Core Engine / 智能体核心引擎 ──

/** Agent 生命周期状态 / Agent Lifecycle State */
export type AgentState =
  | 'initializing'  // 初始化中
  | 'idle'          // 空闲
  | 'sensing'       // 感知中
  | 'thinking'      // 思考/推理中
  | 'acting'        // 执行中
  | 'learning'      // 学习中
  | 'healing'       // 自愈中
  | 'suspended'     // 挂起
  | 'terminated';   // 已终止

/** Agent 状态转换事件 / State Transition Event */
export type AgentEvent =
  | { type: 'START' }
  | { type: 'PERCEIVE'; payload: PerceptionInput }
  | { type: 'DECIDE'; payload: DecisionRequest }
  | { type: 'ACT'; payload: ActionCommand }
  | { type: 'LEARN'; payload: Experience }
  | { type: 'FAULT_DETECTED'; payload: FaultInfo }
  | { type: 'HEAL_COMPLETE'; payload: HealResult }
  | { type: 'SUSPEND' }
  | { type: 'RESUME' }
  | { type: 'TERMINATE' };

/** Agent 感知输入 / Perception Input */
export interface PerceptionInput {
  source: 'user' | 'environment' | 'agent' | 'system';
  modality: 'text' | 'gesture' | 'gaze' | 'voice' | 'sensor';
  data: unknown;
  timestamp: number;
  confidence: number; // 0-1
}

/** Agent 能力接口 / Capability Interface */
export interface IAgentCapability {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'perception' | 'cognition' | 'action';
  initialize(): Promise<void>;
  execute(input: unknown): Promise<unknown>;
  dispose(): void;
}

/** Agent 上下文模型 / Context Model */
export interface AgentContext {
  spatial: {
    viewport: { width: number; height: number };
    scrollPosition: { x: number; y: number };
    focusElement: string | null;
  };
  temporal: {
    sessionStart: number;
    currentTime: number;
    idleDuration: number;
    interactionCount: number;
  };
  social: {
    userId: string;
    userName: string;
    preferences: Record<string, unknown>;
    interactionHistory: InteractionRecord[];
  };
  environmental: {
    networkStatus: 'online' | 'offline' | 'slow';
    deviceType: 'desktop' | 'tablet' | 'mobile';
    colorScheme: 'light' | 'dark';
    reducedMotion: boolean;
    batteryLevel?: number;
  };
}

/** Agent 运行时接口 / Runtime Interface (IAgentRuntime) */
export interface IAgentRuntime {
  readonly id: string;
  readonly state: AgentState;
  readonly capabilities: ReadonlyMap<string, IAgentCapability>;
  readonly context: Readonly<AgentContext>;

  // Lifecycle / 生命周期
  start(): Promise<void>;
  suspend(): void;
  resume(): void;
  terminate(): void;

  // Capability / 能力管理
  registerCapability(cap: IAgentCapability): void;
  unregisterCapability(capId: string): void;

  // Event / 事件
  dispatch(event: AgentEvent): void;
  subscribe(handler: (event: AgentEvent, state: AgentState) => void): () => void;

  // Context / 上下文
  updateContext(partial: DeepPartial<AgentContext>): void;
}

// ── N8.2: Self-Learning / 自学习系统 ──

/** 经验记录 / Experience Record */
export interface Experience {
  id: string;
  state: unknown;       // 状态快照
  action: string;       // 采取的动作
  reward: number;       // 奖励值
  nextState: unknown;   // 下一状态
  done: boolean;        // 是否结束
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** 经验回放缓冲区配置 / Replay Buffer Config */
export interface ReplayBufferConfig {
  capacity: number;           // 最大容量
  batchSize: number;          // 采样批量大小
  prioritized: boolean;       // 是否使用优先级采样
  alpha?: number;             // 优先级指数 (PER)
  beta?: number;              // 重要性采样指数 (PER)
}

/** 训练配置 / Training Config */
export interface TrainingConfig {
  algorithm: 'dqn' | 'ppo' | 'a3c';
  learningRate: number;
  discountFactor: number;       // gamma
  epsilon: number;              // exploration rate
  epsilonDecay: number;
  epsilonMin: number;
  targetUpdateFreq: number;     // steps between target network sync
  maxEpisodes: number;
  replayBuffer: ReplayBufferConfig;
}

/** 训练结果 / Training Result */
export interface TrainingResult {
  episode: number;
  totalReward: number;
  averageLoss: number;
  epsilon: number;
  duration_ms: number;
  converged: boolean;
}

// ── N8.3: Self-Healing / 自愈机制 ──

/** 健康指标 / Health Metric */
export interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  threshold: { warning: number; critical: number };
  timestamp: number;
}

/** 故障信息 / Fault Info */
export interface FaultInfo {
  id: string;
  type: 'memory_leak' | 'cpu_spike' | 'api_timeout' | 'state_corruption' | 'render_crash';
  severity: 'warning' | 'critical' | 'fatal';
  detectedAt: number;
  metrics: HealthMetric[];
  stackTrace?: string;
}

/** 恢复策略 / Recovery Strategy */
export type RecoveryStrategy =
  | { type: 'restart'; scope: 'component' | 'agent' | 'system' }
  | { type: 'rollback'; snapshotId: string }
  | { type: 'degrade'; disabledFeatures: string[] }
  | { type: 'cache'; ttl: number }
  | { type: 'failover'; targetAgentId: string };

/** 自愈结果 / Heal Result */
export interface HealResult {
  faultId: string;
  strategy: RecoveryStrategy;
  success: boolean;
  duration_ms: number;
  dataLoss: boolean;
}

/** 状态快照 / State Snapshot */
export interface StateSnapshot {
  id: string;
  agentId: string;
  version: number;
  state: unknown;
  checksum: string;
  createdAt: number;
  sizeBytes: number;
}

// ── N8.4: Adaptive Decision / 自适应决策 ──

export interface DecisionRequest {
  context: AgentContext;
  options: DecisionOption[];
  deadline_ms?: number;
}

export interface DecisionOption {
  id: string;
  action: string;
  predictedReward: number;
  confidence: number;
  cost: number;  // computational cost estimate
}

export interface DecisionResult {
  selectedOption: DecisionOption;
  reasoning: string;
  modelVersion: string;
  latency_ms: number;
}

// ── N8.5: Knowledge Graph / 知识图谱 ──

export interface KGEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  embedding?: Float32Array;    // vector embedding
  createdAt: number;
  updatedAt: number;
}

export interface KGRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;              // 0-1 confidence
  properties?: Record<string, unknown>;
}

export interface KGQuery {
  type: 'entity' | 'relation' | 'path' | 'similarity';
  params: Record<string, unknown>;
  limit?: number;
  includeEmbeddings?: boolean;
}

export interface KGQueryResult {
  entities: KGEntity[];
  relations: KGRelation[];
  paths?: KGEntity[][];        // for path queries
  scores?: number[];           // for similarity queries
  executionTime_ms: number;
}

// ── Utility Types / 工具类型 ──

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type InteractionRecord = {
  type: string;
  timestamp: number;
  data: unknown;
};
```

### 2.4 Phase 9 Type Definitions / Phase 9 类型定义

```typescript
// ================================================================
// types/p2p.ts — Phase 9: 协同进化系统类型定义
// Collaborative Evolution Type Definitions
// ================================================================

// ── N9.1: Collaboration Framework / 协同框架 ──

/** P2P 消息类型 / Message Type */
export type P2PMessageType =
  | 'heartbeat'
  | 'discovery'
  | 'task_assign'
  | 'task_result'
  | 'knowledge_sync'
  | 'vote'
  | 'consensus';

/** P2P 消息优先级 / Message Priority */
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface P2PMessage<T = unknown> {
  id: string;
  type: P2PMessageType;
  priority: MessagePriority;
  senderId: string;
  receiverId: string | '*';   // '*' = broadcast
  payload: T;
  timestamp: number;
  ttl: number;                 // Time-to-live in ms
  signature?: string;          // E2E encryption signature
}

/** 服务发现记录 / Service Discovery Record */
export interface ServiceRecord {
  agentId: string;
  capabilities: string[];
  load: number;                // 0-1 current load
  lastHeartbeat: number;
  endpoint: string;
  publicKey?: string;
}

// ── N9.2: Task Scheduling / 任务调度 ──

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'migrating';

export interface TaskNode {
  id: string;
  name: string;
  type: string;
  dependencies: string[];      // Task IDs this depends on
  assignedAgent?: string;
  status: TaskStatus;
  priority: number;            // Higher = more urgent
  estimatedCost: number;       // Computational cost estimate
  deadline?: number;           // Unix timestamp
  input: unknown;
  output?: unknown;
  retryCount: number;
  maxRetries: number;
}

export interface TaskGraph {
  id: string;
  name: string;
  tasks: TaskNode[];
  createdAt: number;
  completedAt?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ── N9.3: Shared Memory / 共享记忆 ──

/** CRDT 操作类型 / CRDT Operation Type */
export type CRDTOperation =
  | { type: 'set'; key: string; value: unknown; clock: VectorClock }
  | { type: 'delete'; key: string; clock: VectorClock }
  | { type: 'merge'; operations: CRDTOperation[] };

export interface VectorClock {
  [agentId: string]: number;
}

export interface SyncState {
  localVersion: VectorClock;
  remoteVersions: Record<string, VectorClock>;
  pendingOps: CRDTOperation[];
  lastSyncAt: number;
  conflictsResolved: number;
}

// ── N9.4: Emergence / 涌现机制 ──

export interface SwarmAgent {
  id: string;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  state: Record<string, number>;
  neighbors: string[];
  fitness: number;
}

export interface EmergencePattern {
  id: string;
  type: 'clustering' | 'synchronization' | 'specialization' | 'hierarchy' | 'oscillation';
  confidence: number;
  involvedAgents: string[];
  detectedAt: number;
  properties: Record<string, unknown>;
}
```

### 2.5 Phase 10 Type Definitions / Phase 10 类型定义

```typescript
// ================================================================
// types/evolution.ts — Phase 10: 数字生命体类型定义
// Digital Life Form Type Definitions
// ================================================================

/** 基因组 / Genome */
export interface Genome {
  id: string;
  genes: Gene[];
  fitness: number;
  generation: number;
  parentIds: [string, string] | [string]; // sexual or asexual
  mutations: Mutation[];
  createdAt: number;
}

export interface Gene {
  locus: string;             // Gene position identifier
  alleles: [number, number]; // Diploid representation
  dominance: 'dominant' | 'recessive' | 'codominant';
  expressionLevel: number;   // 0-1
}

export interface Mutation {
  geneId: string;
  type: 'point' | 'insertion' | 'deletion' | 'inversion';
  position: number;
  originalValue: number;
  newValue: number;
}

/** 数字生命体 / Digital Life Form */
export interface DigitalLifeForm {
  id: string;
  genome: Genome;
  phenotype: Phenotype;
  lifecycle: LifecycleState;
  consciousness: ConsciousnessLevel;
  memories: string[];          // Knowledge graph entity IDs
  socialBonds: SocialBond[];
  birthTimestamp: number;
  deathTimestamp?: number;
}

export interface Phenotype {
  traits: Record<string, number>;   // Expressed characteristics
  appearance: {
    colorHue: number;               // 0-360
    size: number;                    // Relative scale
    complexity: number;             // Visual complexity
    luminosity: number;             // Glow intensity
  };
  capabilities: string[];           // Active capability IDs
  behaviorProfile: 'explorer' | 'social' | 'specialist' | 'guardian' | 'creator';
}

export type LifecycleState =
  | 'embryo'        // 胚胎期
  | 'juvenile'      // 幼年期
  | 'adult'         // 成年期
  | 'elder'         // 老年期
  | 'transcended'   // 超越态
  | 'deceased';     // 已亡

export type ConsciousnessLevel =
  | 'reactive'      // 反应式 — stimulus-response only
  | 'adaptive'      // 适应式 — learns from experience
  | 'predictive'    // 预测式 — anticipates future states
  | 'reflective'    // 反思式 — models own cognition
  | 'creative';     // 创造式 — generates novel solutions

export interface SocialBond {
  partnerId: string;
  type: 'kin' | 'mate' | 'ally' | 'mentor' | 'rival';
  strength: number;   // 0-1
  formedAt: number;
}
```

### 2.6 Type Quality Metrics / 类型质量指标

| Metric / 指标 | Current / 现值 | Target / 目标 | Method / 方法 |
|---|---|---|---|
| `strict: true` coverage | partial | 100% | `tsconfig.json` |
| `any` usage count | ~15 | < 5 (only FFI boundaries) | `no-explicit-any` rule |
| Exported type documentation (JSDoc) | ~30% | > 90% | `eslint-plugin-jsdoc` |
| `Record<string, any>` occurrences | ~12 | < 3 | Replace with branded types |
| Type test coverage (type-level assertions) | 0 | > 50 types | `tsd` or `expect-type` |

---

## 3. MVP Definition Expansion / MVP 定义拓展

### 3.1 MVP Maturity Model / MVP 成熟度模型

```
MVP Evolution Framework / MVP 演进框架:

  MVP-0 (Proof of Concept)    MVP-1 (Functional)    MVP-2 (Production)    MVP-3 (Ecosystem)
  ─────────────────────────────────────────────────────────────────────────────────────────
  │ Concept validation   │ Core features work │ Reliable + scalable │ Community + market │
  │ 概念验证              │ 核心功能可用       │ 可靠 + 可扩展       │ 社区 + 市场        │
  │ Mock data            │ Real API calls     │ Error handling       │ Plugin system      │
  │ Single user          │ Auth + persistence │ Multi-user           │ Multi-tenant       │
  │ Happy path only      │ Edge cases         │ Chaos resilient      │ Self-evolving      │
  ─────────────────────────────────────────────────────────────────────────────────────────
       Phase 1-3               Phase 4-7            Phase 8-9              Phase 10
      ← COMPLETED →          ← COMPLETED →       ← IN PROGRESS →        ← PLANNED →
```

### 3.2 Per-Phase MVP Definitions / 各阶段 MVP 定义

#### Phase 8 MVP Slices / Phase 8 MVP 切片

```
Phase 8 — MVP-2a: "Sentient Core / 感知核心"

Must Have (P0):
├── AgentRuntime with 3 states: idle → sensing → acting
├── Single-agent self-healing: auto-restart on crash
├── Experience replay buffer (IndexedDB, DQN only)
├── Basic health monitoring (memory + heartbeat)
└── Knowledge graph: entity CRUD + simple search

Should Have (P1):
├── Full state machine (all 9 states)
├── PPO algorithm support
├── Adaptive decision engine (rule-based)
├── State snapshot + rollback
└── Vector embedding search

Could Have (P2):
├── A3C distributed training
├── Transfer learning across agents
├── Multi-model knowledge reasoning
└── Predictive self-healing

Will Not Have (this phase):
├── Multi-agent communication
├── P2P networking
├── Plugin system
└── Digital life reproduction
```

#### Phase 9 MVP Slices / Phase 9 MVP 切片

```
Phase 9 — MVP-2b: "Hive Mind / 蜂巢意识"

Must Have (P0):
├── 2-agent P2P messaging (same browser, Web Worker)
├── Task graph with topological execution
├── CRDT-based shared key-value store
├── Basic swarm behavior simulation (flocking)
└── Cooperative fault detection (heartbeat-based)

Should Have (P1):
├── Cross-tab P2P via BroadcastChannel
├── Dynamic task migration
├── Conflict resolution UI
├── Emergence pattern detection
└── Cooperative recovery strategies

Could Have (P2):
├── Cross-device WebRTC P2P
├── NAT traversal
├── Plugin marketplace
├── Community features
└── Incentive/reputation system
```

#### Phase 10 MVP Slices / Phase 10 MVP 切片

```
Phase 10 — MVP-3: "Genesis / 创世纪"

Must Have (P0):
├── Genetic algorithm with selection + crossover + mutation
├── Simple phenotype expression (visual traits)
├── Birth → Growth → Death lifecycle
├── Population size controller (Logistic model)
└── Lineage tree visualization

Should Have (P1):
├── Sexual reproduction (two-parent crossover)
├── Diversity index maintenance
├── Neural structure evolution (NeuroEvolution)
├── Consciousness level progression
└── Cross-device life form migration

Could Have (P2):
├── Cellular automata substrate
├── Social bond dynamics
├── Emergent culture/language
├── Self-modifying code generation
└── Ecosystem equilibrium simulation
```

### 3.3 MVP Validation Criteria / MVP 验证标准

```typescript
/**
 * MVP Gate Check / MVP 阶段门检查
 * Each MVP level must pass ALL criteria before advancing
 */
interface MVPGateCheck {
  level: 'MVP-0' | 'MVP-1' | 'MVP-2' | 'MVP-3';
  criteria: {
    // Technical / 技术
    unitTestCoverage: number;          // MVP-0: 0%, MVP-1: 60%, MVP-2: 80%, MVP-3: 90%
    integrationTestPass: boolean;      // MVP-1+
    e2eTestPass: boolean;              // MVP-2+
    performanceBudget: boolean;        // MVP-2+

    // Product / 产品
    coreJourneyComplete: boolean;      // Can a user complete the primary task?
    errorHandlingGraceful: boolean;    // MVP-1+: No unhandled crashes
    offlineDegradation: boolean;       // MVP-2+: Works without network

    // Documentation / 文档
    apiDocumented: boolean;            // MVP-1+
    deploymentGuide: boolean;          // MVP-2+
    contributorGuide: boolean;         // MVP-3+
  };
}
```

---

## 4. Big Data Analysis Direction / 大数据分析方向

### 4.1 Data Landscape / 数据全景

```
YYC³ Data Flow Architecture / 数据流架构:

┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES / 数据源                        │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ User     │ Agent    │ Workflow │ Knowledge│ P2P      │ Evolution   │
│ Behavior │ Telemetry│ Runs     │ Graph    │ Messages │ Genetics    │
│ 用户行为  │ Agent遥测│ 工作流运行│ 知识图谱  │ P2P消息   │ 遗传数据    │
├──────────┴──────────┴──────────┴──────────┴──────────┴─────────────┤
│                     DATA PIPELINE / 数据管线                        │
│  Collect → Clean → Transform → Store → Analyze → Visualize        │
│  采集    → 清洗  → 转换      → 存储  → 分析    → 可视化            │
├───────────────────────────────────────────────────────────────────-─┤
│                    ANALYSIS DOMAINS / 分析域                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │ Behavioral  │ │ Performance │ │ Evolutionary│ │ Predictive   │ │
│  │ Analytics   │ │ Analytics   │ │ Analytics   │ │ Analytics    │ │
│  │ 行为分析    │ │ 性能分析    │ │ 演化分析    │ │ 预测分析     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Domain 1: Behavioral Analytics / 行为分析

**Data Points / 数据采集点:**

| Event / 事件 | Fields / 字段 | Volume / 量级 | Storage |
|---|---|---|---|
| Gesture performed | type, position, duration, velocity | ~100/session | PG |
| Panel navigation | from, to, trigger, timestamp | ~50/session | PG |
| Workflow execution | workflowId, nodes, duration, result | ~10/day | PG |
| LLM query | provider, model, tokens, latency, quality_score | ~50/day | PG |
| Theme/config change | field, oldValue, newValue | ~5/session | PG |
| Error occurrence | component, message, stack, severity | ~varies | PG + ELK |

**Analysis Outputs / 分析产出:**

```
Behavioral Insights / 行为洞察:

1. User Journey Funnel / 用户旅程漏斗
   AuthGate → Home → [Which panel?] → [Action?] → [Outcome?]
   → Identify drop-off points, optimize UX

2. Feature Usage Heatmap / 功能使用热力图
   Which panels are most/least used?
   Which workflow templates are most popular?
   Which LLM providers get the best quality scores?

3. Interaction Pattern Clustering / 交互模式聚类
   K-means on gesture sequences → discover user archetypes
   "Power User" vs "Explorer" vs "Focused Worker"

4. Session Quality Score / 会话质量评分
   Composite metric = f(task_completion, error_rate, engagement_time)
   Track over time → measure product improvement
```

### 4.3 Domain 2: Performance Analytics / 性能分析

```
Performance Data Model / 性能数据模型:

┌─────────────────────────────────────────────────┐
│ performance_metrics (TimeSeries)                 │
├─────────────────────────────────────────────────┤
│ timestamp     TIMESTAMPTZ                        │
│ metric_name   VARCHAR — e.g. 'lcp', 'fid', etc. │
│ value         FLOAT                              │
│ user_id       UUID                               │
│ session_id    UUID                               │
│ device_type   VARCHAR                            │
│ network_type  VARCHAR                            │
│ tags          JSONB                               │
└─────────────────────────────────────────────────┘

Key Analysis / 关键分析:

1. P95/P99 Latency Tracking / 延迟跟踪
   LLM API call latency by provider × model
   DAG execution time by node count × complexity
   → Identify regression, set SLOs

2. Resource Consumption Profiling / 资源消耗画像
   Memory usage curve over session duration
   CPU utilization during TF.js training
   IndexedDB storage growth rate
   → Predict resource exhaustion, trigger degradation

3. Anomaly Detection / 异常检测
   Statistical process control (SPC) on latency
   3-sigma alerting on error rates
   → Early warning system for production issues
```

### 4.4 Domain 3: Evolutionary Analytics / 演化分析 (Phase 10)

```
Evolutionary Data Model / 演化数据模型:

1. Fitness Landscape Mapping / 适应度景观映射
   ┌──────────────────────────────────┐
   │ Genome space (high-dimensional) │
   │ → PCA/t-SNE → 2D visualization │
   │ → Color by fitness score        │
   │ → Track population movement     │
   └──────────────────────────────────┘

2. Phylogenetic Tree / 系统发育树
   Track parent-child relationships across generations
   Identify successful lineages
   Measure genetic diversity over time (Shannon index)

3. Emergence Metrics / 涌现指标
   ┌────────────────────────────────────────────────────┐
   │ Metric              │ Formula                      │
   ├────────────────────────────────────────────────────┤
   │ Diversity Index     │ Shannon: H = -Σ pᵢ log(pᵢ)  │
   │ Clustering Coeff.   │ C = 2E / (k(k-1))            │
   │ Synchronization     │ Kuramoto order parameter r    │
   │ Specialization      │ Gini coefficient on skills    │
   │ Innovation Rate     │ Novel phenotypes / generation │
   └────────────────────────────────────────────────────┘
```

### 4.5 Domain 4: Predictive Analytics / 预测分析

```
Predictive Models / 预测模型:

┌─────────────────────────────────────────────────────────────┐
│ Model 1: User Churn Prediction / 用户流失预测                │
│ Input: session_frequency, feature_usage, error_rate          │
│ Output: churn_probability (0-1)                              │
│ Method: Logistic Regression → XGBoost → LSTM                │
│ Action: Trigger engagement features for at-risk users       │
├─────────────────────────────────────────────────────────────┤
│ Model 2: Resource Demand Forecasting / 资源需求预测          │
│ Input: historical_load, time_of_day, active_agents           │
│ Output: predicted_cpu, predicted_memory                      │
│ Method: ARIMA → Prophet → Transformer                       │
│ Action: Pre-scale resources, defer training jobs             │
├─────────────────────────────────────────────────────────────┤
│ Model 3: Workflow Success Prediction / 工作流成功率预测       │
│ Input: node_count, edge_complexity, llm_provider, input_len  │
│ Output: success_probability, estimated_duration              │
│ Method: Random Forest → Neural Network                      │
│ Action: Warn user before running likely-to-fail workflows    │
├─────────────────────────────────────────────────────────────┤
│ Model 4: Evolution Trajectory / 演化轨迹预测                  │
│ Input: population_genomes, fitness_history, mutation_rates   │
│ Output: predicted_fitness_plateau, diversity_trajectory       │
│ Method: Gaussian Process → Evolutionary Dynamics Simulation  │
│ Action: Auto-adjust mutation rates to avoid local optima     │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Technology Stack Recommendation / 技术栈推荐

```
Big Data Technology Stack / 大数据技术栈:

Layer 1: Collection / 采集层
├── Client-side: Custom event SDK → batch to API
├── Server-side: Express middleware → event stream
└── Structured logging: Pino (JSON) → stdout

Layer 2: Transport / 传输层
├── Near-term: PostgreSQL direct insert (current architecture)
├── Mid-term: Apache Kafka / Redpanda (event streaming)
└── Alternative: ClickHouse HTTP API (for time-series)

Layer 3: Storage / 存储层
├── Operational: PostgreSQL 15 (current — OLTP)
├── Analytical: ClickHouse or Apache Druid (OLAP)
├── Knowledge: Neo4j / Apache AGE (graph database)
├── Vectors: pgvector extension or Milvus (embeddings)
└── Files: MinIO (S3-compatible, NAS-hosted)

Layer 4: Processing / 处理层
├── Batch: Apache Spark (PySpark) or DuckDB (lightweight)
├── Stream: Flink or Kafka Streams
├── ML Pipeline: MLflow + scikit-learn + PyTorch
└── Browser-side: TF.js (inference only)

Layer 5: Visualization / 可视化层
├── Dashboards: Grafana (metrics) + Apache Superset (BI)
├── Notebooks: Jupyter + Plotly
├── In-app: Recharts (current) + D3.js (Phase 9 emergence)
└── Real-time: WebSocket → custom React components
```

### 4.7 Data Governance / 数据治理

| Concern / 关注点 | Policy / 策略 |
|---|---|
| **PII Protection** | No PII in analytics tables; user_id is pseudonymized UUID |
| **Data Retention** | Raw events: 90 days → aggregate → archive (1 year) → delete |
| **Access Control** | Role-based: admin (full), analyst (read aggregates), user (own data) |
| **Consent** | Telemetry opt-in toggle in ConfigPanel; off by default |
| **Audit Trail** | All data access logged with requester, timestamp, query |
| **GDPR/Privacy** | Data export API (`GET /api/me/data`), delete API (`DELETE /api/me`) |

---

## 5. Cross-Cutting Concerns / 横切关注点

### 5.1 Testing ↔ Types Synergy / 测试与类型协同

```typescript
// Use type-level testing to ensure types are correct
// 使用类型级测试确保类型正确

import { expectTypeOf } from 'expect-type';
import type { AgentState, AgentEvent, IAgentRuntime } from '@/types/agent';

// Ensure AgentState is a finite union, not string
expectTypeOf<AgentState>().not.toBeString();

// Ensure IAgentRuntime.dispatch accepts all AgentEvent variants
expectTypeOf<IAgentRuntime['dispatch']>()
  .parameter(0)
  .toEqualTypeOf<AgentEvent>();

// Ensure RecoveryStrategy is exhaustive in switch
// (TypeScript exhaustiveness checking handles this at compile time)
```

### 5.2 MVP ↔ Testing Mapping / MVP 与测试映射

| MVP Level | Test Requirements | Minimum Coverage |
|---|---|---|
| MVP-0 | Manual testing only | 0% automated |
| MVP-1 | Unit tests for core logic | 60% lines |
| MVP-2 | Unit + Integration + E2E for critical paths | 80% lines |
| MVP-3 | Full pyramid + chaos + performance | 90% lines |

### 5.3 Big Data ↔ MVP Feedback Loop / 大数据与 MVP 反馈环

```
Data-Driven MVP Evolution / 数据驱动 MVP 演进:

  MVP Release → Collect Telemetry → Analyze Patterns → Prioritize Features
       ↑                                                      │
       └──────────────── Next MVP Iteration ←─────────────────┘

Example cycle / 示例循环:
  1. MVP-2a ships Agent runtime
  2. Telemetry shows 60% users trigger self-healing within 10min
  3. Analysis: memory leak in KnowledgeGraph module
  4. MVP-2a.1 patches leak, adds memory profiling
  5. Telemetry shows MTTR improved from 8min → 2min
  6. Proceed to MVP-2b (P2P features)
```

---

> **YanYuCloudCube**
> Words Initiate Quadrants, Language Serves as Core for the Future
> All things converge in the cloud pivot; Deep stacks ignite a new era of intelligence