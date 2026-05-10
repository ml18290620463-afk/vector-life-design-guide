import { describe, expect, it } from 'vitest';
import {
  evaluateAnniversary,
  evaluatePendingFollowup,
  evaluateProactiveRecall,
  evaluateSilenceReconnect,
  lastChatPerMemoir,
  parseRoughDate,
} from './proactiveRecall';
import { mintPersona } from './personaService';
import type { DiaryEntry, Memory } from '../types';

const day = 1000 * 60 * 60 * 24;

const memoirGrandma = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});
// Force createdAt back so silence-reconnect can fire.
memoirGrandma.createdAt = 1_700_000_000_000 - 60 * day;

const memoirMentor = mintPersona({
  name: '导师',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});
memoirMentor.createdAt = 1_700_000_000_000 - 60 * day;

const personaJobs = mintPersona({
  name: '乔布斯',
  systemPrompt: 'x'.repeat(200),
  kind: 'persona',
});

const NOW = 1_700_000_000_000;

const baseMemory = (over: Partial<Memory>): Memory => ({
  id: `mem-${Math.random().toString(36).slice(2, 8)}`,
  memoirId: memoirGrandma.id,
  category: 'fact',
  body: 'sample',
  createdAt: NOW - 30 * day,
  updatedAt: NOW - 30 * day,
  ...over,
});

const baseEntry = (over: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'entry-x',
  title: 't',
  content: 'c',
  createdAt: NOW - 5 * day,
  tags: [],
  isLocked: false,
  ...over,
});

