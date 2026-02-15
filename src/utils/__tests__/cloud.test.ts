/**
 * YYC3 Cloud Sync — Full Test Suite
 * 言语云立方 - 云同步模块全量测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMixedContent, syncPush, syncPull, type CloudState, type SyncResponse } from '../cloud';

// ============================================================
// Mock fetch
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ============================================================
// Helpers
// ============================================================

const MOCK_STATE: CloudState = {
  config: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3',
    ttsProvider: 'browser',
    ttsModel: 'tts-1',
    ttsVoice: 'alloy',
    ttsSpeed: 1.0,
  },
  messages: [],
};

// ============================================================
// Tests
// ============================================================

describe('isMixedContent()', () => {
  it('should return false when no targetUrl provided', () => {
    expect(isMixedContent(undefined)).toBe(false);
    expect(isMixedContent('')).toBe(false);
  });

  it('should return false for https target', () => {
    // In test env, window.location.protocol is typically 'http:'
    expect(isMixedContent('https://api.example.com')).toBe(false);
  });

  it('should detect mixed content when page is https and target is http', () => {
    // Mock window.location.protocol
    const originalProtocol = window.location.protocol;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: 'https:' },
      writable: true,
    });

    expect(isMixedContent('http://insecure-api.com')).toBe(true);

    // Restore
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: originalProtocol },
      writable: true,
    });
  });
});

describe('syncPush()', () => {
  it('should POST data to /api/sync', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, timestamp: 12345 }),
    });

    const result = await syncPush('http://localhost:7007', 'user1', MOCK_STATE);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/sync',
      expect.objectContaining({ method: 'POST', mode: 'cors' }),
    );
  });

  it('should include userId and payload in body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, timestamp: 12345 }),
    });

    await syncPush('http://localhost:7007', 'test_user', MOCK_STATE);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.userId).toBe('test_user');
    expect(body.payload).toEqual(MOCK_STATE);
    expect(body.timestamp).toBeGreaterThan(0);
  });

  it('should return error on server error (non-200)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await syncPush('http://localhost:7007', 'user1', MOCK_STATE);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('server');
  });

  it('should return error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await syncPush('http://localhost:7007', 'user1', MOCK_STATE);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('network');
  });

  it('should use default server URL when empty string passed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, timestamp: 1 }),
    });

    await syncPush('', 'user1', MOCK_STATE);

    // Should call with default URL (contains 8.152...)
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/sync');
  });

  it('should strip trailing slash from URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, timestamp: 1 }),
    });

    await syncPush('http://localhost:7007/', 'user1', MOCK_STATE);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('http://localhost:7007/api/sync');
  });
});

describe('syncPull()', () => {
  it('should GET data from /api/sync with userId query param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, timestamp: 12345, data: MOCK_STATE }),
    });

    const result = await syncPull('http://localhost:7007', 'user1');

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/sync?userId=user1',
      expect.objectContaining({ mode: 'cors' }),
    );
  });

  it('should return error on server error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await syncPull('http://localhost:7007', 'user1');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('server');
  });

  it('should return error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await syncPull('http://localhost:7007', 'user1');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('network');
  });
});
