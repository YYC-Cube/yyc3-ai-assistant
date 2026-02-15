/**
 * YYC3 Auth Store — Full Test Suite
 * 言语云立方 - 鉴权 Store 全量测试
 *
 * Coverage:
 * - Preset operator login (yyc3_max, yyc3_m4)
 * - Online/Offline login flow
 * - Guest access (continueAsGuest)
 * - Session restore (initialize)
 * - Logout & state cleanup
 * - Profile update (online + offline)
 * - Connection check
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock dependencies before importing store
// ============================================================

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockMe = vi.fn();
const mockLogout = vi.fn();
const mockHasToken = vi.fn();
const mockProfileUpdate = vi.fn();
const mockCheckApiHealth = vi.fn();
const mockOfflineStore = {
  saveUser: vi.fn(),
  getUser: vi.fn(),
  clearAll: vi.fn(),
  addPendingAction: vi.fn(),
};

vi.mock('@/lib/pg-api', () => ({
  authApi: {
    login: (...args: any[]) => mockLogin(...args),
    register: (...args: any[]) => mockRegister(...args),
    me: () => mockMe(),
    logout: () => mockLogout(),
    hasToken: () => mockHasToken(),
  },
  profileApi: {
    update: (...args: any[]) => mockProfileUpdate(...args),
  },
  checkApiHealth: () => mockCheckApiHealth(),
  offlineStore: mockOfflineStore,
}));

// Import after mocking
import { useAuthStore, type AuthStatus, type ConnectionStatus } from '../auth-store';

beforeEach(() => {
  // Reset store state
  useAuthStore.setState({
    user: null,
    authStatus: 'loading',
    connectionStatus: 'checking',
    apiLatency: 0,
    error: null,
  });
  vi.clearAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('Initial State / 初始状态', () => {
  it('should start with null user and loading status', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.authStatus).toBe('loading');
    expect(state.connectionStatus).toBe('checking');
    expect(state.error).toBeNull();
  });
});

describe('login() — Preset Operators / 预置操作员登录', () => {
  it('should authenticate yyc3_max with correct password when offline', async () => {
    mockLogin.mockResolvedValue({ success: false, offline: true });

    const result = await useAuthStore.getState().login('yyc3_max', 'yyc3_max');

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user!.username).toBe('yyc3_max');
    expect(state.user!.id).toBe('preset_yyc3_max');
    expect(state.authStatus).toBe('authenticated');
    expect(mockOfflineStore.saveUser).toHaveBeenCalled();
  });

  it('should authenticate yyc3_m4 with correct password when offline', async () => {
    mockLogin.mockResolvedValue({ success: false, offline: true });

    const result = await useAuthStore.getState().login('yyc3_m4', 'yyc3_m4');

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.user!.username).toBe('yyc3_m4');
    expect(state.user!.id).toBe('preset_yyc3_m4');
  });

  it('should reject yyc3_max with wrong password when offline', async () => {
    mockLogin.mockResolvedValue({ success: false, offline: true });

    const result = await useAuthStore.getState().login('yyc3_max', 'wrong_password');

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.error).toContain('preset');
  });

  it('should reject unknown username when offline', async () => {
    mockLogin.mockResolvedValue({ success: false, offline: true });

    const result = await useAuthStore.getState().login('unknown_user', 'any_pass');

    expect(result).toBe(false);
    expect(useAuthStore.getState().error).toContain('offline');
  });
});

describe('login() — Online / 在线登录', () => {
  it('should authenticate via API when online', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        token: 'jwt_123',
        user: { id: 'db_1', username: 'remote_user', avatar_url: null, theme_preference: 'cyan' },
      },
    });

    const result = await useAuthStore.getState().login('remote_user', 'pass');

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.user!.id).toBe('db_1');
    expect(state.authStatus).toBe('authenticated');
    expect(mockOfflineStore.saveUser).toHaveBeenCalled();
  });

  it('should show error on failed online login', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    const result = await useAuthStore.getState().login('wrong', 'creds');

    expect(result).toBe(false);
    expect(useAuthStore.getState().error).toContain('Invalid');
  });
});

describe('register() / 注册', () => {
  it('should register and authenticate on success', async () => {
    mockRegister.mockResolvedValue({
      success: true,
      data: {
        token: 'jwt_new',
        user: { id: 'new_1', username: 'newbie', avatar_url: null, theme_preference: 'cyan' },
      },
    });

    const result = await useAuthStore.getState().register('newbie', 'pass');

    expect(result).toBe(true);
    expect(useAuthStore.getState().user!.username).toBe('newbie');
  });

  it('should fail when API is offline', async () => {
    mockRegister.mockResolvedValue({ success: false, offline: true });

    const result = await useAuthStore.getState().register('user', 'pass');

    expect(result).toBe(false);
    expect(useAuthStore.getState().error).toContain('offline');
  });
});

describe('continueAsGuest() / 访客模式', () => {
  it('should create guest user with prefixed ID', () => {
    useAuthStore.getState().continueAsGuest();

    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user!.id).toMatch(/^guest_/);
    expect(state.user!.username).toBe('GHOST_OPERATOR');
    expect(state.authStatus).toBe('authenticated');
  });

  it('guest should have cyan theme by default', () => {
    useAuthStore.getState().continueAsGuest();
    expect(useAuthStore.getState().user!.theme_preference).toBe('cyan');
  });

  it('each guest should get unique ID', () => {
    useAuthStore.getState().continueAsGuest();
    const id1 = useAuthStore.getState().user!.id;

    useAuthStore.getState().continueAsGuest();
    const id2 = useAuthStore.getState().user!.id;

    expect(id1).not.toBe(id2);
  });
});

describe('logout() / 登出', () => {
  it('should clear user, reset status, clear offline data', () => {
    // Setup: logged in state
    useAuthStore.setState({
      user: { id: '1', username: 'test', avatar_url: null, theme_preference: 'cyan' },
      authStatus: 'authenticated',
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.authStatus).toBe('guest');
    expect(state.error).toBeNull();
    expect(mockLogout).toHaveBeenCalled();
    expect(mockOfflineStore.clearAll).toHaveBeenCalled();
  });
});

describe('initialize() / 初始化', () => {
  it('should restore session from token when online', async () => {
    mockCheckApiHealth.mockResolvedValue({ online: true, latency: 50 });
    mockHasToken.mockReturnValue(true);
    mockMe.mockResolvedValue({
      success: true,
      data: { id: 'restored', username: 'me', avatar_url: null, theme_preference: 'red' },
    });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().user!.id).toBe('restored');
    expect(useAuthStore.getState().connectionStatus).toBe('online');
  });

  it('should restore from offline cache when API is down', async () => {
    mockCheckApiHealth.mockResolvedValue({ online: false, latency: 0 });
    mockOfflineStore.getUser.mockReturnValue({
      id: 'cached', username: 'cached_user', avatar_url: null, theme_preference: 'cyan',
    });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().user!.id).toBe('cached');
    expect(useAuthStore.getState().connectionStatus).toBe('offline');
  });

  it('should set guest status when no session and no cache', async () => {
    mockCheckApiHealth.mockResolvedValue({ online: false, latency: 0 });
    mockHasToken.mockReturnValue(false);
    mockOfflineStore.getUser.mockReturnValue(null);

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().authStatus).toBe('guest');
  });
});

describe('updateProfile() / 更新配置', () => {
  it('should update profile online and save locally', async () => {
    useAuthStore.setState({
      user: { id: '1', username: 'old_name', avatar_url: null, theme_preference: 'cyan' },
    });

    mockProfileUpdate.mockResolvedValue({
      success: true,
      data: { id: '1', username: 'new_name', avatar_url: null, theme_preference: 'cyan' },
    });

    const result = await useAuthStore.getState().updateProfile({ username: 'new_name' });

    expect(result).toBe(true);
    expect(useAuthStore.getState().user!.username).toBe('new_name');
  });

  it('should update locally and queue pending action when offline', async () => {
    useAuthStore.setState({
      user: { id: '1', username: 'old', avatar_url: null, theme_preference: 'cyan' },
    });

    mockProfileUpdate.mockResolvedValue({ success: false, offline: true });

    const result = await useAuthStore.getState().updateProfile({ username: 'offline_name' });

    expect(result).toBe(true);
    expect(useAuthStore.getState().user!.username).toBe('offline_name');
    expect(mockOfflineStore.addPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'profile_update' }),
    );
  });
});

describe('checkConnection() / 连接检查', () => {
  it('should update connectionStatus and apiLatency', async () => {
    mockCheckApiHealth.mockResolvedValue({ online: true, latency: 42 });

    await useAuthStore.getState().checkConnection();

    expect(useAuthStore.getState().connectionStatus).toBe('online');
    expect(useAuthStore.getState().apiLatency).toBe(42);
  });
});

describe('clearError() / 清除错误', () => {
  it('should set error to null', () => {
    useAuthStore.setState({ error: 'some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
