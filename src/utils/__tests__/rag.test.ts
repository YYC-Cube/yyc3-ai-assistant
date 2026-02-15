/**
 * YYC3 RAG Module — Full Test Suite
 * 言语云立方 - RAG 检索增强全量测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding, retrieveContext, type MemoryEntry } from '../rag';
import type { LLMConfig } from '@/types';

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

const OLLAMA_CONFIG: LLMConfig = {
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
  ...OLLAMA_CONFIG,
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
};

const MOCK_EMBEDDING = [0.1, 0.2, 0.3, 0.4, 0.5];

function makeMemory(id: string, content: string, embedding: number[], role: 'user' | 'assistant' = 'user'): MemoryEntry {
  return { id, content, role, embedding, timestamp: Date.now() };
}

// ============================================================
// Tests
// ============================================================

describe('getEmbedding()', () => {

  describe('Ollama provider', () => {
    it('should call /api/embeddings with prompt field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: MOCK_EMBEDDING }),
      });

      const result = await getEmbedding('test text', OLLAMA_CONFIG);

      expect(result).toEqual(MOCK_EMBEDDING);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.anything(),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.prompt).toBe('test text');
    });
  });

  describe('OpenAI provider', () => {
    it('should call /v1/embeddings with input field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: MOCK_EMBEDDING }] }),
      });

      const result = await getEmbedding('test text', OPENAI_CONFIG);

      expect(result).toEqual(MOCK_EMBEDDING);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.anything(),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input).toBe('test text');
      expect(body.model).toBe('text-embedding-3-small');
    });
  });

  describe('Unsupported providers', () => {
    it('should return null for unsupported provider', async () => {
      const config = { ...OLLAMA_CONFIG, provider: 'moonshot' as any };
      const result = await getEmbedding('test', config);
      expect(result).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should return null on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const result = await getEmbedding('test', OLLAMA_CONFIG);
      expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await getEmbedding('test', OLLAMA_CONFIG);
      expect(result).toBeNull();
    });
  });
});

describe('retrieveContext()', () => {

  it('should return empty string when fewer than 5 memories', async () => {
    const memories = [
      makeMemory('1', 'mem1', MOCK_EMBEDDING),
      makeMemory('2', 'mem2', MOCK_EMBEDDING),
    ];

    const result = await retrieveContext('query', memories, OLLAMA_CONFIG);
    expect(result).toBe('');
  });

  it('should return empty string when embedding fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const memories = Array.from({ length: 6 }, (_, i) =>
      makeMemory(`${i}`, `memory ${i}`, [0.1 * i, 0.2, 0.3, 0.4, 0.5])
    );

    const result = await retrieveContext('query', memories, OLLAMA_CONFIG);
    expect(result).toBe('');
  });

  it('should return top-K relevant memories sorted by similarity', async () => {
    // Mock embedding for query
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [1.0, 0.0, 0.0, 0.0, 0.0] }),
    });

    const memories = [
      makeMemory('1', 'very relevant', [0.9, 0.1, 0.0, 0.0, 0.0]),
      makeMemory('2', 'somewhat relevant', [0.5, 0.5, 0.0, 0.0, 0.0]),
      makeMemory('3', 'not relevant', [0.0, 0.0, 1.0, 0.0, 0.0]),
      makeMemory('4', 'also relevant', [0.8, 0.2, 0.0, 0.0, 0.0]),
      makeMemory('5', 'filler 1', [0.1, 0.9, 0.0, 0.0, 0.0]),
      makeMemory('6', 'filler 2', [0.0, 0.0, 0.0, 1.0, 0.0]),
    ];

    const result = await retrieveContext('query', memories, OLLAMA_CONFIG, 3);

    expect(result).toContain('very relevant');
    expect(result).toContain('also relevant');
    expect(result).toContain('Relevant Context from Memory');
  });

  it('should skip memories without embeddings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [1.0, 0.0, 0.0] }),
    });

    const memories = [
      makeMemory('1', 'with embed', [0.9, 0.1, 0.0]),
      { id: '2', content: 'no embed', role: 'user' as const, timestamp: Date.now() }, // no embedding
      makeMemory('3', 'with embed 2', [0.5, 0.5, 0.0]),
      makeMemory('4', 'with embed 3', [0.3, 0.3, 0.3]),
      makeMemory('5', 'with embed 4', [0.1, 0.1, 0.8]),
      makeMemory('6', 'with embed 5', [0.2, 0.2, 0.6]),
    ];

    const result = await retrieveContext('query', memories, OLLAMA_CONFIG, 2);

    // Should not crash, should return results from embedded memories
    expect(result).toContain('Relevant Context');
  });

  it('should default topK to 3', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [1.0, 0.0, 0.0, 0.0, 0.0] }),
    });

    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory(`${i}`, `memory ${i}`, [Math.random(), Math.random(), 0, 0, 0])
    );

    const result = await retrieveContext('query', memories, OLLAMA_CONFIG);

    // Count how many memory entries are in the result
    const lines = result.split('\n').filter(l => l.includes('memory'));
    expect(lines.length).toBeLessThanOrEqual(3);
  });
});
