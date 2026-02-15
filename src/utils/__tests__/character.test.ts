/**
 * YYC3 Character Profile — Full Test Suite
 * 言语云立方 - 角色人设全量测试
 */

import { describe, it, expect } from 'vitest';
import { PRESET_CHARACTERS, applyCharacterToConfig, type CharacterProfile } from '../character';
import type { LLMConfig } from '@/types';

const BASE_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  systemPrompt: 'Original prompt',
  ttsProvider: 'browser',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  ttsSpeed: 1.0,
};

describe('PRESET_CHARACTERS', () => {
  it('should have exactly 3 preset characters', () => {
    expect(PRESET_CHARACTERS).toHaveLength(3);
  });

  it('each character should have required fields', () => {
    PRESET_CHARACTERS.forEach(char => {
      expect(char.id).toBeTruthy();
      expect(char.name).toBeTruthy();
      expect(char.description).toBeTruthy();
      expect(char.systemPrompt).toBeTruthy();
      expect(char.ttsConfig).toBeDefined();
      expect(char.ttsConfig.provider).toMatch(/^(openai|browser)$/);
      expect(char.ttsConfig.voice).toBeTruthy();
      expect(typeof char.ttsConfig.speed).toBe('number');
      expect(char.themeColor).toMatch(/^(cyan|red)$/);
    });
  });

  it('should have unique IDs', () => {
    const ids = PRESET_CHARACTERS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('default_cube should exist with YanYuCloud prompt', () => {
    const cube = PRESET_CHARACTERS.find(c => c.id === 'default_cube');
    expect(cube).toBeDefined();
    expect(cube!.systemPrompt).toContain('言语云');
    expect(cube!.themeColor).toBe('cyan');
  });

  it('hal_red should use red theme', () => {
    const hal = PRESET_CHARACTERS.find(c => c.id === 'hal_red');
    expect(hal).toBeDefined();
    expect(hal!.themeColor).toBe('red');
    expect(hal!.systemPrompt).toContain('HAL-9000');
  });

  it('luna_empathetic should use nova voice', () => {
    const luna = PRESET_CHARACTERS.find(c => c.id === 'luna_empathetic');
    expect(luna).toBeDefined();
    expect(luna!.ttsConfig.voice).toBe('nova');
  });
});

describe('applyCharacterToConfig()', () => {
  it('should override systemPrompt with character prompt', () => {
    const char = PRESET_CHARACTERS[0];
    const result = applyCharacterToConfig(char, BASE_CONFIG);

    expect(result.systemPrompt).toBe(char.systemPrompt);
    expect(result.systemPrompt).not.toBe('Original prompt');
  });

  it('should override TTS settings', () => {
    const hal = PRESET_CHARACTERS.find(c => c.id === 'hal_red')!;
    const result = applyCharacterToConfig(hal, BASE_CONFIG);

    expect(result.ttsProvider).toBe('openai');
    expect(result.ttsVoice).toBe('onyx');
    expect(result.ttsSpeed).toBe(0.85);
  });

  it('should preserve non-character fields (provider, baseUrl, model, apiKey)', () => {
    const char = PRESET_CHARACTERS[0];
    const config = { ...BASE_CONFIG, provider: 'deepseek' as const, apiKey: 'my-key', model: 'deepseek-chat' };
    const result = applyCharacterToConfig(char, config);

    expect(result.provider).toBe('deepseek');
    expect(result.apiKey).toBe('my-key');
    expect(result.model).toBe('deepseek-chat');
    expect(result.baseUrl).toBe(config.baseUrl);
  });

  it('should return a new object (not mutate input)', () => {
    const char = PRESET_CHARACTERS[0];
    const result = applyCharacterToConfig(char, BASE_CONFIG);

    expect(result).not.toBe(BASE_CONFIG);
    expect(BASE_CONFIG.systemPrompt).toBe('Original prompt');
  });
});
