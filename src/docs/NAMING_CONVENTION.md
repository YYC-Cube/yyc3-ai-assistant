# YanYuCloudCube - Variable & Naming Convention Guide
# YanYuCloudCube - 变量与命名范式指导文档

**Version / 版本:** 1.0  
**Date / 日期:** 2026-02-14  
**Scope / 范围:** All `YYC3`/`yyc3`/`YYC³` identifiers across the entire codebase  
**Brand Name / 品牌名:** YanYuCloudCube (万象归元于云枢丨深栈智启新纪元)

---

## 1. Naming Paradigm / 命名范式总则

### 1.1 Brand Identity Mapping / 品牌标识映射

| Context / 上下文 | Legacy / 旧名 | Current / 现名 | Rule / 规则 |
|---|---|---|---|
| **UI Display (user-facing)** | `YYC³` / `YYC3` | `YanYuCloudCube` | MUST change |
| **Chinese Tagline** | `神经访问协议 // 言语云魔方` | `万象归元于云枢丨深栈智启新纪元` | MUST change |
| **Code Variable Names** | `YYC3_DESIGN` | `YYC3_DESIGN` | KEEP (see Section 2) |
| **Component Names** | `YYC3Background` | `YYC3Background` | KEEP (see Section 2) |
| **localStorage Keys** | `yyc3_jwt` | `yyc3_jwt` | KEEP (see Section 3) |
| **Database Name** | `yyc3` | `yyc3` | KEEP (see Section 4) |
| **Comment / Docstring** | `YYC3 Auth Store` | Either | OPTIONAL |

### 1.2 Core Principle / 核心原则

```
UI-facing text → YanYuCloudCube     (品牌文本必须更新)
Code internals → yyc3 / YYC3       (代码标识符保持稳定，避免重构风险)
Storage keys   → yyc3_*            (存储键保持稳定，避免用户数据丢失)
Infrastructure → yyc3              (数据库/目录名保持稳定)
```

> **Rationale / 理由:** Code identifiers (`YYC3_DESIGN`, `YYC3Background`) and storage keys (`yyc3_jwt`) are internal implementation details invisible to users. Renaming them carries refactoring risk (broken imports, lost user sessions, migration scripts needed) with zero user-visible benefit. Only **user-facing display text** needs to reflect the brand update.

---

## 2. Code Identifiers / 代码标识符

### 2.1 Variable & Constant Names / 变量与常量

| Identifier | File | Line | Category | Decision |
|---|---|---|---|---|
| `YYC3_DESIGN` | `/utils/design-system.ts` | 1 | Exported const | **KEEP** |
| `YYC3_DESIGN.physics.spring` | Multiple `.tsx` files | - | Property access | **KEEP** |
| `YYC3_DESIGN.blur.glass` | `/components/ai/MultimodalArtifact.tsx` | 96 | Property access | **KEEP** |
| `YYC3_DESIGN.colors.*` | (various) | - | Property access | **KEEP** |

**Reason / 理由:** `YYC3_DESIGN` is the design token system exported from `design-system.ts` and imported across 4+ component files. Renaming requires updating every import site and all property accesses — pure refactoring noise.

**If renamed (future):** Use `YYCC_DESIGN` or `CUBE_DESIGN`:
```typescript
// design-system.ts
export const YYCC_DESIGN = { ... };  // or export { YYCC_DESIGN as YYC3_DESIGN }
```

### 2.2 Component Names / 组件名

| Component | File Path | Import Sites | Decision |
|---|---|---|---|
| `YYC3Background` | `/components/YYC3Background.tsx` | `/components/ResponsiveAIAssistant.tsx` | **KEEP** |

**Reason / 理由:** Component name is an internal identifier. File name change would require import path updates. The component is already branded visually (ASCII art content already displays `YanYuCloudCube` since it was updated in a previous edit).

**If renamed (future):** Rename both file and component:
```
/components/YYC3Background.tsx → /components/CubeBackground.tsx
export function CubeBackground() { ... }
```

### 2.3 Data Transfer Types / 数据传输类型

