/**
 * ================================================================
 * YYC3 本地 API 服务器蓝图 / Local API Server Blueprint
 * ================================================================
 * 
 * 这不是一个可在浏览器中运行的文件！
 * 这是你需要在本地 Node.js 环境中运行的 Express 服务器代码。
 * 
 * This is NOT a browser-runnable file!
 * This is the Express server code you run in your local Node.js environment.
 * 
 * ================================================================
 * 快速启动指南 / Quick Start Guide
 * ================================================================
 * 
 * 1. 创建项目目录 / Create project directory:
 *    ```bash
 *    mkdir yyc3-api && cd yyc3-api
 *    npm init -y
 *    npm install express pg bcryptjs jsonwebtoken cors dotenv uuid
 *    npm install -D typescript @types/express @types/pg @types/bcryptjs @types/jsonwebtoken @types/cors @types/uuid tsx
 *    ```
 * 
 * 2. 复制本文件为 server.ts / Copy this file as server.ts
 * 
 * 3. 创建 .env 文件 / Create .env file:
 *    ```
 *    PG_HOST=localhost
 *    PG_PORT=5432
 *    PG_DATABASE=yyc3
 *    PG_USER=postgres
 *    PG_PASSWORD=your_password
 *    JWT_SECRET=your_jwt_secret_change_this_in_production
 *    PORT=3721
 *    ```
 * 
 * 4. 初始化数据库 / Initialize database:
 *    ```bash
 *    psql -U postgres -c "CREATE DATABASE yyc3;"
 *    psql -U postgres -d yyc3 -f ../supabase/schema.sql  # 使用项目中已有的 schema
 *    ```
 *    
 *    注意：schema.sql 中引用了 auth.users，本地需要创建替代表：
 *    ```sql
 *    -- 本地替代 auth.users / Local replacement for auth.users
 *    CREATE SCHEMA IF NOT EXISTS auth;
 *    CREATE TABLE IF NOT EXISTS auth.users (
 *      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *      username TEXT UNIQUE NOT NULL,
 *      password_hash TEXT NOT NULL,
 *      raw_user_meta_data JSONB DEFAULT '{}',
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *    
 *    -- 然后运行 schema.sql 中的 profiles / ai_configs / workflows / workflow_runs 表
 *    -- 注意将 "references auth.users" 改为 "references auth.users(id)"
 *    ```
 * 
 * 5. 启动服务器 / Start server:
 *    ```bash
 *    npx tsx server.ts
 *    ```
 *    
 *    服务器将运行在 http://localhost:3721
 * 
 * ================================================================
 * 完整服务器代码（复制以下所有内容到 server.ts）
 * Full Server Code (Copy everything below to server.ts)
 * ================================================================
 */

// ---- 以下是完整的 server.ts 代码 / Below is the complete server.ts code ----

