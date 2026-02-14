/**
 * YYC3 PostgreSQL REST API Client
 * 言语云魔方 - 本地 PostgreSQL 数据持久化 API 客户端
 * 
 * 连接本地 Express API Server → PostgreSQL 15
 * 自动降级到 localStorage（离线模式/Offline Fallback）
 */

// ============================================================
// API 基础配置 / Base Configuration
// ============================================================

const API_BASE = (() => {
    try {
        return import.meta.env?.VITE_API_URL || 'http://localhost:3721/api';
    } catch {
        return 'http://localhost:3721/api';
    }
})();

// Token 管理 / Token Management
const TOKEN_KEY = 'yyc3_jwt';
const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ============================================================
// 类型定义 / Type Definitions
// ============================================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    offline?: boolean; // 离线模式标识 / Offline mode flag
}

export interface AuthUser {
    id: string;
    username: string;
    avatar_url: string | null;
    theme_preference: 'cyan' | 'red' | 'dark';
    created_at?: string;
}

export interface AuthTokens {
    token: string;
    user: AuthUser;
}

export interface ProfileUpdate {
    username?: string;
    avatar_url?: string | null;
    theme_preference?: 'cyan' | 'red' | 'dark';
}

export interface AIConfigRow {
    id: string;
    user_id: string;
    name: string;
    provider: string;
    model: string;
    base_url: string | null;
    settings: Record<string, any>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AIConfigCreate {
    name: string;
    provider: string;
    model: string;
    base_url?: string;
    settings?: Record<string, any>;
    is_active?: boolean;
}

export interface WorkflowRow {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    definition: Record<string, any>;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

export interface WorkflowCreate {
    name: string;
    description?: string;
    definition: Record<string, any>;
    is_public?: boolean;
}

export interface WorkflowRunRow {
    id: string;
    workflow_id: string;
    user_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    logs: any[];
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    workflow_name?: string; // joined field from /api/runs/recent
}

export interface WorkflowRunUpdate {
    status?: 'running' | 'completed' | 'failed';
    logs?: any[];
    duration_ms?: number;
}

// ============================================================
// 核心请求函数 / Core Request Function
// ============================================================

let _isOnline: boolean | null = null; // 缓存连接状态 / Cache connection state
let _lastCheck = 0;

async function request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false
): Promise<ApiResponse<T>> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (!skipAuth) {
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        _isOnline = true;
        _lastCheck = Date.now();

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            
            // 401 = Token 过期，清除 / Token expired, clear
            if (response.status === 401) {
                clearToken();
            }
            
            return {
                success: false,
                error: errBody.error || `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (err: any) {
        // 网络错误 = 离线 / Network error = offline
        if (err.name === 'AbortError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            _isOnline = false;
            _lastCheck = Date.now();
            return { success: false, error: 'OFFLINE', offline: true };
        }
        return { success: false, error: String(err) };
    }
}

// ============================================================
// 连接状态检查 / Connection Health Check
// ============================================================

export async function checkApiHealth(): Promise<{ online: boolean; latency: number }> {
    const start = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const latency = Math.round(performance.now() - start);
        _isOnline = res.ok;
        _lastCheck = Date.now();
        return { online: res.ok, latency };
    } catch {
        _isOnline = false;
        _lastCheck = Date.now();
        return { online: false, latency: 0 };
    }
}

export function isApiOnline(): boolean {
    // 5秒内的缓存有效 / Cache valid for 5 seconds
    if (_isOnline !== null && Date.now() - _lastCheck < 5000) return _isOnline;
    return _isOnline ?? false;
}

// ============================================================
// 鉴权 API / Auth API
// ============================================================

export const authApi = {
    async register(username: string, password: string): Promise<ApiResponse<AuthTokens>> {
        const res = await request<AuthTokens>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }, true);
        
        if (res.success && res.data?.token) {
            setToken(res.data.token);
        }
        return res;
    },

    async login(username: string, password: string): Promise<ApiResponse<AuthTokens>> {
        const res = await request<AuthTokens>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }, true);
        
        if (res.success && res.data?.token) {
            setToken(res.data.token);
        }
        return res;
    },

    async me(): Promise<ApiResponse<AuthUser>> {
        return request<AuthUser>('/auth/me');
    },

    logout() {
        clearToken();
    },

    hasToken(): boolean {
        return !!getToken();
    },
};

// ============================================================
// 用户配置 API / Profile API
// ============================================================

export const profileApi = {
    async get(): Promise<ApiResponse<AuthUser>> {
        return request<AuthUser>('/profile');
    },

    async update(data: ProfileUpdate): Promise<ApiResponse<AuthUser>> {
        return request<AuthUser>('/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};

// ============================================================
// AI 配置 API / AI Configs API
// ============================================================

export const configsApi = {
    async list(): Promise<ApiResponse<AIConfigRow[]>> {
        return request<AIConfigRow[]>('/configs');
    },

    async create(data: AIConfigCreate): Promise<ApiResponse<AIConfigRow>> {
        return request<AIConfigRow>('/configs', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id: string, data: Partial<AIConfigCreate>): Promise<ApiResponse<AIConfigRow>> {
        return request<AIConfigRow>(`/configs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async delete(id: string): Promise<ApiResponse<void>> {
        return request<void>(`/configs/${id}`, { method: 'DELETE' });
    },

    async setActive(id: string): Promise<ApiResponse<AIConfigRow>> {
        return request<AIConfigRow>(`/configs/${id}/activate`, { method: 'POST' });
    },
};

// ============================================================
// 工作流 API / Workflows API
// ============================================================

export const workflowsApi = {
    async list(): Promise<ApiResponse<WorkflowRow[]>> {
        return request<WorkflowRow[]>('/workflows');
    },

    async get(id: string): Promise<ApiResponse<WorkflowRow>> {
        return request<WorkflowRow>(`/workflows/${id}`);
    },

    async create(data: WorkflowCreate): Promise<ApiResponse<WorkflowRow>> {
        return request<WorkflowRow>('/workflows', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id: string, data: Partial<WorkflowCreate>): Promise<ApiResponse<WorkflowRow>> {
        return request<WorkflowRow>(`/workflows/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async delete(id: string): Promise<ApiResponse<void>> {
        return request<void>(`/workflows/${id}`, { method: 'DELETE' });
    },

    async listRuns(workflowId: string): Promise<ApiResponse<WorkflowRunRow[]>> {
        return request<WorkflowRunRow[]>(`/workflows/${workflowId}/runs`);
    },

    async createRun(workflowId: string): Promise<ApiResponse<WorkflowRunRow>> {
        return request<WorkflowRunRow>(`/workflows/${workflowId}/runs`, { method: 'POST' });
    },

    async updateRun(workflowId: string, runId: string, data: WorkflowRunUpdate): Promise<ApiResponse<WorkflowRunRow>> {
        return request<WorkflowRunRow>(`/workflows/${workflowId}/runs/${runId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async appendRunLogs(workflowId: string, runId: string, entries: any[]): Promise<ApiResponse<void>> {
        return request<void>(`/workflows/${workflowId}/runs/${runId}/logs`, {
            method: 'POST',
            body: JSON.stringify({ entries }),
        });
    },
};

// ============================================================
// 执行历史 API / Execution History API (Phase 3)
// ============================================================

export const runsApi = {
    async recent(limit = 20): Promise<ApiResponse<WorkflowRunRow[]>> {
        return request<WorkflowRunRow[]>(`/runs/recent?limit=${limit}`);
    },
};

// ============================================================
// LLM 代理 API / LLM Proxy API (Phase 3)
// 通过本地 Express Server 代理 LLM 请求，绕过 CORS/Mixed Content
// ============================================================

export const llmProxyApi = {
    async completion(url: string, headers: Record<string, string>, body: any, timeout?: number): Promise<ApiResponse<any>> {
        return request<any>('/llm/proxy', {
            method: 'POST',
            body: JSON.stringify({ url, headers, body, timeout }),
        });
    },
};

// ============================================================
// 离线降级存储 / Offline Fallback Storage
// ============================================================

const OFFLINE_KEYS = {
    user: 'yyc3_offline_user',
    configs: 'yyc3_offline_configs',
    theme: 'yyc3_offline_theme',
    workflows: 'yyc3_offline_workflows',
    pendingSync: 'yyc3_pending_sync',
};

export const offlineStore = {
    saveUser(user: AuthUser) {
        localStorage.setItem(OFFLINE_KEYS.user, JSON.stringify(user));
    },
    getUser(): AuthUser | null {
        const raw = localStorage.getItem(OFFLINE_KEYS.user);
        return raw ? JSON.parse(raw) : null;
    },

    saveConfigs(configs: AIConfigRow[]) {
        localStorage.setItem(OFFLINE_KEYS.configs, JSON.stringify(configs));
    },
    getConfigs(): AIConfigRow[] {
        const raw = localStorage.getItem(OFFLINE_KEYS.configs);
        return raw ? JSON.parse(raw) : [];
    },

    saveTheme(theme: 'cyan' | 'red' | 'dark') {
        localStorage.setItem(OFFLINE_KEYS.theme, theme);
    },
    getTheme(): 'cyan' | 'red' | 'dark' {
        return (localStorage.getItem(OFFLINE_KEYS.theme) as any) || 'cyan';
    },

    saveWorkflows(workflows: WorkflowRow[]) {
        localStorage.setItem(OFFLINE_KEYS.workflows, JSON.stringify(workflows));
    },
    getWorkflows(): WorkflowRow[] {
        const raw = localStorage.getItem(OFFLINE_KEYS.workflows);
        return raw ? JSON.parse(raw) : [];
    },

    // 待同步队列 / Pending sync queue
    addPendingAction(action: { type: string; payload: any; timestamp: number }) {
        const pending = this.getPendingActions();
        pending.push(action);
        localStorage.setItem(OFFLINE_KEYS.pendingSync, JSON.stringify(pending));
    },
    getPendingActions(): any[] {
        const raw = localStorage.getItem(OFFLINE_KEYS.pendingSync);
        return raw ? JSON.parse(raw) : [];
    },
    clearPendingActions() {
        localStorage.removeItem(OFFLINE_KEYS.pendingSync);
    },

    clearAll() {
        Object.values(OFFLINE_KEYS).forEach(k => localStorage.removeItem(k));
    },
};