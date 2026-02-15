/**
 * YYC3 LLM Module — Full Test Suite
 * 言语云立方 - LLM 调用模块全量测试
 *
 * Coverage:
 * - generateCompletion with Ollama / OpenAI-compatible providers
 * - Validation integration
 * - Mixed content detection & fallback
 * - Mock response fallback
 * - checkConnection probe
 * - DEFAULT_CONFIG integrity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCompletion, checkConnection, DEFAULT_CONFIG, fetchOpenAITTS } from '../llm';
import type { LLMConfig, MessageContent } from '@/types';

// ============================================================
// Mock global fetch
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ============================================================
// Helpers
// ============================================================

const BASE_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  ttsProvider: 'browser',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  ttsSpeed: 1.0,
};

const OPENAI_CONFIG: LLMConfig = {
  ...BASE_CONFIG,
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test-key',
  model: 'gpt-4o',
};

const SIMPLE_MESSAGES: MessageContent[] = [
  { role: 'user', content: 'Hello' },
];

// ============================================================
// Tests
// ============================================================

describe('DEFAULT_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_CONFIG.provider).toBe('ollama');
    expect(DEFAULT_CONFIG.baseUrl).toBe('http://localhost:11434');
    expect(DEFAULT_CONFIG.model).toBe('llama3');
    expect(DEFAULT_CONFIG.ttsProvider).toBe('browser');
    expect(DEFAULT_CONFIG.ttsVoice).toBe('alloy');
    expect(DEFAULT_CONFIG.ttsSpeed).toBe(1.0);
  });

  it('should include system prompt with UI control commands', () => {
    expect(DEFAULT_CONFIG.systemPrompt).toContain('言语云');
    expect(DEFAULT_CONFIG.systemPrompt).toContain('[[CMD:');
  });
});

describe('generateCompletion()', () => {

  describe('Validation / 参数验证', () => {
    it('should throw on missing provider', async () => {
      const badConfig = { ...BASE_CONFIG, provider: '' as any };
      await expect(generateCompletion(SIMPLE_MESSAGES, badConfig))
        .rejects.toThrow('Configuration Error');
    });

    it('should throw on invalid baseUrl', async () => {
      const badConfig = { ...BASE_CONFIG, baseUrl: 'not-a-url' };
      await expect(generateCompletion(SIMPLE_MESSAGES, badConfig))
        .rejects.toThrow('Configuration Error');
    });

    it('should throw on empty messages', async () => {
      await expect(generateCompletion([], BASE_CONFIG))
        .rejects.toThrow('Message Error');
    });

    it('should throw on invalid message role', async () => {
      const badMessages = [{ role: 'hacker' as any, content: 'hi' }];
      await expect(generateCompletion(badMessages, BASE_CONFIG))
        .rejects.toThrow('Message Error');
    });

    it('should throw on missing apiKey for remote providers', async () => {
      const noKeyConfig = { ...OPENAI_CONFIG, apiKey: '' };
      await expect(generateCompletion(SIMPLE_MESSAGES, noKeyConfig))
        .rejects.toThrow('Configuration Error');
    });

    it('should NOT require apiKey for ollama', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'response' } }),
      });

      const ollamaConfig = { ...BASE_CONFIG, apiKey: '' };
      const result = await generateCompletion(SIMPLE_MESSAGES, ollamaConfig);
      expect(result).toBe('response');
    });
  });

  describe('Ollama Provider / Ollama 调用', () => {
    it('should call /api/chat endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'Ollama says hello' } }),
      });

      const result = await generateCompletion(SIMPLE_MESSAGES, BASE_CONFIG);

      expect(result).toBe('Ollama says hello');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include model and options in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'ok' } }),
      });

      const configWithParams = { ...BASE_CONFIG, temperature: 0.5, topP: 0.9, maxTokens: 100 };
      await generateCompletion(SIMPLE_MESSAGES, configWithParams);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('llama3');
      expect(callBody.stream).toBe(false);
      expect(callBody.options.temperature).toBe(0.5);
      expect(callBody.options.top_p).toBe(0.9);
      expect(callBody.options.num_predict).toBe(100);
    });

    it('should prepend system prompt to messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'ok' } }),
      });

      await generateCompletion(SIMPLE_MESSAGES, BASE_CONFIG);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].role).toBe('system');
      expect(callBody.messages[0].content).toContain('言语云');
      expect(callBody.messages[1].role).toBe('user');
    });

    it('should handle empty content response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: {} }),
      });

      const result = await generateCompletion(SIMPLE_MESSAGES, BASE_CONFIG);
      expect(result).toContain('空内容');
    });
  });

  describe('OpenAI-Compatible Provider / OpenAI 兼容调用', () => {
    it('should call /v1/chat/completions endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'GPT says hello' } }],
        }),
      });

      const result = await generateCompletion(SIMPLE_MESSAGES, OPENAI_CONFIG);

      expect(result).toBe('GPT says hello');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      });

      await generateCompletion(SIMPLE_MESSAGES, OPENAI_CONFIG);

      const callHeaders = JSON.parse(mockFetch.mock.calls[0][1].body);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-test-key');
    });

    it('should auto-append /v1 to baseUrl if missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      });

      const config = { ...OPENAI_CONFIG, baseUrl: 'https://api.deepseek.com' };
      await generateCompletion(SIMPLE_MESSAGES, config);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.anything(),
      );
    });
  });

  describe('API Error Handling / API 错误处理', () => {
    it('should return mock response on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const result = await generateCompletion(SIMPLE_MESSAGES, BASE_CONFIG);

      expect(result).toContain('演示模式');
      expect(result).toContain('模拟回复');
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await generateCompletion(SIMPLE_MESSAGES, BASE_CONFIG);
      // Should fallback to mock response
      expect(result).toContain('模拟回复');
    });
  });

  describe('Vision / Image Messages', () => {
    it('should pass images in Ollama format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: 'I see an image' } }),
      });

      const messagesWithImage: MessageContent[] = [
        { role: 'user', content: 'What is this?', images: ['base64data123'] },
      ];

      await generateCompletion(messagesWithImage, BASE_CONFIG);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Ollama format: images in message object
      const userMsg = body.messages.find((m: any) => m.role === 'user');
      expect(userMsg.images).toContain('base64data123');
    });
  });
});

describe('checkConnection()', () => {
  it('should return success with latency when server responds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    });

    const result = await checkConnection(BASE_CONFIG);

    expect(result.success).toBe(true);
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('should probe /api/tags for Ollama', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await checkConnection(BASE_CONFIG);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.anything(),
    );
  });

  it('should probe /v1/models for OpenAI-compatible', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await checkConnection(OPENAI_CONFIG);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.anything(),
    );
  });

  it('should return failure on network error', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Connection refused'))  // primary probe
      .mockRejectedValueOnce(new Error('Connection refused')); // fallback completion

    const result = await checkConnection(BASE_CONFIG);

    expect(result.success).toBe(false);
  });
});