| Identifier | Files | Decision |
|---|---|---|
| `'application/yyc3-node-type'` | `/components/modules/WorkflowPanel.tsx:116` | **KEEP** |
| `'application/yyc3-node-type'` | `/components/workflow/NodePalette.tsx:110` | **KEEP** |

**Reason / 理由:** This is a custom MIME type used in HTML5 drag-and-drop `dataTransfer`. It's invisible to users and only consumed internally between `NodePalette` (drag source) and `WorkflowPanel` (drop target). Both files must use the exact same string — changing one without the other breaks drag-and-drop.

**If renamed (future):** Update BOTH files simultaneously:
```typescript
// NodePalette.tsx
e.dataTransfer.setData('application/yycc-node-type', type);

// WorkflowPanel.tsx
const type = event.dataTransfer.getData('application/yycc-node-type');
```

---

## 3. Storage Keys / 存储键

### 3.1 localStorage Keys / 本地存储键

| Key | File | Line | Purpose | Decision |
|---|---|---|---|---|
| `yyc3_jwt` | `/lib/pg-api.ts` | 22 | JWT authentication token | **KEEP** |
| `yyc3_offline_user` | `/lib/pg-api.ts` | 385 | Offline user cache | **KEEP** |
| `yyc3_offline_configs` | `/lib/pg-api.ts` | 386 | Offline AI config cache | **KEEP** |
| `yyc3_offline_theme` | `/lib/pg-api.ts` | 387 | Theme preference cache | **KEEP** |
| `yyc3_offline_workflows` | `/lib/pg-api.ts` | 388 | Offline workflow cache | **KEEP** |
| `yyc3_pending_sync` | `/lib/pg-api.ts` | 389 | Pending sync queue | **KEEP** |
| `yyc_config` | `/stores/config-store.ts` | 136, 228 | Legacy config migration key | **KEEP** |

**CRITICAL / 严重警告:**

> Renaming localStorage keys will **immediately invalidate all existing user sessions** and **lose all offline cached data**. Existing users will be logged out and lose their locally stored configs, workflows, and pending sync actions.

**If renamed (future):** Requires a migration function:
```typescript
// Migration helper (run once on app init)
function migrateStorageKeys() {
    const OLD_PREFIX = 'yyc3_';
    const NEW_PREFIX = 'yycc_';
    const keys = ['jwt', 'offline_user', 'offline_configs', 'offline_theme', 
                  'offline_workflows', 'pending_sync'];
    
    keys.forEach(key => {
        const oldKey = OLD_PREFIX + key;
        const newKey = NEW_PREFIX + key;
        const value = localStorage.getItem(oldKey);
        if (value && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, value);
            localStorage.removeItem(oldKey);
            console.log(`[Migration] ${oldKey} → ${newKey}`);
        }
    });
}
```

### 3.2 Key Naming Convention / 键命名约定

All localStorage keys follow the pattern:

```
{project_prefix}_{domain}_{purpose}

yyc3          _offline  _user
yyc3          _offline  _configs
yyc3          _         jwt
yyc3          _pending  _sync
```

**For new keys, continue using `yyc3_` prefix** to maintain consistency:
```
yyc3_offline_runs        (future: cached run history)
yyc3_canvas_state        (future: unsaved canvas snapshot)
yyc3_preferences         (future: UI preferences)
```

---

## 4. Infrastructure Names / 基础设施名称

### 4.1 Database / 数据库

| Identifier | File | Decision |
|---|---|---|
| Database name: `yyc3` | `/server/README_SERVER.ts:30,39,40,97` | **KEEP** |
| Schema: `auth`, `public` | `/supabase/schema.sql` | **KEEP** |

**Reason / 理由:** Database name is an infrastructure constant. Renaming requires:
- Re-creating the database
- Migrating all data
- Updating `.env` on every deployment
- Updating all documentation

### 4.2 Server Project Directory / 服务器项目目录

| Identifier | File | Line | Decision |
|---|---|---|---|
| `yyc3-api` | `/server/README_SERVER.ts` | 18 | **KEEP** (docs only) |

