/**
 * YYC3 Config Store — Full Test Suite
 * 言语云立方 - AI 配置 Store 全量测试
 *
 * Coverage:
 * - DEFAULT_LLM_CONFIG integrity
 * - loadConfigs (online + offline + migration)
 * - createConfig (online + offline fallback)
 * - applyLocalConfig
 * - getActiveAsLLMConfig
 * - setActiveConfig
 * - deleteConfig
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock dependencies
// ============================================================

const mockConfigsList = vi.fn();
const mockConfigsCreate = vi.fn();
const mockConfigsUpdate = vi.fn();
const mockConfigsDelete = vi.fn();
const mockConfigsSetActive = vi.fn();

const mockOfflineStore = {
  getConfigs: vi.fn().mockReturnValue([]),
  saveConfigs: vi.fn(),
  addPendingAction: vi.fn(),
};

vi.mock('@/lib/pg-api', () => ({
  configsApi: {
    list: () => mockConfigsList(),
    create: (...args: any[]) => mockConfigsCreate(...args),
    update: (...args: any[]) => mockConfigsUpdate(...args),
    delete: (...args: any[]) => mockConfigsDelete(...args),
    setActive: (...args: any[]) => mockConfigsSetActive(...args),
  },
  offlineStore: mockOfflineStore,
}));

vi.mock('./auth-store', () => ({
  useAuthStore: {
    getState: () => ({ connectionStatus: 'offline' }),
  },
}));

import { useConfigStore, DEFAULT_LLM_CONFIG } from '../config-store';

beforeEach(() => {
  useConfigStore.setState({
    configs: [],
    activeConfig: { ...DEFAULT_LLM_CONFIG },
    activeConfigId: null,
    isLoading: false,
    isSynced: false,
  });
  vi.clearAllMocks();
  mockOfflineStore.getConfigs.mockReturnValue([]);
  localStorage.clear();
});

// ============================================================
// Tests
// ============================================================

describe('DEFAULT_LLM_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_LLM_CONFIG.provider).toBe('ollama');
    expect(DEFAULT_LLM_CONFIG.baseUrl).toBe('http://localhost:11434');
    expect(DEFAULT_LLM_CONFIG.model).toBe('llama3');
    expect(DEFAULT_LLM_CONFIG.ttsProvider).toBe('browser');
    expect(DEFAULT_LLM_CONFIG.ttsVoice).toBe('alloy');
    expect(DEFAULT_LLM_CONFIG.ttsSpeed).toBe(1.0);
    expect(DEFAULT_LLM_CONFIG.temperature).toBe(0.7);
    expect(DEFAULT_LLM_CONFIG.topP).toBe(0.9);
    expect(DEFAULT_LLM_CONFIG.maxTokens).toBe(2048);
  });

  it('should include system prompt mentioning YanYuCloud', () => {
    expect(DEFAULT_LLM_CONFIG.systemPrompt).toContain('言语云');
  });
});

describe('Initial State / 初始状态', () => {
  it('should start with default config and empty configs list', () => {
    const state = useConfigStore.getState();
    expect(state.configs).toEqual([]);
    expect(state.activeConfig.provider).toBe('ollama');
    expect(state.activeConfigId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isSynced).toBe(false);
  });
});

describe('loadConfigs() / 加载配置', () => {
  it('should load from offline cache first', async () => {
    const cachedConfig = {
      id: 'cache_1', user_id: 'u1', name: 'Cached',
      provider: 'deepseek', model: 'deepseek-chat', base_url: 'https://api.deepseek.com',
      settings: { temperature: 0.5 }, is_active: true,
      created_at: '', updated_at: '',
    };
    mockOfflineStore.getConfigs.mockReturnValue([cachedConfig]);

    await useConfigStore.getState().loadConfigs();

    expect(useConfigStore.getState().configs).toHaveLength(1);
    expect(useConfigStore.getState().configs[0].name).toBe('Cached');
    expect(useConfigStore.getState().activeConfigId).toBe('cache_1');
  });

  it('should set isLoading during load', async () => {
    let capturedLoading = false;
    const unsubscribe = useConfigStore.subscribe(state => {
      if (state.isLoading) capturedLoading = true;
    });

    await useConfigStore.getState().loadConfigs();
    unsubscribe();

    expect(capturedLoading).toBe(true);
    expect(useConfigStore.getState().isLoading).toBe(false); // done loading
  });

  it('should use default config when no configs exist at all', async () => {
    mockOfflineStore.getConfigs.mockReturnValue([]);

    await useConfigStore.getState().loadConfigs();

    expect(useConfigStore.getState().activeConfig.provider).toBe('ollama');
    expect(useConfigStore.getState().activeConfig.model).toBe('llama3');
  });
});

describe('createConfig() / 创建配置', () => {
  it('should create via API and add to list on success', async () => {
    const newRow = {
      id: 'new_1', user_id: 'u1', name: 'New Config',
      provider: 'openai', model: 'gpt-4o', base_url: null,
      settings: {}, is_active: false, created_at: '', updated_at: '',
    };
    mockConfigsCreate.mockResolvedValue({ success: true, data: newRow });

    const result = await useConfigStore.getState().createConfig({
      name: 'New Config', provider: 'openai', model: 'gpt-4o',
    });

    expect(result).toBe(true);
    expect(useConfigStore.getState().configs).toHaveLength(1);
    expect(useConfigStore.getState().configs[0].name).toBe('New Config');
    expect(mockOfflineStore.saveConfigs).toHaveBeenCalled();
  });

  it('should create temp record when offline', async () => {
    mockConfigsCreate.mockResolvedValue({ success: false, offline: true });

    const result = await useConfigStore.getState().createConfig({
      name: 'Offline Config', provider: 'ollama', model: 'llama3',
    });

    expect(result).toBe(true);
    const configs = useConfigStore.getState().configs;
    expect(configs).toHaveLength(1);
    expect(configs[0].id).toMatch(/^local_/);
    expect(configs[0].name).toBe('Offline Config');
    expect(mockOfflineStore.addPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'config_create' }),
    );
  });
});

describe('deleteConfig() / 删除配置', () => {
  it('should remove config from list on success', async () => {
    useConfigStore.setState({
      configs: [
        { id: 'c1', user_id: 'u1', name: 'A', provider: 'ollama', model: 'llama3', base_url: null, settings: {}, is_active: true, created_at: '', updated_at: '' },
        { id: 'c2', user_id: 'u1', name: 'B', provider: 'openai', model: 'gpt-4o', base_url: null, settings: {}, is_active: false, created_at: '', updated_at: '' },
      ],
    });

    mockConfigsDelete.mockResolvedValue({ success: true });

    const result = await useConfigStore.getState().deleteConfig('c1');

    expect(result).toBe(true);
    expect(useConfigStore.getState().configs).toHaveLength(1);
    expect(useConfigStore.getState().configs[0].id).toBe('c2');
  });
});

describe('applyLocalConfig() / 应用本地配置', () => {
  it('should merge partial config into activeConfig', () => {
    useConfigStore.getState().applyLocalConfig({ temperature: 0.3, model: 'custom-model' });

    const active = useConfigStore.getState().activeConfig;
    expect(active.temperature).toBe(0.3);
    expect(active.model).toBe('custom-model');
    // Preserved fields
    expect(active.provider).toBe('ollama');
    expect(active.baseUrl).toBe('http://localhost:11434');
  });

  it('should persist to localStorage as backup', () => {
    useConfigStore.getState().applyLocalConfig({ temperature: 0.1 });

    const stored = localStorage.getItem('yyc_config');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.temperature).toBe(0.1);
  });
});

describe('getActiveAsLLMConfig() / 获取活跃配置', () => {
  it('should return current activeConfig', () => {
    useConfigStore.getState().applyLocalConfig({ model: 'test-model' });
    const config = useConfigStore.getState().getActiveAsLLMConfig();
    expect(config.model).toBe('test-model');
  });
});

describe('setActiveConfig() / 切换活跃配置', () => {
  it('should switch active config by ID', async () => {
    const configs = [
      { id: 'c1', user_id: 'u1', name: 'Config A', provider: 'ollama', model: 'llama3', base_url: 'http://localhost:11434', settings: { temperature: 0.5 }, is_active: true, created_at: '', updated_at: '' },
      { id: 'c2', user_id: 'u1', name: 'Config B', provider: 'deepseek', model: 'deepseek-chat', base_url: 'https://api.deepseek.com', settings: { temperature: 0.9 }, is_active: false, created_at: '', updated_at: '' },
    ];
    useConfigStore.setState({ configs });
    mockConfigsSetActive.mockResolvedValue({ success: true });

    await useConfigStore.getState().setActiveConfig('c2');

    expect(useConfigStore.getState().activeConfigId).toBe('c2');
    expect(useConfigStore.getState().activeConfig.provider).toBe('deepseek');
    expect(useConfigStore.getState().activeConfig.model).toBe('deepseek-chat');
  });

  it('should do nothing if config ID not found', async () => {
    await useConfigStore.getState().setActiveConfig('nonexistent');
    expect(useConfigStore.getState().activeConfigId).toBeNull();
  });
});
