/**
 * YYC3 Design System — Full Test Suite
 * 言语云立方 - 设计系统 Token 全量测试
 */

import { describe, it, expect } from 'vitest';
import { YYC3_DESIGN } from '../design-system';

describe('YYC3_DESIGN', () => {

  describe('Color Tokens / 颜色令牌', () => {
    it('should define all 4 color palettes', () => {
      expect(YYC3_DESIGN.colors).toHaveProperty('cyan');
      expect(YYC3_DESIGN.colors).toHaveProperty('purple');
      expect(YYC3_DESIGN.colors).toHaveProperty('emerald');
      expect(YYC3_DESIGN.colors).toHaveProperty('red');
    });

    it('each color should have primary, glow, bg, border fields', () => {
      const requiredFields = ['primary', 'glow', 'bg', 'border'];
      Object.entries(YYC3_DESIGN.colors).forEach(([name, palette]) => {
        requiredFields.forEach(field => {
          expect(palette).toHaveProperty(field);
          expect(typeof (palette as any)[field]).toBe('string');
        });
      });
    });

    it('primary colors should be valid hex strings', () => {
      Object.entries(YYC3_DESIGN.colors).forEach(([name, palette]) => {
        expect(palette.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('glow/bg/border should be valid rgba strings', () => {
      Object.entries(YYC3_DESIGN.colors).forEach(([name, palette]) => {
        expect(palette.glow).toMatch(/^rgba\(/);
        expect(palette.bg).toMatch(/^rgba\(/);
        expect(palette.border).toMatch(/^rgba\(/);
      });
    });

    it('cyan primary should be #22d3ee', () => {
      expect(YYC3_DESIGN.colors.cyan.primary).toBe('#22d3ee');
    });

    it('red primary should be #f87171', () => {
      expect(YYC3_DESIGN.colors.red.primary).toBe('#f87171');
    });
  });

  describe('Physics Tokens / 物理动画令牌', () => {
    it('should define spring and slow presets', () => {
      expect(YYC3_DESIGN.physics).toHaveProperty('spring');
      expect(YYC3_DESIGN.physics).toHaveProperty('slow');
    });

    it('spring should have type, stiffness, damping', () => {
      expect(YYC3_DESIGN.physics.spring.type).toBe('spring');
      expect(typeof YYC3_DESIGN.physics.spring.stiffness).toBe('number');
      expect(typeof YYC3_DESIGN.physics.spring.damping).toBe('number');
      expect(YYC3_DESIGN.physics.spring.stiffness).toBeGreaterThan(0);
      expect(YYC3_DESIGN.physics.spring.damping).toBeGreaterThan(0);
    });

    it('slow spring should have lower stiffness than regular spring', () => {
      expect(YYC3_DESIGN.physics.slow.stiffness).toBeLessThan(YYC3_DESIGN.physics.spring.stiffness);
    });
  });

  describe('Blur Tokens / 模糊令牌', () => {
    it('should define glass and heavy blur classes', () => {
      expect(YYC3_DESIGN.blur.glass).toBe('backdrop-blur-xl');
      expect(YYC3_DESIGN.blur.heavy).toBe('backdrop-blur-3xl');
    });
  });
});