/*

import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3721');
const JWT_SECRET = process.env.JWT_SECRET || 'yyc3_dev_secret_change_me';

// ============================================================
// PostgreSQL 连接池 / Connection Pool
// ============================================================

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'yyc3',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('connect', () => console.log('[PG] Client connected'));
pool.on('error', (err) => console.error('[PG] Pool error:', err.message));

// ============================================================
// 中间件 / Middleware
// ============================================================

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// JWT 鉴权中间件 / JWT Auth Middleware
interface AuthRequest extends express.Request {
    userId?: string;
}

function authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}

// 请求日志 / Request Logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
    });
    next();
});

// ============================================================
// 健康检查 / Health Check
// ============================================================

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'online', 
            timestamp: result.rows[0].now,
            version: 'YYC3.API.V1',
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// ============================================================
// 鉴权路由 / Auth Routes
// ============================================================

// 注册 / Register
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空 / Username and password required' });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: '密码至少4个字符 / Password min 4 characters' });
    }

    try {
        // 检查用户名是否已存在 / Check username uniqueness
        const existing = await pool.query('SELECT id FROM auth.users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: '代号已被占用 / Callsign already taken' });
        }

        const id = uuidv4();
        const passwordHash = await bcrypt.hash(password, 12);

        // 创建用户 / Create user
        await pool.query(
            'INSERT INTO auth.users (id, username, password_hash, raw_user_meta_data) VALUES ($1, $2, $3, $4)',
            [id, username, passwordHash, JSON.stringify({ username })]
        );

        // 创建 profile (trigger 或手动) / Create profile
        await pool.query(
            'INSERT INTO public.profiles (id, username, theme_preference) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
            [id, username, 'cyan']
        );

        // 生成 Token / Generate Token
        const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: {
                id,
                username,
                avatar_url: null,
                theme_preference: 'cyan',
            },
        });
    } catch (err: any) {
        console.error('[Register Error]', err);
        res.status(500).json({ error: '注册失败 / Registration failed: ' + err.message });
    }
});

// 登录 / Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空 / Username and password required' });
    }

    try {
        const result = await pool.query('SELECT id, password_hash FROM auth.users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: '代号不存在 / Callsign not found' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: '访问密钥错误 / Invalid access key' });
        }

        // 获取 profile / Get profile
        const profile = await pool.query('SELECT * FROM public.profiles WHERE id = $1', [user.id]);
        const profileData = profile.rows[0] || { username, avatar_url: null, theme_preference: 'cyan' };

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: {
                id: user.id,
                username: profileData.username,
                avatar_url: profileData.avatar_url,
                theme_preference: profileData.theme_preference,
            },
        });
    } catch (err: any) {
        console.error('[Login Error]', err);
        res.status(500).json({ error: '登录失败 / Login failed: ' + err.message });
    }
});

// 当前用户 / Current User
app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.profiles WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// Profile 路由 / Profile Routes
// ============================================================

app.get('/api/profile', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.profiles WHERE id = $1', [req.userId]);
        res.json(result.rows[0] || null);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/profile', authMiddleware, async (req: AuthRequest, res) => {
    const { username, avatar_url, theme_preference } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE public.profiles 
             SET username = COALESCE($1, username),
                 avatar_url = COALESCE($2, avatar_url),
                 theme_preference = COALESCE($3, theme_preference),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [username, avatar_url, theme_preference, req.userId]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// AI Configs 路由 / AI Configs Routes
// ============================================================

app.get('/api/configs', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM public.ai_configs WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.userId]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/configs', authMiddleware, async (req: AuthRequest, res) => {
    const { name, provider, model, base_url, settings, is_active } = req.body;

    try {
        // 如果设为活跃，先取消其他活跃配置 / If setting active, deactivate others
        if (is_active) {
            await pool.query('UPDATE public.ai_configs SET is_active = false WHERE user_id = $1', [req.userId]);
        }

        const result = await pool.query(
            `INSERT INTO public.ai_configs (user_id, name, provider, model, base_url, settings, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.userId, name, provider, model, base_url, JSON.stringify(settings || {}), is_active ?? false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/configs/:id', authMiddleware, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, provider, model, base_url, settings, is_active } = req.body;

    try {
        const result = await pool.query(
            `UPDATE public.ai_configs
             SET name = COALESCE($1, name),
                 provider = COALESCE($2, provider),
                 model = COALESCE($3, model),
                 base_url = COALESCE($4, base_url),
                 settings = COALESCE($5, settings),
                 is_active = COALESCE($6, is_active),
                 updated_at = NOW()
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [name, provider, model, base_url, settings ? JSON.stringify(settings) : null, is_active, id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Config not found' });
        }
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/configs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        await pool.query('DELETE FROM public.ai_configs WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 激活配置 / Activate Config
app.post('/api/configs/:id/activate', authMiddleware, async (req: AuthRequest, res) => {
    try {
        await pool.query('UPDATE public.ai_configs SET is_active = false WHERE user_id = $1', [req.userId]);
        const result = await pool.query(
            'UPDATE public.ai_configs SET is_active = true, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Config not found' });
        }
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// Workflows 路由 / Workflows Routes
// ============================================================

app.get('/api/workflows', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM public.workflows WHERE user_id = $1 OR is_public = true ORDER BY updated_at DESC',
            [req.userId]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/workflows/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM public.workflows WHERE id = $1 AND (user_id = $2 OR is_public = true)',
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/workflows', authMiddleware, async (req: AuthRequest, res) => {
    const { name, description, definition, is_public } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO public.workflows (user_id, name, description, definition, is_public)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.userId, name, description, JSON.stringify(definition), is_public ?? false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/workflows/:id', authMiddleware, async (req: AuthRequest, res) => {
    const { name, description, definition, is_public } = req.body;
    try {
        const result = await pool.query(
            `UPDATE public.workflows
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 definition = COALESCE($3, definition),
                 is_public = COALESCE($4, is_public),
                 updated_at = NOW()
             WHERE id = $5 AND user_id = $6 RETURNING *`,
            [name, description, definition ? JSON.stringify(definition) : null, is_public, req.params.id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/workflows/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        await pool.query('DELETE FROM public.workflows WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Workflow Runs
app.get('/api/workflows/:id/runs', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM public.workflow_runs WHERE workflow_id = $1 AND user_id = $2 ORDER BY started_at DESC LIMIT 50',
            [req.params.id, req.userId]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/workflows/:id/runs', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(
            `INSERT INTO public.workflow_runs (workflow_id, user_id, status, logs)
             VALUES ($1, $2, 'running', '[]') RETURNING *`,
            [req.params.id, req.userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 更新运行状态 / Update Run Status (Phase 3)
app.put('/api/workflows/:wfId/runs/:runId', authMiddleware, async (req: AuthRequest, res) => {
    const { status, logs, duration_ms } = req.body;
    try {
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (status) { updates.push(`status = $${idx++}`); values.push(status); }
        if (logs) { updates.push(`logs = $${idx++}`); values.push(JSON.stringify(logs)); }
        if (duration_ms !== undefined) { updates.push(`duration_ms = $${idx++}`); values.push(duration_ms); }
        if (status === 'completed' || status === 'failed') {
            updates.push(`completed_at = NOW()`);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(req.params.runId, req.params.wfId, req.userId);
        const result = await pool.query(
            `UPDATE public.workflow_runs SET ${updates.join(', ')} 
             WHERE id = $${idx++} AND workflow_id = $${idx++} AND user_id = $${idx++}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Run not found' });
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 追加运行日志 / Append Run Logs (Phase 3)
app.post('/api/workflows/:wfId/runs/:runId/logs', authMiddleware, async (req: AuthRequest, res) => {
    const { entries } = req.body; // Array of log entries
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });

    try {
        const result = await pool.query(
            `UPDATE public.workflow_runs 
             SET logs = logs || $1::jsonb
             WHERE id = $2 AND workflow_id = $3 AND user_id = $4
             RETURNING id, status`,
            [JSON.stringify(entries), req.params.runId, req.params.wfId, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Run not found' });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// LLM 代理端点 / LLM Proxy Endpoint (Phase 3)
// 解决浏览器 CORS / Mixed Content 问题
// Solves browser CORS / Mixed Content issues
// ============================================================

app.post('/api/llm/proxy', authMiddleware, async (req: AuthRequest, res) => {
    const { url, headers: reqHeaders, body: reqBody, timeout } = req.body;

    if (!url) return res.status(400).json({ error: 'url is required' });

    try {
        const controller = new AbortController();
        const timeoutMs = Math.min(timeout || 60000, 120000); // Max 2 min
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const proxyRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...reqHeaders,
            },
            body: JSON.stringify(reqBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!proxyRes.ok) {
            const errText = await proxyRes.text();
            return res.status(proxyRes.status).json({ 
                error: `LLM API Error: ${proxyRes.status}`,
                detail: errText,
            });
        }

        const data = await proxyRes.json();
        res.json(data);
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'LLM proxy timeout' });
        }
        res.status(502).json({ error: `LLM proxy failed: ${err.message}` });
    }
});

// ============================================================
// 执行历史查询 / Execution History Query (Phase 3)
// ============================================================

app.get('/api/runs/recent', authMiddleware, async (req: AuthRequest, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    try {
        const result = await pool.query(
            `SELECT r.*, w.name as workflow_name 
             FROM public.workflow_runs r
             LEFT JOIN public.workflows w ON r.workflow_id = w.id
             WHERE r.user_id = $1 
             ORDER BY r.started_at DESC 
             LIMIT $2`,
            [req.userId, limit]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 启动 / Start
// ============================================================

app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║  YYC³ Neural API Server                     ║');
    console.log('  ║  言语云魔方 - 本地 API 服务器                  ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  端口 / Port:   http://localhost:${PORT}        ║`);
    console.log('  ║  状态 / Status: ONLINE                      ║');
    console.log('  ║  数据库 / DB:   PostgreSQL 15                ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
});

*/

