import { describe, expect, it } from 'vitest';
import { ARCHIVE_PARTICLE_COLORS, ARCHIVE_RGB, withAlpha } from './canvasPalette';

describe('canvasPalette', () => {
  it('exposes 7 archive particle colours, all hex literals', () => {
    expect(ARCHIVE_PARTICLE_COLORS).toHaveLength(7);
    for (const colour of ARCHIVE_PARTICLE_COLORS) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('archive particle colours are unique (no accidental duplicates)', () => {
    expect(new Set(ARCHIVE_PARTICLE_COLORS).size).toBe(ARCHIVE_PARTICLE_COLORS.length);
  });

  it('ARCHIVE_RGB triplets are space-separated R, G, B integers in [0,255]', () => {
    for (const [name, triplet] of Object.entries(ARCHIVE_RGB)) {
      const parts = triplet.split(',').map((s) => Number(s.trim()));
      expect(parts.length, `${name} should be a 3-channel triplet`).toBe(3);
      for (const channel of parts) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  it('withAlpha builds a canvas-ready rgba string', () => {
    expect(withAlpha('cyan', 0.3)).toBe('rgba(0, 255, 255, 0.3)');
    expect(withAlpha('magenta', 0.9)).toBe('rgba(255, 0, 255, 0.9)');
    expect(withAlpha('white', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('withAlpha accepts arithmetic alpha expressions (e.g. 0.6 * opacity)', () => {
    const opacity = 0.5;
    expect(withAlpha('cyan', 0.6 * opacity)).toBe('rgba(0, 255, 255, 0.3)');
  });

  it('withAlpha is referentially safe — does not leak the underlying triplet ref', () => {
    const a = withAlpha('cyan', 0.1);
    const b = withAlpha('cyan', 0.9);
    expect(a).not.toBe(b);
    expect(a).toContain('0, 255, 255');
    expect(b).toContain('0, 255, 255');
  });
});
