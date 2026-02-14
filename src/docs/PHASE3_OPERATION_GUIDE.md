# YYC3 Phase 3 "Engine Ignition" - Complete Operation Guide
# 言语云魔方 阶段三 "引擎点火" - 详细操作指导文档

**Version / 版本:** 3.0  
**Date / 日期:** 2026-02-14  
**Status / 状态:** Phase 3 Complete - Pending Deployment & E2E Testing  
**Author / 作者:** YYC3 AI Assistant  

---

## Table of Contents / 目录

1. [Architecture Overview / 架构总览](#1-architecture-overview--架构总览)
2. [File Inventory / 文件清单](#2-file-inventory--文件清单)
3. [Database Initialization / 数据库初始化](#3-database-initialization--数据库初始化)
4. [Express Server Deployment / Express 服务器部署](#4-express-server-deployment--express-服务器部署)
5. [End-to-End Testing / 端到端测试](#5-end-to-end-testing--端到端测试)
6. [LLM Mixed Content Auto-Downgrade / LLM 混合内容自动降级](#6-llm-mixed-content-auto-downgrade--llm-混合内容自动降级)
7. [RunHistory Replay Feature / 运行历史回放功能](#7-runhistory-replay-feature--运行历史回放功能)
8. [Core Narrative Constraints / 核心叙事性约束](#8-core-narrative-constraints--核心叙事性约束)
9. [Troubleshooting / 故障排查](#9-troubleshooting--故障排查)
10. [Phase Summary & Next Steps / 阶段总结与后续规划](#10-phase-summary--next-steps--阶段总结与后续规划)

---

## 1. Architecture Overview / 架构总览

### Data Flow / 数据流

```
Browser (React/TypeScript)
  |
  | fetch() + JWT Bearer Token
  |
  v
/lib/pg-api.ts  (API Client + localStorage Offline Fallback)
  |
  | HTTP REST (port 3721)
  |
  v
Express Server  (/server/README_SERVER.ts blueprint)
  |
  | pg Pool
  |
  v
PostgreSQL 15  (yyc3 database)
```

### State Management / 状态管理 (Zustand)

| Store | File | Responsibility |
|-------|------|----------------|
| `useAuthStore` | `/stores/auth-store.ts` | Auth, session, connection status |
| `useConfigStore` | `/stores/config-store.ts` | AI config CRUD, active config |
| `useAppStore` | `/stores/app-store.ts` | Theme, panel nav, sync indicator |
| `useWorkflowStore` | `/stores/workflow-store.ts` | DAG nodes/edges, workflow CRUD, execution |

### Key Design Principles / 关键设计原则

- **Bilingual / 中英双语:** ALL UI text must display both Chinese and English
- **70% Panel Opacity / 面板透明度 70%:** Dark glass morphism (`bg-[#050a10]/70`)
- **Offline-First / 离线优先:** `localStorage` fallback in `/lib/pg-api.ts`
- **Audio Fault / 音频故障:** `audio_synth` hardcoded as FAULT at every layer
- **Best-Effort PG / PG 不阻塞:** PG writes during execution are best-effort, never block UI

---

## 2. File Inventory / 文件清单

### Phase 3 Core Files (Created/Modified) / 阶段三核心文件

| File | Status | Description |
|------|--------|-------------|
| `/server/README_SERVER.ts` | **Blueprint** | Express Server full source code (copy to `server.ts`) |
| `/lib/pg-api.ts` | **Modified** | Added `updateRun`, `appendRunLogs`, `runsApi`, `llmProxyApi` |
| `/stores/workflow-store.ts` | **Modified** | `executeWorkflow` with PG Run record + batch log flush |
| `/utils/dag-engine.ts` | **Modified** | DAGEngineV2 with real LLM calls + AbortController signal |
| `/utils/llm.ts` | **Existing** | `generateCompletion`, `checkConnection`, Mixed Content detection |
| `/components/workflow/ApiStatusBadge.tsx` | **New** | 3-tier connection diagnostic badge |
| `/components/workflow/RunHistory.tsx` | **New** | Historical run records panel |
| `/components/workflow/CyberNodes.tsx` | **Hand-edited** | Custom React Flow nodes (use disk version as source of truth) |
| `/components/workflow/NodePalette.tsx` | **Hand-edited** | Drag-and-drop node palette |
| `/components/workflow/ExecutionLog.tsx` | **Hand-edited** | Execution log panel V2 |
| `/components/workflow/NodeInspector.tsx` | **Existing** | Node configuration inspector |
| `/components/modules/WorkflowPanel.tsx` | **Modified** | Integrated ApiStatusBadge, History button, execution toasts |

### Phase 1-2 Foundation Files / 阶段一二基础文件

| File | Description |
|------|-------------|
| `/supabase/schema.sql` | Database schema (profiles, ai_configs, workflows, workflow_runs) |
| `/stores/auth-store.ts` | Auth state management with offline fallback |
| `/stores/config-store.ts` | AI config state management with PG sync |
| `/types/index.ts` | Core type definitions (LLMConfig, MessageContent, etc.) |
| `/components/auth/AuthGate.tsx` | Auth gate component |
| `/components/auth/UserBadge.tsx` | User badge display |

### Hand-Edited Files Warning / 手动编辑文件警告

> **CRITICAL:** The following 4 files were hand-edited and later overwritten by the assistant.
> The **current disk version** is the source of truth:
> 
> 1. `/components/workflow/CyberNodes.tsx`
> 2. `/components/workflow/NodePalette.tsx`
> 3. `/components/workflow/ExecutionLog.tsx`
> 4. `/stores/workflow-store.ts`
> 
> Any future AI edits to these files must first `read` the current disk version.

---

## 3. Database Initialization / 数据库初始化

### 3.1 Prerequisites / 前置条件

- PostgreSQL 15 installed and running
- `psql` CLI available
- A designated user (e.g., `postgres`) with superuser privileges

### 3.2 Step-by-Step / 逐步操作

#### Step 1: Create Database / 创建数据库

```bash
psql -U postgres -c "CREATE DATABASE yyc3;"
```

#### Step 2: Create Local Auth Schema / 创建本地 Auth Schema

Since the project originally references Supabase's `auth.users`, we need a local replacement:

```bash
psql -U postgres -d yyc3 << 'EOF'

-- ============================================================
-- 创建 auth schema / Create auth schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth;

-- 创建用户表 / Create users table
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    raw_user_meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 uid() 函数模拟 Supabase auth.uid()
-- Create uid() function to simulate Supabase auth.uid()
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claim.userId', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
$$ LANGUAGE SQL STABLE;

EOF
```

#### Step 3: Run Project Schema / 运行项目 Schema

```bash
psql -U postgres -d yyc3 -f /path/to/project/supabase/schema.sql
```

This creates the following tables with RLS policies:

| Table | Description |
|-------|-------------|
| `public.profiles` | User profiles (username, avatar, theme) |
| `public.ai_configs` | AI configuration presets |
| `public.workflows` | Workflow definitions (DAG JSON) |
| `public.workflow_runs` | Execution history records |

#### Step 4: Add Update Policy for workflow_runs / 添加 workflow_runs 更新策略

The original `schema.sql` only has `SELECT` and `INSERT` policies for `workflow_runs`.
Phase 3 requires `UPDATE` for setting run status/logs:

```bash
psql -U postgres -d yyc3 << 'EOF'

-- 添加 workflow_runs UPDATE 策略 / Add UPDATE policy
CREATE POLICY "Users can update own workflow runs." ON public.workflow_runs
  FOR UPDATE USING (auth.uid() = user_id);

EOF
```

#### Step 5: Verify / 验证

```bash
psql -U postgres -d yyc3 -c "\dt public.*"
```

Expected output:
```
         List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | ai_configs      | table | postgres
 public | profiles        | table | postgres
 public | workflow_runs   | table | postgres
 public | workflows       | table | postgres
```

```bash
psql -U postgres -d yyc3 -c "\dt auth.*"
```

Expected output:
```
       List of relations
 Schema | Name  | Type  |  Owner
--------+-------+-------+----------
 auth   | users | table | postgres
```

### 3.3 Complete Init Script / 完整初始化脚本

For convenience, here's a single combined script:

```bash
#!/bin/bash
# YYC3 Database Init Script
# Usage: ./init-db.sh

set -e

PG_USER="${PG_USER:-postgres}"
PG_DB="yyc3"

echo "=== YYC3 Database Initialization ==="

# 1. Create database
echo "[1/4] Creating database '$PG_DB'..."
psql -U "$PG_USER" -c "CREATE DATABASE $PG_DB;" 2>/dev/null || echo "  Database already exists, skipping."

# 2. Create auth schema
echo "[2/4] Creating auth schema..."
psql -U "$PG_USER" -d "$PG_DB" << 'AUTHSQL'
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    raw_user_meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claim.userId', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
$$ LANGUAGE SQL STABLE;
AUTHSQL

# 3. Run project schema
echo "[3/4] Running project schema..."
psql -U "$PG_USER" -d "$PG_DB" -f "$(dirname "$0")/../supabase/schema.sql"

# 4. Add Phase 3 policies
echo "[4/4] Adding Phase 3 policies..."
psql -U "$PG_USER" -d "$PG_DB" << 'P3SQL'
-- Phase 3: workflow_runs UPDATE policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own workflow runs.'
    ) THEN
        CREATE POLICY "Users can update own workflow runs." ON public.workflow_runs
          FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
P3SQL

echo ""
echo "=== YYC3 Database Ready ==="
echo "  Database: $PG_DB"
echo "  Tables: profiles, ai_configs, workflows, workflow_runs"
echo "  Auth: auth.users + auth.uid() function"
echo ""
```

---

## 4. Express Server Deployment / Express 服务器部署

### 4.1 Local NAS Deployment / 本地 NAS 部署

#### Step 1: Create Project Directory / 创建项目目录

```bash
# On your NAS (SSH in first)
mkdir -p ~/yyc3-api && cd ~/yyc3-api
npm init -y
```

#### Step 2: Install Dependencies / 安装依赖

```bash
npm install express pg bcryptjs jsonwebtoken cors dotenv uuid
npm install -D typescript @types/express @types/pg @types/bcryptjs \
    @types/jsonwebtoken @types/cors @types/uuid tsx
```

#### Step 3: Copy Server Code / 复制服务器代码

Copy the content between the `/* ... */` comment block in `/server/README_SERVER.ts` (lines 76-633) into a new file `server.ts`:

```bash
# From your project directory
# Extract the server code from README_SERVER.ts
# (Remove the leading /* and trailing */ comment delimiters)
cp /path/to/project/server/README_SERVER.ts ./server.ts
# Then manually edit to remove the comment wrapper
```

Or simply: Open `/server/README_SERVER.ts`, copy lines 76-632, paste into `~/yyc3-api/server.ts`, remove the `/*` prefix on line 76 and `*/` suffix on line 633.

#### Step 4: Create `.env` File / 创建环境变量文件

```bash
cat > .env << 'EOF'
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=yyc3
PG_USER=postgres
PG_PASSWORD=your_secure_password_here
JWT_SECRET=yyc3_production_secret_change_this
PORT=3721
EOF
```

#### Step 5: Initialize Database / 初始化数据库

Run the init script from Section 3.3, or execute the SQL steps manually.

#### Step 6: Start Server / 启动服务器

```bash
npx tsx server.ts
```

Expected output:
```
  ╔══════════════════════════════════════════════╗
  ║  YYC3 Neural API Server                     ║
  ║  言语云魔方 - 本地 API 服务器                  ║
  ╠══════════════════════════════════════════════╣
  ║  端口 / Port:   http://localhost:3721        ║
  ║  状态 / Status: ONLINE                      ║
  ║  数据库 / DB:   PostgreSQL 15                ║
  ╚══════════════════════════════════════════════╝
```

#### Step 7: Run as Daemon (Production) / 守护进程运行

```bash
# Using pm2
npm install -g pm2
pm2 start "npx tsx server.ts" --name yyc3-api
pm2 save
pm2 startup

# Or using systemd
sudo cat > /etc/systemd/system/yyc3-api.service << 'EOF'
[Unit]
Description=YYC3 Neural API Server
After=network.target postgresql.service

[Service]
Type=simple
User=your_user
WorkingDirectory=/home/your_user/yyc3-api
ExecStart=/usr/bin/npx tsx server.ts
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable yyc3-api
sudo systemctl start yyc3-api
```

### 4.2 Cloud ECS Deployment / 云 ECS 部署

#### Differences from NAS / 与 NAS 的差异

| Item | NAS | ECS |
|------|-----|-----|
| PG_HOST | `localhost` | ECS internal IP or RDS endpoint |
| CORS origin | LAN IPs | Your domain (HTTPS) |
| HTTPS | ngrok tunnel or reverse proxy | Nginx + Let's Encrypt |
| Firewall | N/A | Open port 3721 (or reverse proxy 443) |

#### Step 1: Provision ECS / 创建 ECS 实例

- OS: Ubuntu 22.04 LTS or Debian 12
- Specs: 1 vCPU + 1GB RAM minimum (2 vCPU + 2GB recommended)
- Security group: Open ports 22 (SSH), 443 (HTTPS), 3721 (API - optional, prefer reverse proxy)

#### Step 2: Install Node.js + PostgreSQL / 安装运行时

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15
sudo apt-get install -y postgresql-15
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### Step 3: Same as NAS Steps 1-6 / 与 NAS 相同

Follow NAS Steps 1-6 above.

#### Step 4: Update CORS for Production Domain / 更新生产环境 CORS

Edit `server.ts` CORS configuration:

```typescript
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://your-yyc3-domain.com',    // Add your production domain
        'https://yyc3.your-domain.com',     // Or subdomain
    ],
    credentials: true,
}));
```

#### Step 5: Nginx Reverse Proxy (HTTPS) / Nginx 反向代理

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Create nginx config
sudo cat > /etc/nginx/sites-available/yyc3-api << 'EOF'
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3721;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/yyc3-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL Certificate
sudo certbot --nginx -d api.your-domain.com
```

#### Step 6: Update Frontend API_BASE / 更新前端 API 地址

Set the environment variable before building the frontend:

```bash
VITE_API_URL=https://api.your-domain.com/api
```

Or modify `/lib/pg-api.ts` line 15:

```typescript
return import.meta.env?.VITE_API_URL || 'https://api.your-domain.com/api';
```

### 4.3 NAS with HTTPS (ngrok Tunnel) / NAS HTTPS 隧道

If deploying on NAS but the frontend runs on HTTPS (e.g., Figma Make preview), you need to tunnel the HTTP API through HTTPS to avoid Mixed Content errors:

```bash
# Install ngrok
# https://ngrok.com/download

# Expose port 3721 via HTTPS
ngrok http 3721

# Output:
# Forwarding: https://xxxx-xxxx.ngrok-free.app -> http://localhost:3721
```

Then update `VITE_API_URL` to the ngrok HTTPS URL.

See `/HTTPS_GUIDE.md` for more details.

---

## 5. End-to-End Testing / 端到端测试

### 5.1 Pre-Flight Checklist / 起飞前检查清单

- [ ] PostgreSQL 15 running with `yyc3` database initialized
- [ ] Express Server running on port 3721
- [ ] Frontend app loaded in browser
- [ ] (Optional) ngrok tunnel if frontend is HTTPS

### 5.2 Test 1: Health Check / 健康检查

```bash
curl http://localhost:3721/api/health
```

Expected:
```json
{
  "status": "online",
  "timestamp": "2026-02-14T...",
  "version": "YYC3.API.V1"
}
```

### 5.3 Test 2: ApiStatusBadge / 连接诊断徽章

1. Open the Workflow Panel in the browser
2. Locate the `ApiStatusBadge` in the toolbar area
3. Click to expand the diagnostic panel
4. Verify three endpoints show green:
   - **Express API :3721** - Green checkmark
   - **PostgreSQL 15** - Green checkmark (piggybacks on health check)
   - **LLM Endpoint** - Green if an LLM config with valid `baseUrl` is set; otherwise "N/A"
5. Click the refresh button to re-run diagnostics

### 5.4 Test 3: Auth Flow / 鉴权流程

```bash
# Register
curl -X POST http://localhost:3721/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test_operator","password":"test1234"}'

# Expected: { "token": "eyJ...", "user": { "id": "...", "username": "test_operator", ... } }

# Login
curl -X POST http://localhost:3721/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test_operator","password":"test1234"}'

# Me (use token from above)
curl http://localhost:3721/api/auth/me \
  -H "Authorization: Bearer <token>"
```

In-browser: Open the AuthGate, register/login, verify the UserBadge updates.

### 5.5 Test 4: Workflow CRUD / 工作流增删改查

```bash
TOKEN="<your_jwt_token>"

# Create workflow
curl -X POST http://localhost:3721/api/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Flow","description":"E2E test","definition":{"nodes":[],"edges":[]}}'

# List workflows
curl http://localhost:3721/api/workflows \
  -H "Authorization: Bearer $TOKEN"
```

In-browser:
1. Open Workflow Panel
2. Click "+" to create a new workflow
3. Verify it appears in the left sidebar
4. Click "Save" and verify no error toast

### 5.6 Test 5: DAG Execution with PG Run Record / DAG 执行与 PG Run 记录

1. Load the "Basic Chat Chain" template (基础对话链)
2. Ensure you have a valid LLM config (e.g., Ollama at localhost:11434)
3. Click "Execute / 执行"
4. Watch the execution log panel for real-time progress
5. After completion, check the database:

```bash
psql -U postgres -d yyc3 -c "SELECT id, workflow_id, status, duration_ms, started_at FROM public.workflow_runs ORDER BY started_at DESC LIMIT 5;"
```

6. Click the "History / 历史" button in the toolbar
7. Verify the RunHistory panel shows the completed run
8. Click to expand and verify logs are present

### 5.7 Test 6: Batch Log Flush / 批量日志写入

During execution, the store buffers logs and flushes every 500ms:

```
executeWorkflow()
  -> onProgress callback fires per node
  -> Logs buffered in logBuffer[]
  -> flushTimer triggers flushLogs() every 500ms
  -> workflowsApi.appendRunLogs() sends batch to PG
  -> Final flush after execution completes
  -> workflowsApi.updateRun() sends final status + complete logs
```

Verify in PG:
```bash
psql -U postgres -d yyc3 -c "SELECT id, jsonb_array_length(logs) as log_count, status FROM public.workflow_runs ORDER BY started_at DESC LIMIT 1;"
```

### 5.8 Test 7: Abort Execution / 中止执行

1. Load the "Chain of Thought" template (思维链) - has 5 nodes
2. Click Execute
3. While running (before all nodes complete), click the Stop button in ExecutionLog
4. Verify:
   - `executionStatus` changes to `'failed'`
   - AbortController signal propagates (check console for abort errors)
   - PG run record shows `status: 'failed'` (if PG is connected)

### 5.9 Test 8: Offline Fallback / 离线降级

1. Stop the Express Server (`Ctrl+C` or `pm2 stop yyc3-api`)
2. Refresh the browser
3. Verify:
   - ApiStatusBadge shows "OFFLINE / 离线模式"
   - Previous workflows are loaded from `localStorage`
   - Execution still works (LLM direct call, no PG logging)
   - Toast notifications work normally
4. Restart the server
5. Verify: ApiStatusBadge transitions back to "online" on next health check

### 5.10 Test 9: Audio Synth Fault / 语音合成故障测试

1. Drag an "Audio Synth / 语音合成" node onto the canvas
2. Verify the node displays with red glitch styling
3. Connect it into a workflow chain
4. Click Execute
5. Verify:
   - DAG validation fails with `CRITICAL FAULT: ... [ERR_CODE: 0x503_VOICE_MOD]`
   - Execution is blocked
   - Error appears in the execution log

### 5.11 Test 10: LLM Proxy Endpoint / LLM 代理端点

```bash
# Test LLM proxy (requires a running LLM server)
TOKEN="<your_jwt_token>"
curl -X POST http://localhost:3721/api/llm/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "http://localhost:11434/api/chat",
    "headers": {},
    "body": {
      "model": "llama3",
      "messages": [{"role":"user","content":"hello"}],
      "stream": false
    },
    "timeout": 30000
  }'
```

---

## 6. LLM Mixed Content Auto-Downgrade / LLM 混合内容自动降级

### 6.1 Problem / 问题

When the frontend runs on HTTPS (e.g., Figma Make, cloud deployment) but the LLM API runs on HTTP (e.g., local Ollama at `http://localhost:11434`), browsers block the request as "Mixed Content".

### 6.2 Current Behavior / 当前行为

In `/utils/llm.ts`, the `generateCompletion` function already detects Mixed Content:

```typescript
const isMixedContent = String(error).includes('Failed to fetch') 
    && window.location.protocol === 'https:';
```

But it currently returns a mock response rather than attempting the proxy.

### 6.3 Recommended Implementation / 建议实现

Modify `/utils/llm.ts` `generateCompletion()` to auto-downgrade via the LLM proxy when Mixed Content is detected:

```typescript
// In the catch block of generateCompletion(), before the mock fallback:

if (isMixedContent) {
    console.log("[LLM] Mixed Content detected, attempting proxy via /api/llm/proxy...");
    
    try {
        const { llmProxyApi } = await import('@/lib/pg-api');
        const proxyRes = await llmProxyApi.completion(url, headers, body, 60000);
        
        if (proxyRes.success && proxyRes.data) {
            // Parse response same as direct call
            if (config.provider === 'ollama') {
                return proxyRes.data.message?.content || "Ollama proxy returned empty";
            } else {
                return proxyRes.data.choices?.[0]?.message?.content || "Proxy returned empty";
            }
        }
        
        // Proxy also failed, fall through to mock
        console.warn("[LLM] Proxy failed:", proxyRes.error);
    } catch (proxyErr) {
        console.warn("[LLM] Proxy unavailable:", proxyErr);
    }
    
    // Final fallback: mock response
    return `[安全模式] ... (existing mock code)`;
}
```

### 6.4 Prerequisites / 前置条件

- Express Server must be accessible via HTTPS (ngrok or Nginx reverse proxy)
- The proxy endpoint `/api/llm/proxy` must be reachable from the browser
- Set `VITE_API_URL` to the HTTPS Express Server URL

### 6.5 Flow Diagram / 流程图

```
Browser (HTTPS) → LLM API (HTTP)
                    |
                    X  Mixed Content Blocked!
                    |
                    v
Browser (HTTPS) → Express Server (HTTPS via ngrok/nginx)
                    |
                    → /api/llm/proxy
                        |
                        → LLM API (HTTP)  ← Server-side, no Mixed Content
                        |
                        ← Response
                    |
                    ← Response to browser
```

---

## 7. RunHistory Replay Feature / 运行历史回放功能

### 7.1 Feature Design / 功能设计

**Goal / 目标:** Select a historical run from RunHistory panel, and replay its results back onto the canvas nodes.

### 7.2 Implementation Plan / 实现方案

#### 7.2.1 Data Model

Each `WorkflowRunRow` already contains:
```typescript
{
    id: string;
    workflow_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    logs: Array<{
        node_id: string;
        status: string;
        message?: string;
        timestamp: number;
        duration_ms?: number;
    }>;
    duration_ms: number | null;
}
```

The logs contain per-node results. To support full replay, we should also store per-node outputs in the run record.

#### 7.2.2 Store Changes (`/stores/workflow-store.ts`)

Add a new action:

```typescript
interface WorkflowState {
    // ... existing ...
    replayRun: (run: WorkflowRunRow) => void;
}
```

Implementation:

```typescript
replayRun: (run: WorkflowRunRow) => {
    // 1. Set execution logs from run record
    const logs = (run.logs || []).map((log: any) => ({
        nodeId: log.node_id || log.nodeId,
        status: log.status,
        message: log.message,
        output: log.output,
        timestamp: log.timestamp,
        durationMs: log.duration_ms || log.durationMs,
    }));
    
    // 2. Build outputs map from logs
    const outputs: Record<string, any> = {};
    logs.filter(l => l.status === 'completed' && l.output).forEach(l => {
        outputs[l.nodeId] = l.output;
    });
    
    // 3. Update node visual states
    set(state => ({
        executionStatus: run.status as any,
        executionLogs: logs,
        executionOutputs: outputs,
        nodes: state.nodes.map(n => {
            const nodeLog = logs.filter(l => l.nodeId === n.id);
            const lastLog = nodeLog[nodeLog.length - 1];
            if (!lastLog) return n;
            
            return {
                ...n,
                data: {
                    ...n.data,
                    status: lastLog.status === 'completed' ? 'completed' :
                            lastLog.status === 'failed' ? 'failed' : n.data.status,
                    config: {
                        ...n.data.config,
                        _lastOutput: lastLog.output || lastLog.message,
                        _lastDuration: lastLog.durationMs,
                    },
                },
            };
        }),
    }));
},
```

#### 7.2.3 RunHistory UI Changes (`/components/workflow/RunHistory.tsx`)

Add a "Replay" button to each completed run:

```tsx
// In the run summary button row, add:
{run.status === 'completed' && (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onReplay?.(run);
        }}
        className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-cyan-400"
        title="回放 / Replay"
    >
        <RotateCcw className="w-3 h-3" />
    </button>
)}
```

Add `onReplay` prop:
```typescript
interface RunHistoryProps {
    workflowId?: string | null;
    onClose?: () => void;
    onReplay?: (run: WorkflowRunRow) => void;
}
```

#### 7.2.4 WorkflowPanel Integration

In `WorkflowPanel.tsx`, connect replay:

```tsx
<RunHistory
    workflowId={currentId}
    onReplay={(run) => {
        replayRun(run);
        setShowHistory(false);
        setShowLog(true);
        toast.success('运行回放已加载 / Run replay loaded');
    }}
/>
```

#### 7.2.5 Enhanced Log Storage

To support full output replay, modify the PG log flush in `executeWorkflow` to also store `ctx.output`:

```typescript
// In the flushLogs buffer, add output field:
logBuffer.push({
    node_id: ctx.nodeId,
    status: ctx.status,
    message: logEntry.message?.slice(0, 500),
    output: ctx.output ? (typeof ctx.output === 'string' 
        ? ctx.output.slice(0, 2000) 
        : JSON.stringify(ctx.output).slice(0, 2000)) : undefined,
    timestamp: ctx.timestamp,
    duration_ms: ctx.durationMs,
});
```

---

## 8. Core Narrative Constraints / 核心叙事性约束

### Audio Synth Fault / 语音合成故障

The `audio_synth` module is **permanently corrupted** across ALL layers:

| Layer | File | Implementation |
|-------|------|----------------|
| **UI** | `CyberNodes.tsx` | Red glitch animation, skull icon, fault status |
| **UI** | `NodePalette.tsx` | Red "FAULT" badge, tooltip warning |
| **Store** | `workflow-store.ts` | `status: 'fault'` on creation, preserved on reset |
| **DAG Engine** | `dag-engine.ts` | `validate()` blocks execution if audio_synth present |
| **DAG Engine** | `dag-engine.ts` | `executeNode()` throws `ERR_CODE: 0x503_VOICE_MOD` |
| **Database** | `schema.sql` (future) | Trigger to reject audio_synth node insertion |

**Error Code:** `0x503_VOICE_MOD`  
**Visual Style:** Red border, glitch animation, AlertTriangle icon  
**Behavior:** ANY workflow containing an audio_synth node will fail validation and refuse to execute.

This is an intentional narrative element of the cyberpunk design. Do NOT fix it.

---

## 9. Troubleshooting / 故障排查

### 9.1 Common Issues / 常见问题

#### ApiStatusBadge shows OFFLINE / 显示离线

| Cause | Solution |
|-------|----------|
| Server not started | `cd ~/yyc3-api && npx tsx server.ts` |
| Wrong port | Check `.env` PORT matches API_BASE in `pg-api.ts` |
| CORS blocked | Check browser console for CORS errors; verify `origin` in server CORS config |
| Firewall | Ensure port 3721 is open |
| Mixed Content | Use ngrok or Nginx HTTPS reverse proxy |

#### "OFFLINE" error on login / 登录时 OFFLINE 错误

- Express Server is not running or unreachable
- Check `curl http://localhost:3721/api/health`

#### PG connection error / PG 连接错误

- Verify `.env` PG credentials
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql -U postgres -d yyc3 -c "SELECT 1;"`

#### Execution succeeds but no PG run record / 执行成功但无 PG 记录

- Verify `connectionStatus === 'online'` in auth store
- Check that `activeWorkflowId` is not a `local_` prefixed ID
- PG writes are best-effort; check server logs for errors

#### LLM node returns mock response / LLM 节点返回模拟回复

- Check LLM config in ConfigPanel (provider, baseUrl, model, apiKey)
- Test LLM directly: `curl http://localhost:11434/api/tags` (for Ollama)
- If on HTTPS, implement the Mixed Content proxy (Section 6)

#### workflow_runs UPDATE fails / 运行记录更新失败

- Ensure the UPDATE policy exists (Section 3.2 Step 4)
- Check RLS is properly configured

### 9.2 Debug Tools / 调试工具

```bash
# Server logs (if using pm2)
pm2 logs yyc3-api

# PostgreSQL query log
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Browser console
# Filter by: [PG], [LLM], [Auth]
```

### 9.3 Reset Everything / 完全重置

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS yyc3;"
# Then re-run init script from Section 3.3

# Clear browser localStorage
# Open DevTools → Application → Local Storage → Clear All
```

---

## 10. Phase Summary & Next Steps / 阶段总结与后续规划

### Phase 3 Deliverables / 阶段三交付物

| Deliverable | Status |
|-------------|--------|
| DAG Engine V2 with real LLM API calls | Done |
| Node types: text_input, llm_process, image_gen, output, condition, transform | Done |
| audio_synth hardcoded fault (all layers) | Done |
| PG Run record creation on execution | Done |
| Batch log buffer (500ms flush) | Done |
| AbortController signal propagation | Done |
| ApiStatusBadge (3-tier diagnostic) | Done |
| RunHistory panel (list + log expand) | Done |
| LLM Proxy endpoint (`/api/llm/proxy`) | Done (server blueprint) |
| Execution history query (`/api/runs/recent`) | Done (server blueprint) |
| Run status update endpoint | Done (server blueprint) |
| NodeInspector per-type config UI | Done |
| ExecutionLog V2 with output + duration display | Done |
| WorkflowPanel toolbar integration | Done |

### Pending Deployment / 待部署

| Task | Priority | Effort |
|------|----------|--------|
| Deploy Express Server on NAS/ECS | **P0** | 30 min |
| Initialize PostgreSQL schema | **P0** | 10 min |
| E2E testing (10 test cases above) | **P0** | 1-2 hours |
| Set up ngrok/HTTPS if needed | **P1** | 15 min |

### Recommended Next Steps / 建议后续步骤

| Step | Description | Priority |
|------|-------------|----------|
| 1 | Deploy & run all 10 E2E test cases | **P0** |
| 2 | Implement LLM Mixed Content auto-downgrade (Section 6) | **P1** |
| 3 | Implement RunHistory replay feature (Section 7) | **P1** |
| 4 | Add `output` field to PG log entries for full replay support | **P2** |
| 5 | Add workflow export/import (JSON download/upload) | **P2** |
| 6 | Add real image_gen API integration (DALL-E / SD) | **P3** |
| 7 | Add database triggers to block audio_synth in workflow definitions | **P3** |
| 8 | Consider WebSocket for real-time execution progress (instead of polling) | **P3** |

### Three-Phase Completion Status / 三阶段完成状态

```
Phase 1: "Neural Link" (神经连接)     [##########] 100% COMPLETE
  - Auth (register/login/logout/session restore)
  - Profile sync
  - Config CRUD + PG persistence
  - Offline fallback (localStorage)
  - Connection health check

Phase 2: "Workflow Synapse" (工作流突触) [##########] 100% COMPLETE
  - React Flow visual DAG editor
  - Custom cyberpunk node components
  - Node palette (drag & drop)
  - Workflow CRUD (create/save/delete/list)
  - Template system (4 templates)
  - Node inspector panel

Phase 3: "Engine Ignition" (引擎点火)   [########--] 85% → Pending E2E
  - DAG Engine V2 (real LLM calls)        ✅
  - PG Run persistence                     ✅
  - Batch log buffer                        ✅
  - ApiStatusBadge                          ✅
  - RunHistory panel                        ✅
  - LLM Proxy endpoint                     ✅ (blueprint)
  - Server deployment                       ⏳ (pending)
  - E2E testing                             ⏳ (pending)
  - Mixed Content auto-downgrade            📋 (designed, Section 6)
  - RunHistory replay                       📋 (designed, Section 7)
```

---

## Appendix A: API Endpoint Reference / API 端点参考

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Current user profile |
| GET | `/api/profile` | Yes | Get profile |
| PUT | `/api/profile` | Yes | Update profile |
| GET | `/api/configs` | Yes | List AI configs |
| POST | `/api/configs` | Yes | Create AI config |
| PUT | `/api/configs/:id` | Yes | Update AI config |
| DELETE | `/api/configs/:id` | Yes | Delete AI config |
| POST | `/api/configs/:id/activate` | Yes | Set config as active |
| GET | `/api/workflows` | Yes | List workflows |
| GET | `/api/workflows/:id` | Yes | Get workflow by ID |
| POST | `/api/workflows` | Yes | Create workflow |
| PUT | `/api/workflows/:id` | Yes | Update workflow |
| DELETE | `/api/workflows/:id` | Yes | Delete workflow |
| GET | `/api/workflows/:id/runs` | Yes | List runs for workflow |
| POST | `/api/workflows/:id/runs` | Yes | Create new run |
| PUT | `/api/workflows/:wfId/runs/:runId` | Yes | Update run status/logs |
| POST | `/api/workflows/:wfId/runs/:runId/logs` | Yes | Append log entries |
| GET | `/api/runs/recent` | Yes | Recent runs across all workflows |
| POST | `/api/llm/proxy` | Yes | LLM API proxy |

## Appendix B: Environment Variables / 环境变量

### Server (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `yyc3` | Database name |
| `PG_USER` | `postgres` | Database user |
| `PG_PASSWORD` | (required) | Database password |
| `JWT_SECRET` | `yyc3_dev_secret_...` | JWT signing secret (CHANGE IN PRODUCTION) |
| `PORT` | `3721` | API server port |

### Frontend (Vite)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3721/api` | API base URL |

---

*End of Phase 3 Operation Guide / 阶段三操作指导文档结束*

*Generated: 2026-02-14 | YYC3 AI Assistant*
