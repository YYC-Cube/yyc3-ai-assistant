/**
 * YYC3 Config Store (Zustand)
 * 言语云立方 - AI 配置全局状态管理
 * 
 * 职责：AI Config CRUD、从 PG 同步、离线降级、活跃配置切换
 */

import { create } from 'zustand';
import { configsApi, offlineStore, type AIConfigRow, type AIConfigCreate } from '@/lib/pg-api';
import { useAuthStore } from './auth-store';
import { LLMConfig } from '@/types';

// 默认配置（与原 useAI 保持一致）/ Default config (consistent with original useAI)
export const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3',
    systemPrompt: '你是言语云（YanYuCloud）的智能助手，一个存在于全息魔方中的数字生命。请用简洁、富有科技感和哲学深度的语言回答用户。',
    ttsProvider: 'browser',
    ttsModel: 'tts-1',
    ttsVoice: 'alloy',
    ttsSpeed: 1.0,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2048,
};

interface ConfigState {
    // 状态 / State
    configs: AIConfigRow[];
    activeConfig: LLMConfig;
    activeConfigId: string | null;
    isLoading: boolean;
    isSynced: boolean;  // 是否已从 PG 同步 / Whether synced from PG

    // 操作 / Actions
    loadConfigs: () => Promise<void>;
    createConfig: (data: AIConfigCreate) => Promise<boolean>;
    updateConfig: (id: string, data: Partial<AIConfigCreate>) => Promise<boolean>;
    deleteConfig: (id: string) => Promise<boolean>;
    setActiveConfig: (id: string) => Promise<void>;
    applyLocalConfig: (config: Partial<LLMConfig>) => void;
    getActiveAsLLMConfig: () => LLMConfig;
}

/**
 * 将 PG 行数据转换为本地 LLMConfig / Convert PG row to local LLMConfig
 */
function rowToLLMConfig(row: AIConfigRow): LLMConfig {
    const settings = (row.settings || {}) as Record<string, any>;
    return {
        provider: row.provider as LLMConfig['provider'],
        baseUrl: row.base_url || DEFAULT_LLM_CONFIG.baseUrl,
        apiKey: settings.apiKey || '',
        model: row.model,
        systemPrompt: settings.systemPrompt || DEFAULT_LLM_CONFIG.systemPrompt,
        ttsProvider: settings.ttsProvider || 'browser',
        ttsModel: settings.ttsModel || 'tts-1',
        ttsVoice: settings.ttsVoice || 'alloy',
        ttsSpeed: settings.ttsSpeed || 1.0,
        temperature: settings.temperature ?? 0.7,
        topP: settings.topP ?? 0.9,
        maxTokens: settings.maxTokens ?? 2048,
        customModelName: settings.customModelName,
    };
}

/**
 * 将 LLMConfig 转换为 PG 创建数据 / Convert LLMConfig to PG create data
 */
function llmConfigToCreate(name: string, config: LLMConfig): AIConfigCreate {
    return {
        name,
        provider: config.provider,
        model: config.model,
        base_url: config.baseUrl,
        settings: {
            apiKey: config.apiKey,
            systemPrompt: config.systemPrompt,
            ttsProvider: config.ttsProvider,
            ttsModel: config.ttsModel,
            ttsVoice: config.ttsVoice,
            ttsSpeed: config.ttsSpeed,
            temperature: config.temperature,
            topP: config.topP,
            maxTokens: config.maxTokens,
            customModelName: config.customModelName,
        },
        is_active: true,
    };
}

export const useConfigStore = create<ConfigState>((set, get) => ({
    configs: [],
    activeConfig: { ...DEFAULT_LLM_CONFIG },
    activeConfigId: null,
    isLoading: false,
    isSynced: false,

    loadConfigs: async () => {
        set({ isLoading: true });

        // 先加载本地缓存 / Load local cache first
        const localConfigs = offlineStore.getConfigs();
        if (localConfigs.length > 0) {
            const active = localConfigs.find(c => c.is_active) || localConfigs[0];
            set({ 
                configs: localConfigs, 
                activeConfig: rowToLLMConfig(active),
                activeConfigId: active.id,
            });
        }

        // 尝试从 PG 拉取 / Try to pull from PG
        const { connectionStatus } = useAuthStore.getState();
        if (connectionStatus === 'online') {
            const res = await configsApi.list();
            if (res.success && res.data) {
                offlineStore.saveConfigs(res.data);
                const active = res.data.find(c => c.is_active) || res.data[0];
                set({ 
                    configs: res.data, 
                    isSynced: true,
                    ...(active ? {
                        activeConfig: rowToLLMConfig(active),
                        activeConfigId: active.id,
                    } : {}),
                });
            }
        }

        // 如果完全没有配置，使用默认 / If no configs at all, use defaults
        if (get().configs.length === 0) {
            // 从旧的 localStorage 迁移 / Migrate from old localStorage
            const oldConfig = localStorage.getItem('yyc_config');
            if (oldConfig) {
                try {
                    const parsed = JSON.parse(oldConfig);
                    set({ activeConfig: { ...DEFAULT_LLM_CONFIG, ...parsed } });
                } catch { /* ignore */ }
            }
        }

        set({ isLoading: false });
    },

    createConfig: async (data) => {
        const res = await configsApi.create(data);
        if (res.success && res.data) {
            set(state => {
                const updated = [...state.configs, res.data!];
                offlineStore.saveConfigs(updated);
                return { configs: updated };
            });
            return true;
        }
        if (res.offline) {
            // 离线创建临时记录 / Offline: create temp record
            const tempRow: AIConfigRow = {
                id: 'local_' + Date.now(),
                user_id: 'local',
                name: data.name,
                provider: data.provider,
                model: data.model,
                base_url: data.base_url || null,
                settings: data.settings || {},
                is_active: data.is_active ?? false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            set(state => {
                const updated = [...state.configs, tempRow];
                offlineStore.saveConfigs(updated);
                return { configs: updated };
            });
            offlineStore.addPendingAction({ type: 'config_create', payload: data, timestamp: Date.now() });
            return true;
        }
        return false;
    },

    updateConfig: async (id, data) => {
        const res = await configsApi.update(id, data);
        if (res.success && res.data) {
            set(state => {
                const updated = state.configs.map(c => c.id === id ? res.data! : c);
                offlineStore.saveConfigs(updated);
                // 如果更新的是活跃配置，同步 / If updating active, sync
                if (id === state.activeConfigId) {
                    return { configs: updated, activeConfig: rowToLLMConfig(res.data!) };
                }
                return { configs: updated };
            });
            return true;
        }
        return false;
    },

    deleteConfig: async (id) => {
        const res = await configsApi.delete(id);
        if (res.success) {
            set(state => {
                const updated = state.configs.filter(c => c.id !== id);
                offlineStore.saveConfigs(updated);
                return { configs: updated };
            });
            return true;
        }
        return false;
    },

    setActiveConfig: async (id) => {
        const config = get().configs.find(c => c.id === id);
        if (!config) return;

        set({ activeConfig: rowToLLMConfig(config), activeConfigId: id });

        // 通知 PG / Notify PG
        await configsApi.setActive(id);
    },

    applyLocalConfig: (config) => {
        set(state => ({
            activeConfig: { ...state.activeConfig, ...config },
        }));
        // 同时写 localStorage 作为备份 / Also write localStorage as backup
        localStorage.setItem('yyc_config', JSON.stringify({ ...get().activeConfig, ...config }));
    },

    getActiveAsLLMConfig: () => get().activeConfig,
}));
