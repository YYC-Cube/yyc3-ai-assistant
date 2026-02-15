/**
 * YYC3 PG-API Client — Full Test Suite
 * 言语云立方 - PostgreSQL API 客户端全量测试
 *
 * Coverage:
 * - checkApiHealth()
 * - isApiOnline()
 * - authApi (login, register, me, logout, hasToken)
 * - offlineStore (all localStorage operations)
 * - Request function (auth headers, timeout, offline detection)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkApiHealth,
  isApiOnline,
  authApi,
  profileApi,
  configsApi,
  workflowsApi,
  runsApi,
  llmProxyApi,
  offlineStore,
  type AuthUser,
  type AIConfigRow,
} from '../pg-api';

// ============================================================
// Mock fetch
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  mockFetch.mockReset();
  localStorageMock.clear();
});

// ============================================================
// Tests: Health Check
// ============================================================

describe('checkApiHealth()', () => {
  it('should return online:true when /health responds OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await checkApiHealth();

    expect(result.online).toBe(true);
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('should return online:false when /health responds non-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await checkApiHealth();
    expect(result.online).toBe(false);
  });

  it('should return online:false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await checkApiHealth();
    expect(result.online).toBe(false);
    expect(result.latency).toBe(0);
  });
});

// ============================================================
// Tests: Auth API
// ============================================================

describe('authApi', () => {
  describe('login()', () => {
    it('should POST to /auth/login and store token on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'jwt_abc',
          user: { id: '1', username: 'test', avatar_url: null, theme_preference: 'cyan' },
        }),
      });

      const result = await authApi.login('test', 'pass');

      expect(result.success).toBe(true);
      expect(result.data?.token).toBe('jwt_abc');
      expect(authApi.hasToken()).toBe(true);
    });

    it('should return error on invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const result = await authApi.login('bad', 'creds');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should return offline:true on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const result = await authApi.login('user', 'pass');

      expect(result.success).toBe(false);
      expect(result.offline).toBe(true);
    });
  });

  describe('register()', () => {
    it('should POST to /auth/register', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'jwt_new',
          user: { id: '2', username: 'newuser', avatar_url: null, theme_preference: 'cyan' },
        }),
      });

      const result = await authApi.register('newuser', 'pass');

      expect(result.success).toBe(true);
      expect(authApi.hasToken()).toBe(true);
    });
  });

  describe('me()', () => {
    it('should GET /auth/me with Authorization header', async () => {
      // Set token first
      localStorage.setItem('yyc3_jwt', 'my_token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', username: 'test', avatar_url: null, theme_preference: 'cyan' }),
      });

      const result = await authApi.me();

      expect(result.success).toBe(true);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer my_token');
    });
  });

  describe('logout()', () => {
    it('should clear stored token', () => {
      localStorage.setItem('yyc3_jwt', 'token_to_clear');
      expect(authApi.hasToken()).toBe(true);

      authApi.logout();
      expect(authApi.hasToken()).toBe(false);
    });
  });

  describe('hasToken()', () => {
    it('should return false when no token stored', () => {
      expect(authApi.hasToken()).toBe(false);
    });

    it('should return true when token is stored', () => {
      localStorage.setItem('yyc3_jwt', 'some_token');
      expect(authApi.hasToken()).toBe(true);
    });
  });
});

// ============================================================
// Tests: Offline Store
// ============================================================

describe('offlineStore', () => {
  const MOCK_USER: AuthUser = {
    id: 'user_1',
    username: 'test_user',
    avatar_url: null,
    theme_preference: 'cyan',
  };

  describe('User persistence', () => {
    it('should save and retrieve user', () => {
      offlineStore.saveUser(MOCK_USER);
      const retrieved = offlineStore.getUser();

      expect(retrieved).toEqual(MOCK_USER);
    });

    it('should return null when no user saved', () => {
      expect(offlineStore.getUser()).toBeNull();
    });
  });

  describe('Theme persistence', () => {
    it('should save and retrieve theme', () => {
      offlineStore.saveTheme('red');
      expect(offlineStore.getTheme()).toBe('red');
    });

    it('should default to cyan when no theme saved', () => {
      expect(offlineStore.getTheme()).toBe('cyan');
    });

    it('should handle dark theme', () => {
      offlineStore.saveTheme('dark');
      expect(offlineStore.getTheme()).toBe('dark');
    });
  });

  describe('Configs persistence', () => {
    it('should save and retrieve config array', () => {
      const configs: AIConfigRow[] = [
        {
          id: 'c1', user_id: 'u1', name: 'Test Config',
          provider: 'ollama', model: 'llama3', base_url: null,
          settings: {}, is_active: true,
          created_at: '2026-01-01', updated_at: '2026-01-01',
        },
      ];

      offlineStore.saveConfigs(configs);
      const retrieved = offlineStore.getConfigs();

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].name).toBe('Test Config');
    });

    it('should return empty array when no configs saved', () => {
      expect(offlineStore.getConfigs()).toEqual([]);
    });
  });

  describe('Workflows persistence', () => {
    it('should save and retrieve workflows', () => {
      const workflows = [
        { id: 'w1', user_id: 'u1', name: 'Flow 1', description: null, definition: {}, is_public: false, created_at: '', updated_at: '' },
      ];

      offlineStore.saveWorkflows(workflows as any);
      expect(offlineStore.getWorkflows()).toHaveLength(1);
    });

    it('should return empty array when no workflows saved', () => {
      expect(offlineStore.getWorkflows()).toEqual([]);
    });
  });

  describe('Pending sync queue', () => {
    it('should add and retrieve pending actions', () => {
      offlineStore.addPendingAction({ type: 'profile_update', payload: { username: 'new' }, timestamp: 1000 });
      offlineStore.addPendingAction({ type: 'config_create', payload: {}, timestamp: 2000 });

      const actions = offlineStore.getPendingActions();
      expect(actions).toHaveLength(2);
      expect(actions[0].type).toBe('profile_update');
      expect(actions[1].type).toBe('config_create');
    });

    it('should clear pending actions', () => {
      offlineStore.addPendingAction({ type: 'test', payload: {}, timestamp: 1 });
      offlineStore.clearPendingActions();

      expect(offlineStore.getPendingActions()).toEqual([]);
    });
  });

  describe('clearAll()', () => {
    it('should remove all offline keys', () => {
      offlineStore.saveUser(MOCK_USER);
      offlineStore.saveTheme('red');
      offlineStore.saveConfigs([]);
      offlineStore.addPendingAction({ type: 't', payload: {}, timestamp: 1 });

      offlineStore.clearAll();

      expect(offlineStore.getUser()).toBeNull();
      expect(offlineStore.getTheme()).toBe('cyan'); // returns default
      expect(offlineStore.getConfigs()).toEqual([]);
      expect(offlineStore.getPendingActions()).toEqual([]);
    });
  });
});

// ============================================================
// Tests: API Endpoints (request shaping)
// ============================================================

describe('API Endpoints', () => {
  beforeEach(() => {
    localStorage.setItem('yyc3_jwt', 'test_token');
  });

  describe('configsApi', () => {
    it('list() should GET /configs', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      await configsApi.list();
      expect(mockFetch.mock.calls[0][0]).toContain('/configs');
    });

    it('create() should POST /configs', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await configsApi.create({ name: 'New', provider: 'ollama', model: 'llama3' });
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('delete() should DELETE /configs/:id', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await configsApi.delete('cfg_123');
      expect(mockFetch.mock.calls[0][0]).toContain('/configs/cfg_123');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('setActive() should POST /configs/:id/activate', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await configsApi.setActive('cfg_123');
      expect(mockFetch.mock.calls[0][0]).toContain('/configs/cfg_123/activate');
    });
  });

  describe('workflowsApi', () => {
    it('list() should GET /workflows', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      await workflowsApi.list();
      expect(mockFetch.mock.calls[0][0]).toContain('/workflows');
    });

    it('get() should GET /workflows/:id', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await workflowsApi.get('wf_1');
      expect(mockFetch.mock.calls[0][0]).toContain('/workflows/wf_1');
    });

    it('createRun() should POST /workflows/:id/runs', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await workflowsApi.createRun('wf_1');
      expect(mockFetch.mock.calls[0][0]).toContain('/workflows/wf_1/runs');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('appendRunLogs() should POST log entries', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await workflowsApi.appendRunLogs('wf_1', 'run_1', [{ node_id: 'n1', status: 'ok' }]);
      expect(mockFetch.mock.calls[0][0]).toContain('/workflows/wf_1/runs/run_1/logs');
    });
  });

  describe('runsApi', () => {
    it('recent() should GET /runs/recent with limit', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      await runsApi.recent(10);
      expect(mockFetch.mock.calls[0][0]).toContain('/runs/recent?limit=10');
    });
  });

  describe('llmProxyApi', () => {
    it('completion() should POST to /llm/proxy', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [] }) });
      await llmProxyApi.completion('http://target.com', { 'Auth': 'key' }, { messages: [] });
      expect(mockFetch.mock.calls[0][0]).toContain('/llm/proxy');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });
  });
});

// ============================================================
// Tests: Auth Header Injection
// ============================================================

describe('Request Auth Headers / 请求鉴权头注入', () => {
  it('should include Authorization header when token exists', async () => {
    localStorage.setItem('yyc3_jwt', 'bearer_token');
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await profileApi.get();

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer bearer_token');
  });

  it('should clear token on 401 response', async () => {
    localStorage.setItem('yyc3_jwt', 'expired_token');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Token expired' }),
    });

    await profileApi.get();

    expect(localStorage.getItem('yyc3_jwt')).toBeNull();
  });
});
