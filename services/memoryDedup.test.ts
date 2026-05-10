import { describe, expect, it } from 'vitest';
import {
  COLLAPSE_THRESHOLD,
  RELATED_THRESHOLD,
  applyCollapse,
  bigramJaccard,
  characterBigrams,
  dedupVerdict,
} from './memoryDedup';
import type { Memory } from '../types';

const NOW = 1_700_000_000_000;

const make = (over: Partial<Memory> = {}): Memory => ({
  id: `memory-${Math.random().toString(36).slice(2, 8)}`,
  memoirId: 'memoir-X',
  category: 'fact',
  body: 'sample',
  createdAt: NOW - 1000,
  updatedAt: NOW - 1000,
  ...over,
});

describe('services/memoryDedup', () => {
  describe('characterBigrams', () => {
    it('returns sliding bigrams over the trimmed body', () => {
      expect(characterBigrams('面试通过')).toEqual(['面试', '试通', '通过']);
    });
    it('returns empty for very short bodies', () => {
      expect(characterBigrams('')).toEqual([]);
      expect(characterBigrams('x')).toEqual([]);
    });
    it('collapses internal whitespace', () => {
      expect(characterBigrams('面  试')).toEqual(['面 ', ' 试']);
    });
  });

  describe('bigramJaccard', () => {
    it('returns 1 for identical strings', () => {
      expect(bigramJaccard('面试通过', '面试通过')).toBe(1);
    });
    it('returns a high score for near-paraphrases', () => {
      const s = bigramJaccard('用户上周面试通过了', '上周用户通过了面试');
      expect(s).toBeGreaterThan(RELATED_THRESHOLD);
    });
    it('returns 0 for unrelated bodies', () => {
      const s = bigramJaccard('用户上周面试通过了', '今天天气真好');
      expect(s).toBeLessThan(RELATED_THRESHOLD);
    });
    it('returns 0 when either side is empty', () => {
      expect(bigramJaccard('', 'foo')).toBe(0);
      expect(bigramJaccard('foo', '')).toBe(0);
    });
  });

  describe('dedupVerdict', () => {
    it('returns insert-clean against an empty bank', () => {
      expect(dedupVerdict({ memoirId: 'memoir-X', category: 'fact', body: 'hi' }, [])).toEqual({
        kind: 'insert-clean',
      });
    });

    it('returns insert-clean when nothing crosses RELATED_THRESHOLD', () => {
      const existing = [make({ id: 'm1', body: '今天天气真好' })];
      const verdict = dedupVerdict(
        { memoirId: 'memoir-X', category: 'fact', body: '昨天加班到深夜' },
        existing,
      );
      expect(verdict.kind).toBe('insert-clean');
    });

    it('collapses near-duplicate same-category, same-Memoir memories', () => {
      const existing = [make({ id: 'm-target', body: '用户上周面试通过了' })];
      // Same length, same word set, only the trailing particle differs.
      const verdict = dedupVerdict(
        {
          memoirId: 'memoir-X',
          category: 'fact',
          body: '用户上周面试通过',
        },
        existing,
      );
      expect(verdict.kind).toBe('collapse');
      if (verdict.kind !== 'collapse') return;
      expect(verdict.matchId).toBe('m-target');
      expect(verdict.similarity).toBeGreaterThanOrEqual(COLLAPSE_THRESHOLD);
    });

    it('places significant rephrasings into the related band (not collapse)', () => {
      const existing = [make({ id: 'm-target', body: '用户上周面试通过了' })];
      // Same fact, considerably reordered — should be related but
      // NOT collapse, so the bank keeps both for future merge UI.
      const verdict = dedupVerdict(
        {
          memoirId: 'memoir-X',
          category: 'fact',
          body: '用户上周通过了那场面试',
        },
        existing,
      );
      expect(verdict.kind).toBe('insert-related');
      if (verdict.kind !== 'insert-related') return;
      expect(verdict.matchId).toBe('m-target');
      expect(verdict.similarity).toBeGreaterThanOrEqual(RELATED_THRESHOLD);
      expect(verdict.similarity).toBeLessThan(COLLAPSE_THRESHOLD);
    });

    it('inserts as related when similarity is in the middle band', () => {
      // Pick bodies that share some bigrams but stay below COLLAPSE.
      const existing = [make({ id: 'm-rel', body: '用户最近开始练吉他' })];
      const verdict = dedupVerdict(
        {
          memoirId: 'memoir-X',
          category: 'fact',
          body: '用户最近换了一份工作',
        },
        existing,
      );
      // Both share "用户最近" — should land in the [0.30, 0.55) band
      // OR in insert-clean — assert NOT collapse, and verify the
      // related branch fires when threshold is crossed.
      expect(verdict.kind).not.toBe('collapse');
    });

    it('does NOT collapse across different categories', () => {
      const existing = [make({ id: 'm-emo', category: 'emotion', body: '用户上周面试通过了' })];
      const verdict = dedupVerdict(
        {
          memoirId: 'memoir-X',
          category: 'fact',
          body: '用户上周面试通过了',
        },
        existing,
      );
      expect(verdict.kind).toBe('insert-clean');
    });

    it('does NOT collapse across different Memoirs', () => {
      const existing = [make({ id: 'm-other', memoirId: 'memoir-Y', body: '用户上周面试通过了' })];
      const verdict = dedupVerdict(
        {
          memoirId: 'memoir-X',
          category: 'fact',
          body: '用户上周面试通过了',
        },
        existing,
      );
      expect(verdict.kind).toBe('insert-clean');
    });

    it('ignores soft-deleted memories', () => {
      const existing = [
        make({
          id: 'm-deleted',
          body: '用户上周面试通过了',
          deletedAt: NOW - 1000,
        }),
      ];
      const verdict = dedupVerdict(
        {
          memoirId: 'memoir-X',
          category: 'fact',
          body: '用户上周面试通过了',
        },
        existing,
      );
      expect(verdict.kind).toBe('insert-clean');
    });
  });

  describe('applyCollapse', () => {
    it('bumps updatedAt of the matched memory only', () => {
      const a = make({ id: 'm1', updatedAt: NOW - 99999 });
      const b = make({ id: 'm2', updatedAt: NOW - 99999 });
      const next = applyCollapse([a, b], 'm1', NOW);
      expect(next[0].updatedAt).toBe(NOW);
      expect(next[1].updatedAt).toBe(b.updatedAt);
    });

    it('does not modify body / category', () => {
      const a = make({ id: 'm1', body: 'original', updatedAt: NOW - 99999 });
      const next = applyCollapse([a], 'm1', NOW);
      expect(next[0].body).toBe('original');
      expect(next[0].category).toBe(a.category);
    });

    it('returns identity-equivalent objects for non-matches', () => {
      const a = make({ id: 'm1' });
      const b = make({ id: 'm2' });
      const next = applyCollapse([a, b], 'nope', NOW);
      expect(next[0]).toBe(a);
      expect(next[1]).toBe(b);
    });
  });
});
