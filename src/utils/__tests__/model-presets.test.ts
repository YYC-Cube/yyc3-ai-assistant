/**
 * YYC3 Model Presets — Full Test Suite
 * 言语云立方 - 模型预设全量测试
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_PRESETS, getPresetById, createConfigFromPreset, type ModelPreset } from '../model-presets';
import type { LLMConfig } from '@/types';

const BASE_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: 'original-key',
  model: 'llama3',
  systemPrompt: 'Keep this',
  ttsProvider: 'browser',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  ttsSpeed: 1.0,
  temperature: 0.7,
};

describe('DEFAULT_PRESETS', () => {
  it('should have 9 preset models', () => {
    expect(DEFAULT_PRESETS).toHaveLength(9);
  });

  it('each preset should have required fields', () => {
    DEFAULT_PRESETS.forEach(preset => {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.provider).toBeTruthy();
      expect(preset.baseUrl).toBeTruthy();
      expect(preset.model).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.iconName).toBeTruthy();
    });
  });

  it('should have unique IDs', () => {
    const ids = DEFAULT_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have unique names', () => {
    const names = DEFAULT_PRESETS.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should include all supported providers', () => {
    const providers = new Set(DEFAULT_PRESETS.map(p => p.provider));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('ollama')).toBe(true);
    expect(providers.has('deepseek')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('moonshot')).toBe(true);
    expect(providers.has('zhipu')).toBe(true);
    expect(providers.has('yi')).toBe(true);
    expect(providers.has('custom')).toBe(true);
  });

  it('all baseUrls should be valid URLs', () => {
    DEFAULT_PRESETS.forEach(preset => {
      expect(() => new URL(preset.baseUrl)).not.toThrow();
    });
  });

  it('ollama preset should use localhost:11434', () => {
    const ollama = DEFAULT_PRESETS.find(p => p.provider === 'ollama');
    expect(ollama).toBeDefined();
    expect(ollama!.baseUrl).toContain('localhost:11434');
  });
});

describe('getPresetById()', () => {
  it('should return preset for valid ID', () => {
    const preset = getPresetById('openai-gpt4o');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('OpenAI GPT-4o');
    expect(preset!.provider).toBe('openai');
  });

  it('should return undefined for invalid ID', () => {
    expect(getPresetById('nonexistent')).toBeUndefined();
    expect(getPresetById('')).toBeUndefined();
  });

  it('should find all presets by their IDs', () => {
    DEFAULT_PRESETS.forEach(preset => {
      expect(getPresetById(preset.id)).toEqual(preset);
    });
  });
});

describe('createConfigFromPreset()', () => {
  it('should override provider, baseUrl, model from preset', () => {
    const preset = DEFAULT_PRESETS.find(p => p.id === 'deepseek-v3')!;
    const result = createConfigFromPreset(preset, BASE_CONFIG);

    expect(result.provider).toBe('deepseek');
    expect(result.baseUrl).toBe('https://api.deepseek.com');
    expect(result.model).toBe('deepseek-chat');
  });

  it('should preserve non-preset fields (apiKey, systemPrompt, tts, temperature)', () => {
    const preset = DEFAULT_PRESETS[0];
    const result = createConfigFromPreset(preset, BASE_CONFIG);

    expect(result.apiKey).toBe('original-key');
    expect(result.systemPrompt).toBe('Keep this');
    expect(result.ttsProvider).toBe('browser');
    expect(result.ttsVoice).toBe('alloy');
    expect(result.temperature).toBe(0.7);
  });

  it('should return a new object (not mutate inputs)', () => {
    const preset = DEFAULT_PRESETS[0];
    const result = createConfigFromPreset(preset, BASE_CONFIG);

    expect(result).not.toBe(BASE_CONFIG);
    expect(BASE_CONFIG.provider).toBe('ollama'); // unchanged
  });
});