### 4.3 JWT Secret Prefix / JWT 密钥前缀

| Identifier | File | Line | Decision |
|---|---|---|---|
| `yyc3_dev_secret_change_me` | `/server/README_SERVER.ts` | 88 | **KEEP** (default only, overridden by `.env`) |

### 4.4 API Version String / API 版本字符串

| Identifier | File | Line | Decision |
|---|---|---|---|
| `YYC3.API.V1` | `/server/README_SERVER.ts` | 158 | **OPTIONAL** (returned in health check JSON) |

---

## 5. UI Display Text / 用户界面显示文本

### 5.1 Already Updated / 已更新

| Location | Old | New | Status |
|---|---|---|---|
| AuthGate Title | `YYC<sup>3</sup>` | `YanYuCloudCube` | DONE |
| AuthGate Subtitle | `神经访问协议 // 言语云魔方` | `万象归元于云枢丨深栈智启新纪元` | DONE |
| AuthGate Footer | `YYC3.AUTH_GATE.V1` | `YanYuCloudCube.AUTH_GATE.V1` | DONE |
| Background ASCII | (old ASCII art) | Shows `YanYuCloudCube` | DONE |

### 5.2 Pending Update / 待更新

| Location | File | Line | Current Text | Suggested Update |
|---|---|---|---|---|
| Server Banner | `README_SERVER.ts` | 623 | `YYC³ Neural API Server` | `YanYuCloudCube Neural API Server` |
| Server Banner | `README_SERVER.ts` | 624 | `言语云魔方 - 本地 API 服务器` | `万象归元于云枢 - 本地 API 服务器` |

### 5.3 Logo Assets / Logo 资源已集成

| Asset | Import Path | Usage | Size |
|---|---|---|---|
| Large Shield Logo | `figma:asset/a17136671265d3dca3711f5fa4eafc72f4142621.png` | AuthGate title area (96px) | High-res |
| Medium Shield Logo | `figma:asset/5059f251bcc7a85ef1ff973bedbc996f48085339.png` | AuthGate loading spinner (64px) | Medium |
| Mini Shield Logo | `figma:asset/0f4f28ac8ee9261af0049b986719468fb0b2a075.png` | HUD top-left brand mark (20px) | Thumbnail |

**Color optimization / 颜色优化:**
- `drop-shadow(0 0 12px rgba(34,211,238,0.5))` — cyan glow matching project theme
- Red theme mode: `hue-rotate(160deg) saturate(1.2)` applied via CSS filter
- AuthGate: pulsing `bg-cyan-500/10 blur-xl` ring behind logo

**How to update these / 更新方法:**

```bash
# These are purely cosmetic UI text changes.
# Update each line in the respective file.
# No import/export changes needed.
```

---

## 6. Comment & Docstring Text / 注释与文档字符串

### 6.1 File Header Comments / 文件头注释

| File | Current Header | Decision |
|---|---|---|
| `/lib/pg-api.ts` | `YYC3 PostgreSQL REST API Client` | OPTIONAL |
| `/stores/auth-store.ts` | `YYC3 Auth Store (Zustand)` | OPTIONAL |
| `/stores/config-store.ts` | `YYC3 Config Store (Zustand)` | OPTIONAL |
| `/stores/app-store.ts` | `YYC3 App Store (Zustand)` | OPTIONAL |
| `/stores/workflow-store.ts` | `YYC3 Workflow Store (Zustand)` | OPTIONAL |
| `/utils/dag-engine.ts` | `YYC3 DAG Execution Engine V2` | OPTIONAL |
| `/types/index.ts` | `YYC3 Domain Type Definitions` | OPTIONAL |
| `/server/README_SERVER.ts` | `YYC3 本地 API 服务器蓝图` | OPTIONAL |

**Reason / 理由:** Comments are non-functional. Updating them is a low-risk cosmetic change that can be done at any time. If updated, use `YanYuCloudCube` consistently.

**Batch update pattern / 批量更新模式:**
```
Old: * YYC3 Auth Store (Zustand)
     * 言语云魔方 - 鉴权全局状态管理

New: * YanYuCloudCube Auth Store (Zustand)
     * 万象归元于云枢 - 鉴权全局状态管理
```

