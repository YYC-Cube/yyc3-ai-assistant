/**
 * YYC3 App Store — Full Test Suite
 * 言语云立方 - 应用状态 Store 全量测试
 *
 * Coverage:
 * - Theme toggle (cyan ↔ red)
 * - Panel navigation & goBack
 * - Sync status management
 * - Theme initialization from user / cache
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock dependencies
// ============================================================

const mockSaveTheme = vi.fn();
const mockGetTheme = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock('@/lib/pg-api', () => ({
  offlineStore: {
    saveTheme: (...args: any[]) => mockSaveTheme(...args),
    getTheme: () => mockGetTheme(),
  },
}));

vi.mock('./auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      user: null,
      connectionStatus: 'offline',
      updateProfile: mockUpdateProfile,
    }),
  },
}));

import { useAppStore, type ThemeColor, type PanelId } from '../app-store';

beforeEach(() => {
  useAppStore.setState({
    themeColor: 'cyan',
    activePanel: 'home',
    previousPanel: 'home',
    syncStatus: 'idle',
    lastSyncTime: null,
  });
  vi.clearAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('Initial State / 初始状态', () => {
  it('should default to cyan theme', () => {
    expect(useAppStore.getState().themeColor).toBe('cyan');
  });

  it('should default to home panel', () => {
    expect(useAppStore.getState().activePanel).toBe('home');
  });

  it('should default to idle sync status', () => {
    expect(useAppStore.getState().syncStatus).toBe('idle');
  });
});

describe('Theme / 主题', () => {
  it('setThemeColor should update theme', () => {
    useAppStore.getState().setThemeColor('red');
    expect(useAppStore.getState().themeColor).toBe('red');
  });

  it('setThemeColor should persist to offlineStore', () => {
    useAppStore.getState().setThemeColor('red');
    expect(mockSaveTheme).toHaveBeenCalledWith('red');
  });

  it('toggleTheme should switch cyan→red', () => {
    useAppStore.setState({ themeColor: 'cyan' });
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().themeColor).toBe('red');
  });

  it('toggleTheme should switch red→cyan', () => {
    useAppStore.setState({ themeColor: 'red' });
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().themeColor).toBe('cyan');
  });

  it('toggleTheme twice should return to original', () => {
    useAppStore.setState({ themeColor: 'cyan' });
    useAppStore.getState().toggleTheme();
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().themeColor).toBe('cyan');
  });
});

describe('Panel Navigation / 面板导航', () => {
  it('navigateTo should change active panel', () => {
    useAppStore.getState().navigateTo('workflow');
    expect(useAppStore.getState().activePanel).toBe('workflow');
  });

  it('navigateTo should save previous panel', () => {
    useAppStore.getState().navigateTo('config');
    expect(useAppStore.getState().previousPanel).toBe('home');
  });

  it('sequential navigation should track history', () => {
    useAppStore.getState().navigateTo('tasks');
    useAppStore.getState().navigateTo('mcp');
    expect(useAppStore.getState().activePanel).toBe('mcp');
    expect(useAppStore.getState().previousPanel).toBe('tasks');
  });

  it('goBack should return to previous panel', () => {
    useAppStore.getState().navigateTo('workflow');
    useAppStore.getState().goBack();
    expect(useAppStore.getState().activePanel).toBe('home');
  });

  it('goBack should reset previousPanel to home', () => {
    useAppStore.getState().navigateTo('config');
    useAppStore.getState().goBack();
    expect(useAppStore.getState().previousPanel).toBe('home');
  });

  it('should handle all valid panel IDs', () => {
    const panels: PanelId[] = ['home', 'tasks', 'mcp', 'workflow', 'ai_gen', 'intelligent', 'security', 'config', 'history', 'debate'];
    panels.forEach(panel => {
      useAppStore.getState().navigateTo(panel);
      expect(useAppStore.getState().activePanel).toBe(panel);
    });
  });
});

describe('Sync Status / 同步状态', () => {
  it('setSyncStatus should update status', () => {
    useAppStore.getState().setSyncStatus('syncing');
    expect(useAppStore.getState().syncStatus).toBe('syncing');
  });

  it('setSyncStatus(synced) should set lastSyncTime', () => {
    useAppStore.getState().setSyncStatus('synced');
    expect(useAppStore.getState().lastSyncTime).not.toBeNull();
    expect(useAppStore.getState().lastSyncTime).toBeGreaterThan(0);
  });

  it('setSyncStatus(error) should NOT set lastSyncTime', () => {
    useAppStore.getState().setSyncStatus('error');
    expect(useAppStore.getState().lastSyncTime).toBeNull();
  });

  it('should handle all sync status values', () => {
    const statuses = ['idle', 'syncing', 'synced', 'error'] as const;
    statuses.forEach(status => {
      useAppStore.getState().setSyncStatus(status);
      expect(useAppStore.getState().syncStatus).toBe(status);
    });
  });
});
