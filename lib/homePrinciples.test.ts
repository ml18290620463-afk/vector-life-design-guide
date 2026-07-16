import { describe, expect, it } from 'vitest';
import { getHomePrinciples } from './homePrinciples';
import type { Principle } from '../types';

const principle = (id: string, createdAt: number, showOnHome: boolean): Principle => ({
  id,
  text: id,
  year: 2026,
  createdAt,
  showOnHome,
});

describe('getHomePrinciples', () => {
  it('keeps only home principles sorted newest first', () => {
    expect(
      getHomePrinciples([
        principle('old', 100, true),
        principle('hidden', 300, false),
        principle('new', 200, true),
      ]).map((item) => item.id),
    ).toEqual(['new', 'old']);
  });
});