---

## 7. Complete Identifier Registry / 完整标识符注册表

### 7.1 Summary Table / 汇总表

| # | Identifier | Category | File(s) | Keep/Change | Risk |
|---|---|---|---|---|---|
| 1 | `YYC3_DESIGN` | Exported const | `design-system.ts` + 4 importers | **KEEP** | HIGH (4+ import sites) |
| 2 | `YYC3Background` | Component + filename | `YYC3Background.tsx` + 1 importer | **KEEP** | MEDIUM (file rename) |
| 3 | `application/yyc3-node-type` | DataTransfer MIME | `WorkflowPanel.tsx` + `NodePalette.tsx` | **KEEP** | MEDIUM (paired, breaks D&D) |
| 4 | `yyc3_jwt` | localStorage key | `pg-api.ts` | **KEEP** | CRITICAL (session loss) |
| 5 | `yyc3_offline_*` (5 keys) | localStorage keys | `pg-api.ts` | **KEEP** | CRITICAL (data loss) |
| 6 | `yyc_config` | localStorage key (legacy) | `config-store.ts` | **KEEP** | LOW (migration key) |
| 7 | `yyc3` (database) | PostgreSQL DB name | `README_SERVER.ts` | **KEEP** | HIGH (infra change) |
| 8 | `yyc3-api` | Directory name | `README_SERVER.ts` | **KEEP** | LOW (docs only) |
| 9 | `yyc3_dev_secret_*` | JWT secret default | `README_SERVER.ts` | **KEEP** | NONE (overridden by .env) |
| 10 | `YYC3.API.V1` | Health check response | `README_SERVER.ts` | **OPTIONAL** | NONE |
| 11 | `YYC³.CORE.V7` | UI HUD text | `ResponsiveAIAssistant.tsx` | **CHANGE** | NONE |
| 12 | `YYC3_SHELL_V2.0` | Terminal UI text | `TerminalPanel.tsx` | **CHANGE** | NONE |
| 13 | `初始化 YYC³ 神经核心` | Task sample text | `TaskPod.tsx` | **CHANGE** | NONE |
| 14 | `YYC³ Neural API Server` | Server banner | `README_SERVER.ts` | **CHANGE** | NONE |
| 15 | `言语云魔方 - 本地 API 服务器` | Server banner CN | `README_SERVER.ts` | **CHANGE** | NONE |
| 16 | File header comments (8 files) | Docstrings | Multiple `.ts` files | **OPTIONAL** | NONE |

### 7.2 Dependency Graph / 依赖关系图

```
YYC3_DESIGN (design-system.ts)
    ├── imported by: ResponsiveAIAssistant.tsx
    ├── imported by: MultimodalArtifact.tsx (3 usages)
    ├── imported by: IntelligentCenter.tsx (1 usage)
    └── imported by: TaskPod.tsx (1 usage)

YYC3Background (YYC3Background.tsx)
    └── imported by: ResponsiveAIAssistant.tsx

application/yyc3-node-type
    ├── SET in: NodePalette.tsx (drag start)
    └── GET in: WorkflowPanel.tsx (drop handler)

yyc3_jwt + yyc3_offline_*
    ├── defined in: pg-api.ts (OFFLINE_KEYS + TOKEN_KEY)
    ├── consumed by: pg-api.ts (request(), authApi, offlineStore)
    ├── consumed by: auth-store.ts (via pg-api imports)
    ├── consumed by: config-store.ts (via pg-api imports)
    └── consumed by: workflow-store.ts (via pg-api imports)
```

---

## 8. Future Rename Procedure / 未来重命名流程

If a full rename is ever decided, follow this order to minimize breakage:

### Phase A: Safe Changes (Zero Risk) / 安全变更（零风险）

```
1. UI display text (Section 5.2)         — visual only
2. File header comments (Section 6)       — non-functional
3. Server banner text (README_SERVER.ts)  — cosmetic
```

