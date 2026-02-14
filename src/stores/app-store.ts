/**
 * YYC3 App Store (Zustand)
 * 言语云立方 - 应用级全局状态管理
 * 
 * 职责：主题、面板可见性、导航、连接状态显示
 */

import { create } from 'zustand';
import { useAuthStore } from './auth-store';
import { offlineStore } from '@/lib/pg-api';

export type ThemeColor = 'cyan' | 'red';
export type PanelId = 'home' | 'tasks' | 'mcp' | 'workflow' | 'ai_gen' | 'intelligent' | 'security' | 'config' | 'history' | 'debate';

interface AppState {
    // 主题 / Theme
    themeColor: ThemeColor;
    setThemeColor: (color: ThemeColor) => void;
    toggleTheme: () => void;

    // 面板导航 / Panel Navigation
    activePanel: PanelId;
    previousPanel: PanelId;
    navigateTo: (panel: PanelId) => void;
    goBack: () => void;

    // 同步指示器 / Sync Indicator
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
    lastSyncTime: number | null;
    setSyncStatus: (status: AppState['syncStatus']) => void;

    // 初始化 / Initialize
    initializeTheme: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    // --- 主题 / Theme ---
    themeColor: 'cyan',
    
    setThemeColor: (color) => {
        set({ themeColor: color });
        offlineStore.saveTheme(color);
        
        // 如果已认证，同步到 PG / If authenticated, sync to PG
        const { user, updateProfile, connectionStatus } = useAuthStore.getState();
        if (user && connectionStatus === 'online' && !user.id.startsWith('guest_')) {
            updateProfile({ theme_preference: color });
        }
    },

    toggleTheme: () => {
        const next = get().themeColor === 'cyan' ? 'red' : 'cyan';
        get().setThemeColor(next);
    },

    // --- 面板导航 / Panel Navigation ---
    activePanel: 'home',
    previousPanel: 'home',

    navigateTo: (panel) => {
        set(state => ({
            previousPanel: state.activePanel,
            activePanel: panel,
        }));
    },

    goBack: () => {
        set(state => ({
            activePanel: state.previousPanel,
            previousPanel: 'home',
        }));
    },

    // --- 同步 / Sync ---
    syncStatus: 'idle',
    lastSyncTime: null,

    setSyncStatus: (status) => {
        set({ 
            syncStatus: status,
            ...(status === 'synced' ? { lastSyncTime: Date.now() } : {}),
        });
    },

    // --- 初始化 / Initialize ---
    initializeTheme: () => {
        // 优先使用用户偏好 / Prefer user preference
        const { user } = useAuthStore.getState();
        if (user?.theme_preference && user.theme_preference !== 'dark') {
            set({ themeColor: user.theme_preference as ThemeColor });
            return;
        }
        // 其次使用本地缓存 / Then use local cache
        const cached = offlineStore.getTheme();
        if (cached && cached !== 'dark') {
            set({ themeColor: cached as ThemeColor });
        }
    },
}));
