/**
 * YYC3 Auth Store (Zustand)
 * 言语云立方 - 鉴权全局状态管理
 * 
 * 职责：用户登录/注册/登出、会话恢复、在线状态检测
 */

import { create } from 'zustand';
import { authApi, profileApi, checkApiHealth, offlineStore, type AuthUser, type ProfileUpdate } from '@/lib/pg-api';

// ============================================================
// 预置操作员账户 / Pre-seeded Operator Accounts
// API 离线时本地降级验证，API 上线后自动切换到 PostgreSQL
// ============================================================
const PRESET_OPERATORS: Record<string, { password: string; user: AuthUser }> = {
    'yyc3_max': {
        password: 'yyc3_max',
        user: {
            id: 'preset_yyc3_max',
            username: 'yyc3_max',
            avatar_url: null,
            theme_preference: 'cyan',
        },
    },
    'yyc3_m4': {
        password: 'yyc3_m4',
        user: {
            id: 'preset_yyc3_m4',
            username: 'yyc3_m4',
            avatar_url: null,
            theme_preference: 'cyan',
        },
    },
};

/**
 * 本地预置验证 / Local preset auth fallback
 * 仅在 API 离线时生效；返回 null 表示不匹配
 */
function tryPresetLogin(username: string, password: string): AuthUser | null {
    const entry = PRESET_OPERATORS[username];
    if (entry && entry.password === password) {
        return { ...entry.user };
    }
    return null;
}

export type ConnectionStatus = 'checking' | 'online' | 'offline';
export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthState {
    // 状态 / State
    user: AuthUser | null;
    authStatus: AuthStatus;
    connectionStatus: ConnectionStatus;
    apiLatency: number;
    error: string | null;

    // 操作 / Actions
    initialize: () => Promise<void>;
    login: (username: string, password: string) => Promise<boolean>;
    register: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    updateProfile: (data: ProfileUpdate) => Promise<boolean>;
    checkConnection: () => Promise<void>;
    clearError: () => void;
    continueAsGuest: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    authStatus: 'loading',
    connectionStatus: 'checking',
    apiLatency: 0,
    error: null,

    initialize: async () => {
        set({ authStatus: 'loading', connectionStatus: 'checking' });

        // 1. 检查 API 健康 / Check API health
        const health = await checkApiHealth();
        set({ 
            connectionStatus: health.online ? 'online' : 'offline',
            apiLatency: health.latency,
        });

        if (health.online && authApi.hasToken()) {
            // 2. 在线 + 有 Token → 恢复会话 / Online + Token → Restore session
            const res = await authApi.me();
            if (res.success && res.data) {
                set({ user: res.data, authStatus: 'authenticated' });
                offlineStore.saveUser(res.data);
                return;
            }
            // Token 无效 → 清除 / Token invalid → Clear
            authApi.logout();
        }

        // 3. 检查离线缓存 / Check offline cache
        const offlineUser = offlineStore.getUser();
        if (offlineUser && !health.online) {
            set({ user: offlineUser, authStatus: 'authenticated' });
            return;
        }

        // 4. 未认证 / Not authenticated
        set({ authStatus: 'guest' });
    },

    login: async (username, password) => {
        set({ error: null });
        const res = await authApi.login(username, password);
        
        if (res.offline) {
            // API 离线 → 尝试预置操作员本地验证 / Offline → try preset operator fallback
            const presetUser = tryPresetLogin(username, password);
            if (presetUser) {
                set({ user: presetUser, authStatus: 'authenticated' });
                offlineStore.saveUser(presetUser);
                return true;
            }
            set({ error: 'API 离线，仅预置操作员可登入 / API offline, only preset operators allowed' });
            return false;
        }
        
        if (!res.success) {
            set({ error: res.error || '登录失败 / Login failed' });
            return false;
        }

        if (res.data?.user) {
            set({ user: res.data.user, authStatus: 'authenticated' });
            offlineStore.saveUser(res.data.user);
        }
        return true;
    },

    register: async (username, password) => {
        set({ error: null });
        const res = await authApi.register(username, password);
        
        if (res.offline) {
            set({ error: 'API 离线，无法注册 / API offline, cannot register' });
            return false;
        }
        
        if (!res.success) {
            set({ error: res.error || '注册失败 / Registration failed' });
            return false;
        }

        if (res.data?.user) {
            set({ user: res.data.user, authStatus: 'authenticated' });
            offlineStore.saveUser(res.data.user);
        }
        return true;
    },

    logout: () => {
        authApi.logout();
        offlineStore.clearAll();
        set({ user: null, authStatus: 'guest', error: null });
    },

    updateProfile: async (data) => {
        const res = await profileApi.update(data);
        if (res.success && res.data) {
            set({ user: res.data });
            offlineStore.saveUser(res.data);
            return true;
        }
        // 离线时写入本地 / Write locally when offline
        if (res.offline) {
            const currentUser = get().user;
            if (currentUser) {
                const updated = { ...currentUser, ...data };
                set({ user: updated });
                offlineStore.saveUser(updated);
                offlineStore.addPendingAction({
                    type: 'profile_update',
                    payload: data,
                    timestamp: Date.now(),
                });
            }
            return true;
        }
        return false;
    },

    checkConnection: async () => {
        const health = await checkApiHealth();
        set({ 
            connectionStatus: health.online ? 'online' : 'offline',
            apiLatency: health.latency,
        });
    },

    clearError: () => set({ error: null }),

    continueAsGuest: () => {
        // 生成临时访客身份 / Generate temp guest identity
        const guestUser: AuthUser = {
            id: 'guest_' + Math.random().toString(36).substr(2, 9),
            username: 'GHOST_OPERATOR',
            avatar_url: null,
            theme_preference: 'cyan',
        };
        set({ user: guestUser, authStatus: 'authenticated' });
        offlineStore.saveUser(guestUser);
    },
}));