### Phase B: Paired Changes (Low Risk) / 配对变更（低风险）

```
4. DataTransfer MIME type                 — update BOTH files simultaneously
5. API version string (YYC3.API.V1)       — server blueprint only
```

### Phase C: Storage Migration (High Risk) / 存储迁移（高风险）

```
6. localStorage keys                     — requires migration function (Section 3.2)
   - Deploy migration code FIRST
   - Wait for all active sessions to run migration
   - THEN remove old key fallbacks
```

### Phase D: Code Identifiers (Medium Risk) / 代码标识符（中等风险）

```
7. YYC3_DESIGN → YYCC_DESIGN            — update export + all 4 import sites
8. YYC3Background → CubeBackground      — rename file + update import
```

### Phase E: Infrastructure (Highest Risk) / 基础设施（最高风险）

```
9. Database name: yyc3 → yycc           — requires:
   - pg_dump / pg_restore
   - update .env on ALL deployments
   - update all documentation
   - update README_SERVER.ts defaults
```

---

## 9. Naming Convention for New Code / 新代码命名约定

Going forward, use these patterns for any new code:

### 9.1 Code Identifiers / 代码标识符

| Type | Pattern | Example |
|---|---|---|
| Constants | `YYCC_*` or `CUBE_*` | `YYCC_THEME`, `CUBE_DEFAULTS` |
| Components | PascalCase descriptive | `CubeCanvas`, `NeuralBridge` |
| Hooks | `use` + PascalCase | `useCubeState`, `useNeuralSync` |
| Store files | `kebab-case-store.ts` | `neural-store.ts` |
| Utility files | `kebab-case.ts` | `cube-engine.ts` |

### 9.2 localStorage Keys / 本地存储键

```
yyc3_{domain}_{purpose}

Examples:
  yyc3_canvas_snapshot
  yyc3_neural_preferences
  yyc3_mcp_servers
```

> Continue using `yyc3_` prefix for consistency with existing keys.

### 9.3 UI Display Text / 界面显示文本

```
Brand name:     YanYuCloudCube
Chinese motto:  万象归元于云枢丨深栈智启新纪元
Version format: YanYuCloudCube.{MODULE}.V{N}
Shell prompt:   YYCC_SHELL_V{N}.{M}
Core version:   YYCC.CORE.V{N}
```

### 9.4 API & Server / API 与服务器

```
Database:       yyc3              (keep existing)
Server dir:     yyc3-api          (keep existing)
API base:       /api/*            (no brand prefix needed)
Health version: YanYuCloudCube.API.V{N}
```

### 9.5 Custom MIME Types / 自定义 MIME 类型

```
application/yyc3-{purpose}

Examples:
  application/yyc3-node-type      (existing)
  application/yyc3-workflow-data  (future: workflow drag/drop)
```

---

## 10. Quick Reference Card / 速查卡片

```
┌──────────────────────────────────────────────────┐
│         YanYuCloudCube Naming Quick Ref           │
│         变量命名速查                               │
├──────────────────────────────────────────────────┤
│                                                    │
│  USER SEES  →  "YanYuCloudCube"                   │
│               "万象归元于云枢丨深栈智启新纪元"       │
│                                                    │
│  CODE USES  →  YYC3_DESIGN  (const)               │
│               YYC3Background (component)           │
│               yyc3_jwt (localStorage)              │
│               yyc3_offline_* (localStorage)        │
│               application/yyc3-* (MIME)            │
│               yyc3 (database name)                 │
│                                                    │
│  NEW CODE   →  YYCC_* or CUBE_* (constants)       │
│               Descriptive PascalCase (components)  │
│               yyc3_* (localStorage keys)           │
│                                                    │
│  NEVER DO   →  Rename localStorage keys without   │
│                migration function                  │
│             →  Rename exports without updating     │
│                ALL import sites                    │
│             →  Rename DB without full data dump    │
│                                                    │
└──────────────────────────────────────────────────┘
```

---

*End of Naming Convention Guide / 变量命名范式文档结束*

*Generated: 2026-02-14 | YanYuCloudCube AI Assistant*