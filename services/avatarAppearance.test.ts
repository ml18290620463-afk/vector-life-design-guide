import { afterEach, describe, expect, it } from 'vitest';
import { readAvatarAppearance, writeAvatarAppearance } from './avatarAppearance';
import { sanitizeAvatarAppearance } from '../features/avatar/appearance';

describe('avatarAppearance', () => {
  afterEach(() => localStorage.clear());

  it('falls back safely for invalid appearance data', () => {
    expect(sanitizeAvatarAppearance({ name: '', shape: 'unknown', aura: 1 })).toEqual({
      name: 'VECTOR',
      shape: 'orb',
      aura: 'clear',
      motion: 'alive',
    });
  });

  it('persists an explicitly saved appearance', () => {
    expect(writeAvatarAppearance({ name: '星弦', shape: 'prism', aura: 'warm', motion: 'still' })).toBe(true);
    expect(readAvatarAppearance()).toEqual({
      name: '星弦',
      shape: 'prism',
      aura: 'warm',
      motion: 'still',
    });
  });
});