// ============================================================
// 本地数据库初始化 SQL / Local DB Init SQL
// ============================================================
// 
// 在运行 supabase/schema.sql 之前，先执行以下 SQL 创建本地替代的 auth schema：
// Run this SQL BEFORE running supabase/schema.sql to create local auth schema:
//
// ```sql
// -- 创建 auth schema / Create auth schema
// CREATE SCHEMA IF NOT EXISTS auth;
// 
// -- 创建用户表 / Create users table
// CREATE TABLE IF NOT EXISTS auth.users (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     username TEXT UNIQUE NOT NULL,
//     password_hash TEXT NOT NULL,
//     raw_user_meta_data JSONB DEFAULT '{}',
//     created_at TIMESTAMPTZ DEFAULT NOW()
// );
// 
// -- 创建 uid() 函数模拟 Supabase auth.uid()
// -- Create uid() function to simulate Supabase auth.uid()
// CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
//     SELECT COALESCE(
//         current_setting('request.jwt.claim.userId', true)::uuid,
//         '00000000-0000-0000-0000-000000000000'::uuid
//     );
// $$ LANGUAGE SQL STABLE;
// 
// -- 然后运行项目中的 supabase/schema.sql
// -- Then run the project's supabase/schema.sql
// ```
//
// ============================================================

export {};