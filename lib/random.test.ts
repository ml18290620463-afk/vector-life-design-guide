import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './random';

describe('createSeededRandom', () => {
  it('returns deterministic sequences for the same seed', () => {
    const first = createSeededRandom('vector');
    const second = createSeededRandom('vector');

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it('keeps values in the expected [0, 1) range', () => {
    const random = createSeededRandom('range');
    const values = Array.from({ length: 20 }, () => random());

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
