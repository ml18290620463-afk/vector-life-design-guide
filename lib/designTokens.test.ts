import { describe, expect, it } from 'vitest';
import { colors, motion, radius, shadow, spacing, tokens, zIndex } from './designTokens';

describe('designTokens', () => {
  it('exposes a six-bucket aggregate token export', () => {
    expect(Object.keys(tokens).sort()).toEqual([
      'colors',
      'motion',
      'radius',
      'shadow',
      'spacing',
      'zIndex',
    ]);
  });

  it('cyan brand palette is non-empty and the canonical 500 hue is the Tailwind cyan', () => {
    expect(colors.cyan[500]).toBe('#06b6d4');
    expect(colors.cyan.brand).toBe('#00c8e8');
    expect(colors.cyan.glow).toMatch(/^rgba\(/);
  });

  it('all colour glow tokens are rgba so they can compose into shadows', () => {
    const glowFamilies = ['cyan', 'magenta', 'indigo', 'rose', 'amber'] as const;
    for (const family of glowFamilies) {
      const palette = colors[family] as Record<string, string>;
      expect(palette.glow).toMatch(/^rgba\(/);
    }
  });

  it('spacing scale increases monotonically (Tailwind alignment)', () => {
    const numericKeys = Object.keys(spacing)
      .filter((k) => /^\d/.test(k))
      .map((k) => Number(k))
      .sort((a, b) => a - b);
    let last = -1;
    for (const key of numericKeys) {
      const valueRem = parseFloat(spacing[key as keyof typeof spacing] as string);
      expect(valueRem).toBeGreaterThan(last);
      last = valueRem;
    }
  });

  it('radius and zIndex tokens use the documented shape', () => {
    expect(radius.full).toBe('9999px');
    expect(typeof zIndex.modal).toBe('number');
    expect(zIndex.modal).toBeGreaterThan(zIndex.dropdown);
  });

  it('shadow.glow* tokens compose the cyan glow rgba string', () => {
    expect(shadow.glowCyan).toContain(colors.cyan.glow);
    expect(shadow.glowMagenta).toContain(colors.magenta.glow);
    expect(shadow.alertHalo).toMatch(/rgba\(200,\s*95,\s*114/);
  });

  it('motion durations are pure ms strings ordered ascending', () => {
    const order = [
      motion.durations.instant,
      motion.durations.fast,
      motion.durations.base,
      motion.durations.slow,
      motion.durations.slower,
      motion.durations.ritual,
      motion.durations.ceremony,
    ];
    let last = -1;
    for (const value of order) {
      expect(value).toMatch(/ms$/);
      const ms = parseInt(value, 10);
      expect(ms).toBeGreaterThanOrEqual(last);
      last = ms;
    }
  });
});
