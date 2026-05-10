import { describe, expect, it } from 'vitest';
import {
  DECAY_PARAMS,
  REINFORCE_BOOST,
  halfLifeRemaining,
  memorySalience,
  salienceTier,
} from './memoryDecay';
import type { Memory } from '../types';

const NOW = 1_700_000_000_000;
const day = 1000 * 60 * 60 * 24;

// Default: createdAt === updatedAt so the reinforcement boost
// is *off* by default; tests that want it must opt in by passing
// updatedAt > createdAt + 1s explicitly. Mirrors the runtime
// invariant `mintMemory` produces (it always sets the two equal).
const make = (over: Partial<Memory> = {}): Memory => {
  const updatedAt = over.updatedAt ?? NOW - 1 * day;
  const createdAt = over.createdAt ?? updatedAt;
  return {
    id: 'memory-x',
    memoirId: 'memoir-x',
    category: 'fact',
    body: 'sample',
    createdAt,
    updatedAt,
    ...over,
  };
};

describe('services/memoryDecay', () => {
  describe('memorySalience', () => {
    it('returns category base at age 0', () => {
      const m = make({ updatedAt: NOW });
      expect(memorySalience(m, NOW)).toBeCloseTo(DECAY_PARAMS.fact.base, 5);
    });

    it('halves after exactly one half-life', () => {
      for (const cat of ['milestone', 'relationship', 'emotion', 'fact'] as const) {
        const params = DECAY_PARAMS[cat];
        const m = make({
          category: cat,
          updatedAt: NOW - params.halfLifeDays * day,
        });
        expect(memorySalience(m, NOW)).toBeCloseTo(params.base / 2, 5);
      }
    });

    it('quarters after two half-lives', () => {
      const m = make({
        category: 'fact',
        updatedAt: NOW - 2 * DECAY_PARAMS.fact.halfLifeDays * day,
      });
      expect(memorySalience(m, NOW)).toBeCloseTo(DECAY_PARAMS.fact.base / 4, 5);
    });

    it('milestones decay much slower than facts of the same age', () => {
      const milestone = make({
        category: 'milestone',
        updatedAt: NOW - 90 * day,
      });
      const fact = make({ category: 'fact', updatedAt: NOW - 90 * day });
      expect(memorySalience(milestone, NOW)).toBeGreaterThan(memorySalience(fact, NOW));
    });

    it('returns 0 for soft-deleted memories regardless of age', () => {
      const m = make({ deletedAt: NOW - 1 * day, updatedAt: NOW });
      expect(memorySalience(m, NOW)).toBe(0);
    });

    it('applies reinforce boost when updatedAt is meaningfully > createdAt', () => {
      const fresh = make({
        createdAt: NOW - 30 * day,
        updatedAt: NOW - 30 * day,
      });
      const reinforced = make({
        createdAt: NOW - 30 * day,
        updatedAt: NOW - 1 * day, // re-mentioned recently
      });
      const delta = memorySalience(reinforced, NOW) - memorySalience(fresh, NOW);
      // Mostly the recency improvement, plus the +REINFORCE_BOOST.
      expect(delta).toBeGreaterThan(REINFORCE_BOOST);
    });

    it('does NOT apply reinforce boost for the no-op (createdAt == updatedAt)', () => {
      // Sanity: a fresh memory has only the decay term.
      const m = make({ createdAt: NOW, updatedAt: NOW });
      expect(memorySalience(m, NOW)).toBeCloseTo(DECAY_PARAMS.fact.base, 5);
    });

    it('clamps negative ages to zero (clock-skew defence)', () => {
      const m = make({ updatedAt: NOW + 5 * day }); // updatedAt in the future
      expect(memorySalience(m, NOW)).toBeCloseTo(DECAY_PARAMS.fact.base, 5);
    });
  });

  describe('halfLifeRemaining', () => {
    it('returns the per-category half-life for non-deleted memories', () => {
      for (const cat of ['milestone', 'relationship', 'emotion', 'fact'] as const) {
        const m = make({ category: cat, updatedAt: NOW });
        expect(halfLifeRemaining(m, NOW)).toBe(DECAY_PARAMS[cat].halfLifeDays);
      }
    });

    it('returns Infinity for soft-deleted memories', () => {
      const m = make({ deletedAt: NOW - day });
      expect(halfLifeRemaining(m, NOW)).toBe(Infinity);
    });
  });

  describe('salienceTier', () => {
    it('labels fresh memories', () => {
      expect(salienceTier(make({ updatedAt: NOW }), NOW)).toBe('warm'); // fact base = 0.6 → warm
      expect(salienceTier(make({ category: 'milestone', updatedAt: NOW }), NOW)).toBe('fresh');
    });

    it('labels stale facts as fading', () => {
      const stale = make({
        category: 'fact',
        updatedAt: NOW - 365 * day,
      });
      expect(salienceTier(stale, NOW)).toBe('fading');
    });

    it('labels soft-deleted as fading', () => {
      expect(salienceTier(make({ deletedAt: NOW - day }), NOW)).toBe('fading');
    });
  });
});