describe('services/proactiveRecall', () => {
  describe('lastChatPerMemoir', () => {
    it('returns most-recent timestamp per Memoir based on entry persona list', () => {
      const entries: DiaryEntry[] = [
        baseEntry({
          id: 'e1',
          createdAt: NOW - 30 * day,
          morningStarPersonas: ['奶奶'],
        }),
        baseEntry({
          id: 'e2',
          createdAt: NOW - 5 * day,
          morningStarPersonas: ['奶奶', '乔布斯'],
        }),
        baseEntry({
          id: 'e3',
          createdAt: NOW - 1 * day,
          morningStarPersonas: ['乔布斯'], // not a memoir
        }),
      ];
      const out = lastChatPerMemoir(entries, [memoirGrandma, personaJobs]);
      expect(out.get(memoirGrandma.id)).toBe(NOW - 5 * day);
      expect(out.has(personaJobs.id)).toBe(false);
    });

    it('returns empty map when no memoirs participated', () => {
      const out = lastChatPerMemoir(
        [baseEntry({ morningStarPersonas: ['乔布斯'] })],
        [memoirGrandma],
      );
      expect(out.size).toBe(0);
    });
  });

  describe('parseRoughDate', () => {
    it.each([
      ['今天是 5月1日 妈妈生日', 5, 1],
      ['妈妈12月25号生日', 12, 25],
      ['Birthday on May 3', 5, 3],
      ['Christmas 12/25', 12, 25],
    ])('parses "%s" → %i/%i', (body, m, d) => {
      const out = parseRoughDate(body);
      expect(out).toEqual({ month: m, day: d });
    });

    it.each(['no date here', '0月1日', '13月5日', '5月99日'])(
      'returns null for invalid: %s',
      (body) => {
        expect(parseRoughDate(body)).toBeNull();
      },
    );
  });

  describe('evaluateSilenceReconnect', () => {
    it('emits a suggestion when chat is older than 14 days', () => {
      const lastChat = new Map([[memoirGrandma.id, NOW - 30 * day]]);
      const out = evaluateSilenceReconnect([memoirGrandma], lastChat, NOW);
      expect(out).toHaveLength(1);
      expect(out[0].trigger).toBe('silence-reconnect');
      expect(out[0].memoirId).toBe(memoirGrandma.id);
    });

    it('skips when last chat is within 14 days', () => {
      const lastChat = new Map([[memoirGrandma.id, NOW - 5 * day]]);
      expect(evaluateSilenceReconnect([memoirGrandma], lastChat, NOW)).toHaveLength(0);
    });

    it('skips Memoirs that have never been chatted with', () => {
      const lastChat = new Map<string, number>();
      expect(evaluateSilenceReconnect([memoirGrandma], lastChat, NOW)).toHaveLength(0);
    });

    it('skips Memoirs younger than 14 days', () => {
      const fresh = mintPersona({
        name: 'fresh',
        systemPrompt: 'x'.repeat(200),
        kind: 'memoir',
      });
      fresh.createdAt = NOW - 3 * day;
      const lastChat = new Map([[fresh.id, NOW - 30 * day]]);
      expect(evaluateSilenceReconnect([fresh], lastChat, NOW)).toHaveLength(0);
    });

    it('ignores non-memoir personas', () => {
      const lastChat = new Map([[personaJobs.id, NOW - 30 * day]]);
      expect(evaluateSilenceReconnect([personaJobs], lastChat, NOW)).toHaveLength(0);
    });
  });

  describe('evaluateAnniversary', () => {
    it('emits suggestion when a milestone matches today\u2019s month/day', () => {
      const today = new Date(NOW);
      const m = today.getUTCMonth() + 1;
      const d = today.getUTCDate();
      const memories = [
        baseMemory({
          id: 'mile-1',
          category: 'milestone',
          body: `今天是 ${m}月${d}日 妈妈生日`,
        }),
      ];
      const out = evaluateAnniversary([memoirGrandma], memories, NOW);
      expect(out).toHaveLength(1);
      expect(out[0].trigger).toBe('anniversary');
      expect(out[0].anchorMemoryId).toBe('mile-1');
    });

    it('emits at most one suggestion per memoir even with multiple matches', () => {
      const today = new Date(NOW);
      const m = today.getUTCMonth() + 1;
      const d = today.getUTCDate();
      const memories = [
        baseMemory({
          id: 'a',
          category: 'milestone',
          body: `今天是 ${m}月${d}日 妈妈生日`,
        }),
        baseMemory({
          id: 'b',
          category: 'milestone',
          body: `${m}月${d}日 也是爷爷祭日`,
        }),
      ];
      const out = evaluateAnniversary([memoirGrandma], memories, NOW);
      expect(out).toHaveLength(1);
    });

    it('skips milestones whose date does not match today', () => {
      const memories = [baseMemory({ id: 'a', category: 'milestone', body: '1月1日 元旦' })];
      // NOW is mid-November 2023 — won't match Jan 1.
      expect(evaluateAnniversary([memoirGrandma], memories, NOW)).toHaveLength(0);
    });

    it('ignores non-milestone categories', () => {
      const today = new Date(NOW);
      const m = today.getUTCMonth() + 1;
      const d = today.getUTCDate();
      const memories = [baseMemory({ category: 'fact', body: `${m}月${d}日 用户面试` })];
      expect(evaluateAnniversary([memoirGrandma], memories, NOW)).toHaveLength(0);
    });

    it('ignores soft-deleted milestones', () => {
      const today = new Date(NOW);
      const m = today.getUTCMonth() + 1;
      const d = today.getUTCDate();
      const memories = [
        baseMemory({
          category: 'milestone',
          body: `${m}月${d}日 妈妈生日`,
          deletedAt: NOW - 100,
        }),
      ];
      expect(evaluateAnniversary([memoirGrandma], memories, NOW)).toHaveLength(0);
    });
  });

  describe('evaluatePendingFollowup', () => {
    it('emits when a forward-looking fact is older than 7 days and never followed up', () => {
      const memories = [
        baseMemory({
          id: 'fact-1',
          category: 'fact',
          body: '用户下周要面试',
          createdAt: NOW - 14 * day,
        }),
      ];
      const lastChat = new Map<string, number>(); // never chatted
      const out = evaluatePendingFollowup([memoirGrandma], memories, lastChat, NOW);
      expect(out).toHaveLength(1);
      expect(out[0].trigger).toBe('pending-followup');
      expect(out[0].anchorMemoryId).toBe('fact-1');
    });

    it('skips when the user already chatted after the memory was created', () => {
      const memories = [
        baseMemory({
          category: 'fact',
          body: '用户下周要面试',
          createdAt: NOW - 14 * day,
        }),
      ];
      const lastChat = new Map([[memoirGrandma.id, NOW - 1 * day]]);
      expect(evaluatePendingFollowup([memoirGrandma], memories, lastChat, NOW)).toHaveLength(0);
    });

    it('skips memories younger than 7 days', () => {
      const memories = [
        baseMemory({
          category: 'fact',
          body: '用户下周要面试',
          createdAt: NOW - 3 * day,
        }),
      ];
      expect(evaluatePendingFollowup([memoirGrandma], memories, new Map(), NOW)).toHaveLength(0);
    });

    it('skips memories without forward-looking shape', () => {
      const memories = [
        baseMemory({
          category: 'fact',
          body: '用户上周面试通过了', // past
          createdAt: NOW - 14 * day,
        }),
      ];
      expect(evaluatePendingFollowup([memoirGrandma], memories, new Map(), NOW)).toHaveLength(0);
    });
  });

  describe('evaluateProactiveRecall (top-level merge)', () => {
    it('returns at most one suggestion per Memoir; specificity wins', () => {
      const today = new Date(NOW);
      const m = today.getUTCMonth() + 1;
      const d = today.getUTCDate();
      const memories = [
        // Anniversary candidate (most specific).
        baseMemory({
          id: 'anniv',
          category: 'milestone',
          body: `${m}月${d}日 奶奶生日`,
        }),
        // Pending-followup candidate.
        baseMemory({
          id: 'pending',
          category: 'fact',
          body: '用户下周要面试',
          createdAt: NOW - 14 * day,
        }),
      ];
      // Old chat → would also fire silence-reconnect.
      const entries = [
        baseEntry({
          createdAt: NOW - 30 * day,
          morningStarPersonas: ['奶奶'],
        }),
      ];
      const out = evaluateProactiveRecall({
        memoirs: [memoirGrandma],
        memories,
        entries,
        now: NOW,
      });
      expect(out).toHaveLength(1);
      expect(out[0].trigger).toBe('anniversary');
    });

    it('respects the isOnCooldown predicate', () => {
      const memories: Memory[] = [];
      const entries = [
        baseEntry({
          createdAt: NOW - 30 * day,
          morningStarPersonas: ['奶奶'],
        }),
      ];
      const out = evaluateProactiveRecall({
        memoirs: [memoirGrandma],
        memories,
        entries,
        now: NOW,
        isOnCooldown: (id, trigger) => id === memoirGrandma.id && trigger === 'silence-reconnect',
      });
      expect(out).toHaveLength(0);
    });

    it('returns empty list when no memoirs are present', () => {
      const out = evaluateProactiveRecall({
        memoirs: [],
        memories: [],
        entries: [],
        now: NOW,
      });
      expect(out).toEqual([]);
    });
  });
});
