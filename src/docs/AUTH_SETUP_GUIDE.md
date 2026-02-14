# YanYuCloudCube - Authentication Setup & Operation Guide
# YanYuCloudCube - 鉴权设置与操作指导文档

**Version / 版本:** 1.0  
**Date / 日期:** 2026-02-14  
**Module / 模块:** AUTH_GATE (Phase 1: Neural Connection)  
**Tagline / 标语:** 万象归元于云枢丨深栈智启新纪元

---

## Table of Contents / 目录

1. [Overview / 概述](#1-overview--概述)
2. [Authentication Interface / 鉴权界面说明](#2-authentication-interface--鉴权界面说明)
3. [Registration Flow / 注册流程](#3-registration-flow--注册流程)
4. [Login Flow / 登录流程](#4-login-flow--登录流程)
5. [Ghost Mode / 幽灵模式](#5-ghost-mode--幽灵模式)
6. [Connection Status / 连接状态说明](#6-connection-status--连接状态说明)
7. [Session Management / 会话管理](#7-session-management--会话管理)
8. [Backend Setup / 后端配置](#8-backend-setup--后端配置)
9. [Security Notes / 安全须知](#9-security-notes--安全须知)
10. [Troubleshooting / 常见问题](#10-troubleshooting--常见问题)

---

## 1. Overview / 概述

YanYuCloudCube 采用全屏沉浸式赛博朋克鉴权门户 (AuthGate) 作为系统入口。所有用户在首次访问时必须通过 AuthGate 完成身份验证，方可进入主系统。鉴权系统支持三种接入方式：

YanYuCloudCube uses a full-screen immersive cyberpunk authentication gate (AuthGate) as the system entry point. All users must pass through the AuthGate for identity verification before accessing the main system. The auth system supports three access modes:

| Mode / 模式 | Description / 描述 | Persistence / 持久化 |
|---|---|---|
| **Register / 注册** | Create new operator identity / 创建新操作员身份 | PostgreSQL |
| **Login / 登录** | Authenticate existing identity / 验证已有身份 | PostgreSQL |
| **Ghost Mode / 幽灵模式** | Anonymous access, no server required / 匿名接入，无需服务器 | localStorage only |

### Architecture / 架构

```
AuthGate (Frontend UI)
    |
    v
useAuthStore (Zustand State Management)
    |
    v
pg-api.ts (API Client)
    |
    | HTTP REST + JWT Bearer Token
    |
    v
Express Server (:3721)
    |
    v
PostgreSQL 15 → auth.users + public.profiles
```

---

## 2. Authentication Interface / 鉴权界面说明

### 2.1 Interface Layout / 界面布局

AuthGate 界面由以下区域组成：

```
┌─────────────────────────────────────────────┐
│                              [Connection]   │  <- 连接状态徽章
│                                             │     Connection Badge
│              ╔══════╗                       │
│              ║ 🛡️  ║                       │  <- Shield 图标
│              ╚══════╝                       │
│          YanYuCloudCube                     │  <- 系统名称
│      NEURAL ACCESS PROTOCOL                 │  <- 英文副标题
│    万象归元于云枢丨深栈智启新纪元              │  <- 中文副标题
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  [接入/LOGIN]    [注册/REGISTER]      │   │  <- 模式切换标签页
│  ├──────────────────────────────────────┤   │
│  │                                      │   │
│  │  👤 操作员代号 / OPERATOR ID          │   │  <- 用户名标签
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 输入代号... / Enter callsign │    │   │  <- 用户名输入框
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  🔒 访问密钥 / ACCESS KEY            │   │  <- 密码标签
│  │  ┌──────────────────────────┬──┐    │   │
│  │  │ 输入密钥... / Enter key  │👁│    │   │  <- 密码输入框 + 可见性切换
│  │  └──────────────────────────┴──┘    │   │
│  │                                      │   │
│  │  [⚡ 神经接入 / CONNECT           ]  │   │  <- 提交按钮
│  │                                      │   │
│  │  ────────── OR // 或 ──────────      │   │  <- 分割线
│  │                                      │   │
│  │  [👻 幽灵模式接入 / GHOST MODE    ]  │   │  <- 幽灵模式按钮
│  │                                      │   │
│  ├──────────────────────────────────────┤   │
│  │  数据存储在本地 PostgreSQL 15...      │   │  <- 底部提示
│  └──────────────────────────────────────┘   │
│                                             │
│  YanYuCloudCube.AUTH_GATE.V1 // PHASE_1     │  <- 版本号
└─────────────────────────────────────────────┘
```

### 2.2 Field Definitions / 字段定义

#### 操作员代号 / OPERATOR ID

| Property / 属性 | Value / 值 |
|---|---|
| **Label / 标签** | `操作员代号 / OPERATOR ID` |
| **Placeholder / 占位符** | `输入代号... / Enter callsign...` |
| **Icon / 图标** | `User` (lucide-react) |
| **Type / 类型** | Text |
| **Validation / 验证** | Required, non-empty |
| **AutoComplete** | `username` |
| **Storage / 存储字段** | `auth.users.username` (UNIQUE constraint) |

**Usage / 用途:** 操作员代号是用户在 YanYuCloudCube 系统中的唯一身份标识。代号一旦注册不可更改（但 `profiles.username` 显示名可修改）。代号在所有操作员中必须唯一。

The Operator ID is the user's unique identity identifier within the YanYuCloudCube system. Once registered, the callsign cannot be changed (though the display name in `profiles.username` can be modified). The callsign must be unique across all operators.

#### 访问密钥 / ACCESS KEY

| Property / 属性 | Value / 值 |
|---|---|
| **Label / 标签** | `访问密钥 / ACCESS KEY` |
| **Placeholder / 占位符** | `输入密钥... / Enter key...` |
| **Icon / 图标** | `Lock` (lucide-react) |
| **Type / 类型** | Password (toggleable visibility) |
| **Validation / 验证** | Required, minimum 4 characters |
| **AutoComplete** | `current-password` (login) / `new-password` (register) |
| **Storage / 存储** | `auth.users.password_hash` (bcrypt, 12 rounds) |
| **Visibility Toggle / 可见性切换** | Eye / EyeOff icon button on the right side |

**Usage / 用途:** 访问密钥用于验证操作员身份。密钥以 bcrypt (12 轮加盐) 散列存储，服务器端永不明文保存。密钥最短 4 个字符，建议使用 8 位以上包含字母和数字的组合。

The Access Key authenticates the operator's identity. Keys are stored as bcrypt hashes (12 salt rounds) and are never saved in plaintext on the server. Minimum 4 characters; recommend 8+ characters with alphanumeric mix.

---

## 3. Registration Flow / 注册流程

### 3.1 Step-by-Step / 操作步骤

```
Step 1: 检查连接状态
        Check Connection Status
        ┌─────────────────────────────┐
        │ 右上角连接徽章显示：         │
        │ ✅ 在线/ONLINE → 可注册     │
        │ ❌ 离线/OFFLINE → 仅幽灵模式 │
        └─────────────────────────────┘
              │
              v
Step 2: 切换到 "注册 / REGISTER" 标签
        Switch to "注册 / REGISTER" tab
        ┌─────────────────────────────┐
        │ 点击顶部第二个标签页         │
        │ Click the second tab        │
        └─────────────────────────────┘
              │
              v
Step 3: 输入操作员代号
        Enter Operator ID
        ┌─────────────────────────────┐
        │ 在 "操作员代号" 字段输入      │
        │ 选择一个唯一代号             │
        │ Examples: CYBER_OPS_01      │
        │           NEURAL_PILOT      │
        │           ghost_runner_7    │
        └─────────────────────────────┘
              │
              v
Step 4: 输入访问密钥
        Enter Access Key
        ┌─────────────────────────────┐
        │ 在 "访问密钥" 字段输入       │
        │ 至少 4 个字符                │
        │ 点击 👁 图标可切换明文显示    │
        └─────────────────────────────┘
              │
              v
Step 5: 点击 "注册节点 / REGISTER NODE"
        Click "注册节点 / REGISTER NODE"
        ┌─────────────────────────────┐
        │ 系统执行：                    │
        │ 1. POST /api/auth/register  │
        │ 2. bcrypt 加密密钥           │
        │ 3. 创建 auth.users 记录      │
        │ 4. 创建 profiles 记录        │
        │ 5. 签发 JWT Token (30天)     │
        │ 6. 存储 Token 到 localStorage│
        │ 7. 自动进入系统               │
        └─────────────────────────────┘
```

### 3.2 Server-Side Processing / 服务端处理

```
POST /api/auth/register
Body: { "username": "CYBER_OPS_01", "password": "my_key_1234" }

Server Actions:
  1. Validate: username non-empty, password >= 4 chars
  2. Check uniqueness: SELECT id FROM auth.users WHERE username = $1
  3. Hash password: bcrypt.hash(password, 12)
  4. Insert user: INSERT INTO auth.users (id, username, password_hash, raw_user_meta_data)
  5. Create profile: INSERT INTO profiles (id, username, theme_preference) VALUES ($1, $2, 'cyan')
  6. Sign JWT: jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' })
  7. Return: { token, user: { id, username, avatar_url, theme_preference } }
```

### 3.3 Error Scenarios / 错误场景

| Error / 错误 | Cause / 原因 | Display / 显示 |
|---|---|---|
| `代号已被占用 / Callsign already taken` | Username exists in DB | Red alert box |
| `用户名和密码不能为空 / Username and password required` | Empty fields | Red alert box |
| `密码至少4个字符 / Password min 4 characters` | Password too short | Red alert box |
| `API 离线，无法注册 / API offline, cannot register` | Server unreachable | Red alert box |

---

## 4. Login Flow / 登录流程

### 4.1 Step-by-Step / 操作步骤

```
Step 1: 确认在 "接入 / LOGIN" 标签（默认选中）
        Ensure on "接入 / LOGIN" tab (default selected)
              │
              v
Step 2: 输入已注册的操作员代号
        Enter registered Operator ID
        ┌─────────────────────────────┐
        │ "操作员代号" 字段             │
        │ 输入注册时使用的代号          │
        └─────────────────────────────┘
              │
              v
Step 3: 输入访问密钥
        Enter Access Key
        ┌─────────────────────────────┐
        │ "访问密钥" 字段              │
        │ 输入注册时设定的密钥          │
        └─────────────────────────────┘
              │
              v
Step 4: 点击 "神经接入 / CONNECT"
        Click "神经接入 / CONNECT"
        ┌─────────────────────────────┐
        │ 系统执行：                    │
        │ 1. POST /api/auth/login     │
        │ 2. bcrypt.compare 验证密钥   │
        │ 3. 查询 profiles 获取配置    │
        │ 4. 签发 JWT Token (30天)     │
        │ 5. 存储 Token + User 缓存    │
        │ 6. 自动进入系统               │
        └─────────────────────────────┘
```

### 4.2 Session Restore / 会话自动恢复

当用户刷新页面或重新打开浏览器时，系统自动尝试恢复会话：

When users refresh or reopen the browser, the system automatically attempts session restoration:

```
Page Load
    │
    v
useAuthStore.initialize()
    │
    v
checkApiHealth() ──────────────────────────┐
    │                                       │
    │ Online?                               │ Offline?
    │                                       │
    v                                       v
Has JWT Token?                        Has offline user cache?
    │ Yes          │ No                │ Yes         │ No
    v              v                   v             v
GET /api/auth/me   Show AuthGate      Restore       Show AuthGate
    │                                 from cache
    │ 200 OK?       │ 401?
    v               v
Restore session   Clear token
Show main app     Show AuthGate
```

### 4.3 Error Scenarios / 错误场景

| Error / 错误 | Cause / 原因 | Display / 显示 |
|---|---|---|
| `代号不存在 / Callsign not found` | Username not in DB | Red alert box |
| `访问密钥错误 / Invalid access key` | Wrong password | Red alert box |
| `API 离线，无法登录 / API offline, cannot login` | Server unreachable | Red alert box |

---

## 5. Ghost Mode / 幽灵模式

### 5.1 What is Ghost Mode / 什么是幽灵模式

幽灵模式允许用户在不连接后端服务器的情况下使用系统核心功能。适用于：

Ghost Mode allows users to access core system features without a backend server connection. Suitable for:

- API 服务器离线或未部署时 / When API server is offline or not deployed
- 快速体验系统功能 / Quick system preview
- 无需注册的临时使用 / Temporary use without registration

### 5.2 Operation / 操作方式

1. Click "幽灵模式接入 / GHOST MODE (No Persistence)" button
2. System generates a temporary guest identity:
   ```json
   {
     "id": "guest_a1b2c3d4e",
     "username": "GHOST_OPERATOR",
     "avatar_url": null,
     "theme_preference": "cyan"
   }
   ```
3. User data stored in `localStorage` only
4. System enters main interface immediately

### 5.3 Limitations / 限制

| Feature / 功能 | Ghost Mode | Authenticated |
|---|---|---|
| DAG Workflow Editor | Available | Available |
| DAG Execution | Available | Available |
| LLM API Calls | Available | Available |
| Config Persistence | localStorage only | PostgreSQL + localStorage |
| Workflow Save to PG | Not available | Available |
| Run History (PG) | Not available | Available |
| Cross-device Sync | Not available | Available |
| Profile Settings | Local only | Synced |

---

## 6. Connection Status / 连接状态说明

### 6.1 Status Badge / 状态徽章

AuthGate 右上角显示实时连接状态：

The top-right corner of AuthGate shows real-time connection status:

| Status / 状态 | Icon | Display / 显示 | Meaning / 含义 |
|---|---|---|---|
| `checking` | Spinner | `检测中 / PROBING` | Initial health check in progress |
| `online` | Wifi | `在线 / ONLINE (XXms)` | Server connected, shows latency |
| `offline` | WifiOff | `离线 / OFFLINE` | Server unreachable |

### 6.2 Health Check Mechanism / 健康检查机制

```
checkApiHealth()
    │
    v
GET http://localhost:3721/api/health
    │
    │ Timeout: 3 seconds
    │
    ├── 200 OK → { online: true, latency: XX }
    │
    └── Error/Timeout → { online: false, latency: 0 }
```

### 6.3 Impact on AuthGate / 对 AuthGate 的影响

- **Online / 在线:** All three modes available (Register, Login, Ghost)
- **Offline / 离线:** 
  - Register/Login disabled (show error on attempt)
  - Ghost Mode always available
  - Footer shows: `[ API 离线 ] 仅幽灵模式可用，数据存储在本地浏览器`

---

## 7. Session Management / 会话管理

### 7.1 JWT Token / JWT 令牌

| Property / 属性 | Value / 值 |
|---|---|
| **Algorithm** | HS256 (default) |
| **Expiry / 有效期** | 30 days |
| **Storage / 存储位置** | `localStorage['yyc3_jwt']` |
| **Payload** | `{ userId: string }` |
| **Header Format** | `Authorization: Bearer <token>` |

### 7.2 Token Lifecycle / Token 生命周期

```
Register/Login Success
    │
    v
JWT Token Generated (Server)
    │
    v
Token Stored → localStorage['yyc3_jwt']
    │
    v
All API Requests → Authorization: Bearer <token>
    │
    ├── 200 OK → Continue
    │
    └── 401 Unauthorized → Token Expired
                              │
                              v
                         Clear Token
                         Show AuthGate
```

### 7.3 Offline User Cache / 离线用户缓存

用户成功登录后，用户信息同时缓存到 `localStorage`：

After successful login, user info is also cached in `localStorage`:

```
localStorage['yyc3_offline_user'] = JSON.stringify({
    id: "uuid",
    username: "CYBER_OPS_01",
    avatar_url: null,
    theme_preference: "cyan"
});
```

When server is offline but offline cache exists, session is restored from cache.

### 7.4 Logout / 登出

执行登出时：/ On logout:

1. `authApi.logout()` → Removes `localStorage['yyc3_jwt']`
2. `offlineStore.clearAll()` → Removes all offline cached data
3. State reset: `user: null, authStatus: 'guest'`
4. AuthGate re-displayed

---

## 8. Backend Setup / 后端配置

### 8.1 Database Tables Required / 所需数据库表

#### auth.users (Local Auth Schema)

```sql
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    raw_user_meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### public.profiles

```sql
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    avatar_url TEXT,
    theme_preference TEXT CHECK (theme_preference IN ('cyan', 'red', 'dark')) DEFAULT 'cyan',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Express Server Endpoints / API 端点

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (no auth required) |
| `POST` | `/api/auth/register` | Register new operator |
| `POST` | `/api/auth/login` | Login with credentials |
| `GET` | `/api/auth/me` | Get current user profile (auth required) |
| `GET` | `/api/profile` | Get profile details |
| `PUT` | `/api/profile` | Update profile (username, avatar, theme) |

### 8.3 Quick Setup / 快速配置

Refer to `/docs/PHASE3_OPERATION_GUIDE.md` Sections 3-4 for complete database and server setup instructions. The essential steps are:

```bash
# 1. Create database
psql -U postgres -c "CREATE DATABASE yyc3;"

# 2. Create auth schema (see PHASE3_OPERATION_GUIDE.md Section 3.2)

# 3. Run schema.sql
psql -U postgres -d yyc3 -f supabase/schema.sql

# 4. Start Express Server
cd yyc3-api && npx tsx server.ts
```

---

## 9. Security Notes / 安全须知

### 9.1 Password Handling / 密钥处理

- Passwords are NEVER stored in plaintext / 密钥绝不以明文存储
- bcrypt with 12 salt rounds / 使用 12 轮加盐的 bcrypt
- Password transmitted via HTTPS (when configured) / 密钥通过 HTTPS 传输
- Minimum 4 characters enforced / 强制最少 4 字符

### 9.2 Token Security / 令牌安全

- JWT stored in localStorage (accessible to JavaScript) / JWT 存于 localStorage
- Token auto-cleared on 401 response / 收到 401 响应时自动清除令牌
- 30-day expiry limits exposure window / 30 天有效期限制暴露窗口
- **Production:** Change `JWT_SECRET` from default value / 生产环境务必修改 `JWT_SECRET`

### 9.3 CORS Configuration / CORS 配置

Default allowed origins:
```
http://localhost:5173
http://localhost:3000
http://127.0.0.1:5173
```

**Production:** Add your deployment domain to the CORS origin list.

### 9.4 Important Disclaimer / 重要声明

> YanYuCloudCube is designed for internal/personal use. The authentication system is NOT intended for collecting PII (Personally Identifiable Information) or securing highly sensitive data. For production deployments handling sensitive data, implement additional security measures (HTTPS enforcement, rate limiting, CSRF protection, etc.).
>
> YanYuCloudCube 设计用于内部/个人使用。鉴权系统不用于收集个人身份信息 (PII) 或保护高度敏感数据。对于处理敏感数据的生产部署，请实施额外的安全措施（强制 HTTPS、速率限制、CSRF 防护等）。

---

## 10. Troubleshooting / 常见问题

### Q1: 注册时提示 "代号已被占用" / "Callsign already taken" on register

**Cause / 原因:** The username already exists in `auth.users`.  
**Solution / 解决:** Choose a different callsign, or login with the existing one.

### Q2: 登录时提示 "API 离线" / "API offline" on login

**Cause / 原因:** Express Server is not running or unreachable.  
**Solution / 解决:**
1. Start the server: `cd yyc3-api && npx tsx server.ts`
2. Verify: `curl http://localhost:3721/api/health`
3. Check firewall and port availability
4. Alternative: Use Ghost Mode for temporary access

### Q3: 页面刷新后需要重新登录 / Need to re-login after page refresh

**Cause / 原因:** JWT token expired or was cleared.  
**Solution / 解决:**
1. Check if `localStorage['yyc3_jwt']` exists (DevTools → Application → Local Storage)
2. Token expires after 30 days; re-login to get a new token
3. If server returns 401, token is auto-cleared

### Q4: 连接状态一直显示 "检测中" / Connection status stuck on "PROBING"

**Cause / 原因:** Health check hanging (slow network or DNS resolution).  
**Solution / 解决:**
1. Health check has a 3-second timeout
2. Check network connectivity
3. Verify `API_BASE` URL in `/lib/pg-api.ts`

### Q5: 幽灵模式数据丢失 / Ghost Mode data lost

**Cause / 原因:** Ghost Mode data is stored in `localStorage` only.  
**Solution / 解决:**
1. Clearing browser data will remove all Ghost Mode data
2. For persistent storage, register an account and connect to the server
3. Ghost Mode does not sync across devices

### Q6: 如何修改操作员代号 / How to change Operator ID

**Current limitation / 当前限制:** The `auth.users.username` field (Operator ID used for login) cannot be changed through the UI. However, the display name (`profiles.username`) can be updated via the Profile settings panel.

To change the login callsign, you would need to:
1. Register a new account with the desired callsign
2. Or update directly in the database:
   ```sql
   UPDATE auth.users SET username = 'NEW_CALLSIGN' WHERE id = 'user-uuid';
   UPDATE public.profiles SET username = 'NEW_CALLSIGN' WHERE id = 'user-uuid';
   ```

---

## Appendix: UI Text Reference / 界面文本参考

| Location / 位置 | Chinese / 中文 | English / 英文 |
|---|---|---|
| System Title | - | YanYuCloudCube |
| Subtitle Line 1 | - | NEURAL ACCESS PROTOCOL |
| Subtitle Line 2 | 万象归元于云枢丨深栈智启新纪元 | - |
| Login Tab | 接入 | LOGIN |
| Register Tab | 注册 | REGISTER |
| Username Label | 操作员代号 | OPERATOR ID |
| Username Placeholder | 输入代号... | Enter callsign... |
| Password Label | 访问密钥 | ACCESS KEY |
| Password Placeholder | 输入密钥... | Enter key... |
| Login Button | 神经接入 | CONNECT |
| Register Button | 注册节点 | REGISTER NODE |
| Divider | 或 | OR |
| Ghost Mode Button | 幽灵模式接入 | GHOST MODE (No Persistence) |
| Online Footer | 数据存储在本地 PostgreSQL 15 实例中，仅内部使用。 | Data persisted in local PostgreSQL 15. Internal use only. |
| Offline Footer | [ API 离线 ] 仅幽灵模式可用，数据存储在本地浏览器。 | [ API OFFLINE ] Only ghost mode available. Data stored locally. |
| Version | - | YanYuCloudCube.AUTH_GATE.V1 // PHASE_1: NEURAL_CONNECTION |
| Loading Text | 正在初始化神经握手协议... | NEURAL HANDSHAKE INITIALIZING... |

---

*End of Auth Setup Guide / 鉴权设置指导文档结束*

*Generated: 2026-02-14 | YanYuCloudCube AI Assistant*
