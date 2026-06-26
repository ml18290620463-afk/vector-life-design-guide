import { describe, expect, it } from 'vitest';
import {
  MEMORY_LIMITS,
  clearMemoirMemories,
  countLiveMemoriesForMemoir,
  deleteMemory,
  detectUnsafeMemoryBody,
  evictLowestSalience,
  hydrateMemories,
  listSoftDeletedForMemoir,
  looksLikeMemory,
  mintMemory,
  purgeExpiredSoftDeletes,
  restoreSoftDeletedMemory,
  sanitizeMemory,
  selectMemoriesForRecall,
  softDeleteMemory,
  updateMemory,
} from './memoryService';
import type { Memory } from '../types';

const baseMintInput = {
  memoirId: 'memoir-test-1',
  category: 'fact' as const,
  body: '用户周五要面试',
};

const makeMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: `memory-${Math.random().toString(36).slice(2)}`,
  memoirId: 'memoir-test-1',
  category: 'fact',
  body: '用户周五要面试',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

describe('services/memoryService', () => {
  describe('mintMemory', () => {
    it('returns a fully-formed memory on the success branch', () => {
      const before = Date.now();
      const result = mintMemory(baseMintInput);
      const after = Date.now();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.memory.id).toMatch(/^memory-/);
      expect(result.memory.memoirId).toBe('memoir-test-1');
      expect(result.memory.category).toBe('fact');
      expect(result.memory.body).toBe('用户周五要面试');
      expect(result.memory.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.memory.createdAt).toBeLessThanOrEqual(after);
      expect(result.memory.updatedAt).toBe(result.memory.createdAt);
    });

    it('rejects empty / whitespace-only bodies', () => {
      const result = mintMemory({ ...baseMintInput, body: '   ' });
      expect(result).toEqual({ ok: false, reason: 'empty-body' });
    });

    it('rejects missing memoirId', () => {
      const result = mintMemory({ ...baseMintInput, memoirId: '' });
      expect(result).toEqual({ ok: false, reason: 'missing-memoirId' });
    });

    it('rejects an invalid category', () => {
      const result = mintMemory({
        ...baseMintInput,
        category: 'bogus' as 'fact',
      });
      expect(result).toEqual({ ok: false, reason: 'invalid-category' });
    });

    it('rejects bodies that contain an email address', () => {
      const result = mintMemory({
        ...baseMintInput,
        body: 'Contact me at user@example.com about the meeting',
      });
      expect(result).toEqual({ ok: false, reason: 'unsafe:email-address' });
    });

    it('rejects bodies that contain a long phone number', () => {
      const result = mintMemory({
        ...baseMintInput,
        body: 'Call back at 138 0013 8000 tomorrow',
      });
      expect(result).toEqual({ ok: false, reason: 'unsafe:phone-number' });
    });

    it('caps body at MEMORY_LIMITS.body characters', () => {
      const long = 'X'.repeat(MEMORY_LIMITS.body + 50);
      const result = mintMemory({ ...baseMintInput, body: long });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.memory.body.length).toBe(MEMORY_LIMITS.body);
    });

    it('honours skipSafetyCheck for the v3-backup importer path', () => {
      const result = mintMemory({
        ...baseMintInput,
        body: 'reach me at user@example.com',
        skipSafetyCheck: true,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('detectUnsafeMemoryBody', () => {
    it('marks plain text as safe', () => {
      expect(detectUnsafeMemoryBody('用户最近很焦虑').safe).toBe(true);
    });

    it.each([
      ['email', 'reach me at me@x.com', 'email-address'],
      ['phone', 'call 1800-555-0199 please', 'phone-number'],
      ['national-id', 'ID 11010119900307123X', 'national-id'],
    ])('flags %s body as unsafe', (_label, body, reason) => {
      const verdict = detectUnsafeMemoryBody(body);
      expect(verdict.safe).toBe(false);
      expect(verdict.reason).toBe(reason);
    });
  });

  describe('looksLikeMemory + sanitizeMemory + hydrateMemories', () => {
    it('rejects shapes missing required fields', () => {
      expect(looksLikeMemory(null)).toBe(false);
      expect(looksLikeMemory({})).toBe(false);
      expect(looksLikeMemory({ ...makeMemory(), body: '' })).toBe(false);
      expect(looksLikeMemory({ ...makeMemory(), category: 'unknown' })).toBe(false);
    });

    it('sanitizeMemory trims body + caps it at MEMORY_LIMITS.body', () => {
      const long = `   ${'X'.repeat(MEMORY_LIMITS.body + 100)}   `;
      const result = sanitizeMemory(makeMemory({ body: long }));
      expect(result?.body.length).toBe(MEMORY_LIMITS.body);
    });

    it('hydrateMemories drops invalid items but preserves valid ones', () => {
      const valid = makeMemory({ id: 'memory-good' });
      const corrupt = { ...makeMemory(), category: 'bogus' };
      const out = hydrateMemories([valid, corrupt, null, 'bad', { id: 'no-fields' }]);
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('memory-good');
    });
  });

  describe('updateMemory', () => {
    it('patches body + bumps updatedAt', () => {
      const list = [makeMemory({ id: 'memory-a', body: 'old' })];
      const next = updateMemory(list, 'memory-a', { body: 'new body' });
      expect(next).not.toBe(list);
      expect(next[0].body).toBe('new body');
      expect(next[0].updatedAt).toBeGreaterThanOrEqual(list[0].updatedAt);
    });

    it('returns the same array reference when id is not found', () => {
      const list = [makeMemory({ id: 'memory-a' })];
      const next = updateMemory(list, 'memory-missing', { body: 'x' });
      expect(next).toBe(list);
    });
  });

  describe('deleteMemory + clearMemoirMemories', () => {
    it('removes a single memory by id', () => {
      const list = [makeMemory({ id: 'memory-a' }), makeMemory({ id: 'memory-b' })];
      const next = deleteMemory(list, 'memory-a');
      expect(next).toEqual([list[1]]);
    });

    it('clears every memory belonging to one memoir without touching others', () => {
      const list = [
        makeMemory({ id: 'memory-a', memoirId: 'memoir-1' }),
        makeMemory({ id: 'memory-b', memoirId: 'memoir-2' }),
        makeMemory({ id: 'memory-c', memoirId: 'memoir-1' }),
      ];
      const next = clearMemoirMemories(list, 'memoir-1');
      expect(next).toHaveLength(1);
      expect(next[0].memoirId).toBe('memoir-2');
    });
  });

  describe('selectMemoriesForRecall', () => {
    const NOW = 1_700_000_000_000;
    const day = 1000 * 60 * 60 * 24;
    const buildList = (): Memory[] => [
      makeMemory({ id: 'fresh-fact', body: '今天面试很顺利', updatedAt: NOW - 1 * day }),
      makeMemory({
        id: 'old-fact',
        body: '去年生日聚餐',
        updatedAt: NOW - 90 * day,
      }),
      makeMemory({
        id: 'milestone',
        category: 'milestone',
        body: '爷爷的忌日',
        updatedAt: NOW - 30 * day,
      }),
      // Different memoir — must be filtered out.
      makeMemory({
        id: 'other-memoir',
        memoirId: 'memoir-OTHER',
        body: '面试',
        updatedAt: NOW,
      }),
    ];

    it('only returns memories scoped to the requested memoir', () => {
      const out = selectMemoriesForRecall(buildList(), {
        memoirId: 'memoir-test-1',
        now: NOW,
      });
      expect(out.every((m) => m.memoirId === 'memoir-test-1')).toBe(true);
      expect(out.find((m) => m.id === 'other-memoir')).toBeUndefined();
    });

    it('ranks fresh / milestone memories above stale facts', () => {
      const out = selectMemoriesForRecall(buildList(), {
        memoirId: 'memoir-test-1',
        now: NOW,
      });
      const ids = out.map((m) => m.id);
      // fresh-fact (1 day old) AND milestone (30 day, +0.4 boost) both
      // outrank old-fact (90 days, halved). Order between fresh-fact
      // and milestone is implementation-defined; we just assert
      // old-fact is last.
      expect(ids[ids.length - 1]).toBe('old-fact');
      expect(ids).toContain('fresh-fact');
      expect(ids).toContain('milestone');
    });

    it('boosts memories whose body overlaps with the query keywords', () => {
      const list = buildList();
      const out = selectMemoriesForRecall(list, {
        memoirId: 'memoir-test-1',
        now: NOW,
        query: '面试 顺利',
      });
      // fresh-fact has both "面试" and "顺利" → highest score.
      expect(out[0].id).toBe('fresh-fact');
    });

    it('respects the limit parameter', () => {
      const out = selectMemoriesForRecall(buildList(), {
        memoirId: 'memoir-test-1',
        now: NOW,
        limit: 1,
      });
      expect(out).toHaveLength(1);
    });

    it('Phase 4 W4 — filters out soft-deleted memories', () => {
      const list = buildList();
      // Soft-delete the fresh-fact entry.
      const next = list.map((m) => (m.id === 'fresh-fact' ? { ...m, deletedAt: NOW - 1000 } : m));
      const out = selectMemoriesForRecall(next, {
        memoirId: 'memoir-test-1',
        now: NOW,
        query: '面试',
      });
      expect(out.find((m) => m.id === 'fresh-fact')).toBeUndefined();
    });

    it('Phase 4 W4 — category prior boosts emotion memories on emotion-shaped queries', () => {
      const list = [
        makeMemory({
          id: 'emo',
          category: 'emotion',
          body: '用户最近很焦虑',
          updatedAt: NOW - 1 * day,
        }),
        makeMemory({
          id: 'fact',
          category: 'fact',
          body: '用户最近换了工作',
          updatedAt: NOW - 1 * day,
        }),
      ];
      const out = selectMemoriesForRecall(list, {
        memoirId: 'memoir-test-1',
        now: NOW,
        query: '我今天很焦虑',
      });
      // Emotion memory wins via the +0.3 prior on emotion-shaped queries.
      expect(out[0].id).toBe('emo');
    });
  });

  /* -------------------------------------------------------------- */
  /*  Phase 4 W4 §2.5 — soft delete + recycle bin                   */
  /* -------------------------------------------------------------- */

  describe('softDeleteMemory + restoreSoftDeletedMemory', () => {
    const NOW = 1_700_000_000_000;
    it('stamps deletedAt when called', () => {
      const list = [makeMemory({ id: 'm-a' })];
      const next = softDeleteMemory(list, 'm-a', NOW);
      expect(next[0].deletedAt).toBe(NOW);
    });
    it('returns identity-equal array when id not found', () => {
      const list = [makeMemory({ id: 'm-a' })];
      expect(softDeleteMemory(list, 'm-missing', NOW)).toBe(list);
    });
    it('restoreSoftDeletedMemory clears the deletedAt field', () => {
      const list = [makeMemory({ id: 'm-a', deletedAt: NOW - 1000 })];
      const next = restoreSoftDeletedMemory(list, 'm-a');
      expect(next[0].deletedAt).toBeUndefined();
    });
    it('restoreSoftDeletedMemory is a no-op for non-deleted memories', () => {
      const list = [makeMemory({ id: 'm-a' })];
      expect(restoreSoftDeletedMemory(list, 'm-a')).toBe(list);
    });
  });

  describe('purgeExpiredSoftDeletes', () => {
    const NOW = 1_700_000_000_000;
    const day = 1000 * 60 * 60 * 24;
    it('hard-removes memories whose deletedAt is older than 30 days', () => {
      const list = [
        makeMemory({ id: 'expired', deletedAt: NOW - 35 * day }),
        makeMemory({ id: 'recent', deletedAt: NOW - 5 * day }),
        makeMemory({ id: 'live' }),
      ];
      const next = purgeExpiredSoftDeletes(list, NOW);
      expect(next.map((m) => m.id).sort()).toEqual(['live', 'recent']);
    });
    it('leaves a clean list untouched', () => {
      const list = [makeMemory({ id: 'live' })];
      const next = purgeExpiredSoftDeletes(list, NOW);
      expect(next).toHaveLength(1);
    });
  });

  describe('listSoftDeletedForMemoir', () => {
    const NOW = 1_700_000_000_000;
    it('returns soft-deleted memories of one Memoir, newest-first', () => {
      const list = [
        makeMemory({ id: 'a', deletedAt: NOW - 1000 }),
        makeMemory({ id: 'b', deletedAt: NOW - 5000 }),
        makeMemory({ id: 'c' }), // live — exclude
        makeMemory({ id: 'd', memoirId: 'memoir-OTHER', deletedAt: NOW }), // exclude
      ];
      const out = listSoftDeletedForMemoir(list, 'memoir-test-1');
      expect(out.map((m) => m.id)).toEqual(['a', 'b']);
    });
  });

  /* -------------------------------------------------------------- */
  /*  Phase 4 W4 §2.3 — capacity + eviction                          */
  /* -------------------------------------------------------------- */

  describe('countLiveMemoriesForMemoir', () => {
    const NOW = 1_700_000_000_000;
    it('counts only live, same-Memoir memories', () => {
      const list = [
        makeMemory({ id: 'a' }),
        makeMemory({ id: 'b' }),
        makeMemory({ id: 'c', deletedAt: NOW }),
        makeMemory({ id: 'd', memoirId: 'memoir-OTHER' }),
      ];
      expect(countLiveMemoriesForMemoir(list, 'memoir-test-1')).toBe(2);
    });
  });

  describe('evictLowestSalience', () => {
    const NOW = 1_700_000_000_000;
    const day = 1000 * 60 * 60 * 24;

    it('returns identity-equal when below cap', () => {
      const list = [makeMemory({ id: 'a' })];
      expect(evictLowestSalience(list, 'memoir-test-1', 10, NOW)).toBe(list);
    });

    it('drops the lowest-salience memory when at cap', () => {
      const list = [
        makeMemory({
          id: 'old-fact',
          category: 'fact',
          updatedAt: NOW - 200 * day,
        }),
        makeMemory({
          id: 'fresh-fact',
          category: 'fact',
          updatedAt: NOW - 1 * day,
        }),
      ];
      const next = evictLowestSalience(list, 'memoir-test-1', 2, NOW);
      expect(next).toHaveLength(1);
      expect(next[0].id).toBe('fresh-fact');
    });

    it('refuses to evict milestone memories even when at cap', () => {
      const list = [
        makeMemory({
          id: 'old-milestone',
          category: 'milestone',
          updatedAt: NOW - 500 * day,
        }),
        makeMemory({
          id: 'fresh-fact',
          category: 'fact',
          updatedAt: NOW - 1 * day,
        }),
      ];
      const next = evictLowestSalience(list, 'memoir-test-1', 2, NOW);
      expect(next).toHaveLength(1);
      expect(next[0].id).toBe('old-milestone');
    });

    it('returns identity-equal when bank is milestone-saturated', () => {
      const list = [
        makeMemory({ id: 'a', category: 'milestone' }),
        makeMemory({ id: 'b', category: 'milestone' }),
      ];
      expect(evictLowestSalience(list, 'memoir-test-1', 2, NOW)).toBe(list);
    });

    it('soft-deleted memories do not count toward the cap', () => {
      const list = [makeMemory({ id: 'a', deletedAt: NOW - 100 }), makeMemory({ id: 'b' })];
      // cap=2, 1 live → no eviction.
      expect(evictLowestSalience(list, 'memoir-test-1', 2, NOW)).toBe(list);
    });

    it('relationship memories are stickier than facts under same age', () => {
      const list = [
        makeMemory({
          id: 'rel',
          category: 'relationship',
          updatedAt: NOW - 60 * day,
        }),
        makeMemory({
          id: 'fact',
          category: 'fact',
          updatedAt: NOW - 60 * day,
        }),
      ];
      const next = evictLowestSalience(list, 'memoir-test-1', 2, NOW);
      expect(next).toHaveLength(1);
      // Bias × salience: relationship wins.
      expect(next[0].id).toBe('rel');
    });
  });
});
