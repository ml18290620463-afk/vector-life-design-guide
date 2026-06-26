import { describe, expect, it } from 'vitest';
import {
  LETTER_LIMITS,
  cancelLetter,
  clearLettersForMemoir,
  dueLetters,
  hydrateLetters,
  listLettersForMemoir,
  looksLikeLetter,
  markAttemptFailed,
  markDelivered,
  mintLetter,
  recentlyDeliveredLetters,
  sanitizeLetter,
} from './letterService';
import type { PendingLetter } from '../types';

const NOW = 1_700_000_000_000;
const hour = 60 * 60 * 1000;
const day = 24 * hour;

const baseLetter = (over: Partial<PendingLetter> = {}): PendingLetter => ({
  id: `letter-${Math.random().toString(36).slice(2, 8)}`,
  memoirId: 'memoir-X',
  body: 'I miss you, I want to tell you something.',
  composedAt: NOW - 1 * hour,
  deliverAt: NOW + 23 * hour,
  status: 'pending',
  ...over,
});

describe('services/letterService', () => {
  describe('mintLetter', () => {
    it('returns a fully-formed letter on the success branch', () => {
      const result = mintLetter({
        memoirId: 'memoir-X',
        body: '想跟你说一些事',
        delayMs: 24 * hour,
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.letter.id).toMatch(/^letter-/);
      expect(result.letter.memoirId).toBe('memoir-X');
      expect(result.letter.body).toBe('想跟你说一些事');
      expect(result.letter.composedAt).toBe(NOW);
      expect(result.letter.deliverAt).toBe(NOW + 24 * hour);
      expect(result.letter.status).toBe('pending');
    });

    it('rejects empty / whitespace-only bodies', () => {
      expect(mintLetter({ memoirId: 'memoir-X', body: '   ', delayMs: hour, now: NOW })).toEqual({
        ok: false,
        reason: 'empty-body',
      });
    });

    it('rejects missing memoirId', () => {
      expect(mintLetter({ memoirId: '', body: 'hi', delayMs: hour, now: NOW })).toEqual({
        ok: false,
        reason: 'missing-memoirId',
      });
    });

    it('clamps delay below the floor up to MIN_DELAY_MS', () => {
      const result = mintLetter({
        memoirId: 'memoir-X',
        body: 'hi',
        delayMs: 1000,
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.letter.deliverAt - result.letter.composedAt).toBe(LETTER_LIMITS.minDelayMs);
    });

    it('clamps delay above the ceiling down to MAX_DELAY_MS', () => {
      const result = mintLetter({
        memoirId: 'memoir-X',
        body: 'hi',
        delayMs: 365 * day,
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.letter.deliverAt - result.letter.composedAt).toBe(LETTER_LIMITS.maxDelayMs);
    });

    it('caps body at LETTER_LIMITS.body characters', () => {
      const long = 'X'.repeat(LETTER_LIMITS.body + 500);
      const result = mintLetter({
        memoirId: 'memoir-X',
        body: long,
        delayMs: hour,
        now: NOW,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.letter.body.length).toBe(LETTER_LIMITS.body);
    });
  });

  describe('looksLikeLetter / sanitizeLetter / hydrateLetters', () => {
    it('rejects shapes missing required fields', () => {
      expect(looksLikeLetter(null)).toBe(false);
      expect(looksLikeLetter({})).toBe(false);
      expect(looksLikeLetter({ ...baseLetter(), status: 'bogus' })).toBe(false);
      expect(looksLikeLetter({ ...baseLetter(), body: '' })).toBe(false);
    });

    it('hydrateLetters drops invalid items', () => {
      const valid = baseLetter({ id: 'letter-good' });
      const out = hydrateLetters([valid, { id: 'bad' }, null, 'oops']);
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('letter-good');
    });

    it('sanitizeLetter trims body but preserves attempts / replyEntryId', () => {
      const out = sanitizeLetter(
        baseLetter({
          body: '   hello   ',
          attempts: 2,
          replyEntryId: 'entry-XYZ',
          status: 'delivered',
        }),
      );
      expect(out?.body).toBe('hello');
      expect(out?.attempts).toBe(2);
      expect(out?.replyEntryId).toBe('entry-XYZ');
    });
  });

  describe('cancelLetter', () => {
    it('flips a pending letter to cancelled', () => {
      const list = [baseLetter({ id: 'l1' })];
      const next = cancelLetter(list, 'l1');
      expect(next[0].status).toBe('cancelled');
    });

    it('is a no-op for a non-pending letter', () => {
      const list = [baseLetter({ id: 'l1', status: 'delivered' })];
      const next = cancelLetter(list, 'l1');
      expect(next[0].status).toBe('delivered');
    });

    it('is a no-op for an unknown id', () => {
      const list = [baseLetter({ id: 'l1' })];
      const next = cancelLetter(list, 'missing');
      expect(next[0].status).toBe('pending');
    });
  });

  describe('markDelivered', () => {
    it('flips status + writes replyEntryId + lastAttemptAt', () => {
      const list = [baseLetter({ id: 'l1' })];
      const next = markDelivered(list, 'l1', 'entry-reply-1', NOW + 25 * hour);
      expect(next[0].status).toBe('delivered');
      expect(next[0].replyEntryId).toBe('entry-reply-1');
      expect(next[0].lastAttemptAt).toBe(NOW + 25 * hour);
    });
  });

  describe('markAttemptFailed', () => {
    it('increments attempts but stays pending below the cap', () => {
      const list = [baseLetter({ id: 'l1' })];
      const next = markAttemptFailed(list, 'l1', NOW);
      expect(next[0].status).toBe('pending');
      expect(next[0].attempts).toBe(1);
      expect(next[0].lastAttemptAt).toBe(NOW);
    });

    it('flips to failed when attempts hits the cap', () => {
      const list = [baseLetter({ id: 'l1', attempts: 2 })];
      const next = markAttemptFailed(list, 'l1', NOW);
      expect(next[0].status).toBe('failed');
      expect(next[0].attempts).toBe(LETTER_LIMITS.maxAttempts);
    });
  });

  describe('listLettersForMemoir', () => {
    it('returns scoped letters newest-composed-first', () => {
      const list = [
        baseLetter({ id: 'old', composedAt: NOW - 5 * day }),
        baseLetter({ id: 'new', composedAt: NOW - 1 * day }),
        baseLetter({ id: 'other', memoirId: 'memoir-Y' }),
      ];
      const out = listLettersForMemoir(list, 'memoir-X');
      expect(out.map((l) => l.id)).toEqual(['new', 'old']);
    });
  });

  describe('dueLetters', () => {
    const known = new Set(['memoir-X']);

    it('returns only pending + due + known-memoir letters', () => {
      const list = [
        baseLetter({ id: 'due', deliverAt: NOW - hour }),
        baseLetter({ id: 'future', deliverAt: NOW + hour }),
        baseLetter({ id: 'cancelled', deliverAt: NOW - hour, status: 'cancelled' }),
        baseLetter({ id: 'orphan', deliverAt: NOW - hour, memoirId: 'memoir-DELETED' }),
      ];
      const out = dueLetters(list, known, NOW);
      expect(out.map((l) => l.id)).toEqual(['due']);
    });

    it('respects exponential back-off for failed attempts', () => {
      const list = [
        // attempts=1 → backoff = 5min × 2 = 10min
        baseLetter({
          id: 'recent',
          deliverAt: NOW - hour,
          lastAttemptAt: NOW - 5 * 60 * 1000,
          attempts: 1,
        }),
        baseLetter({
          id: 'past-backoff',
          deliverAt: NOW - hour,
          lastAttemptAt: NOW - 30 * 60 * 1000,
          attempts: 1,
        }),
      ];
      const out = dueLetters(list, known, NOW);
      expect(out.map((l) => l.id)).toEqual(['past-backoff']);
    });
  });

  describe('recentlyDeliveredLetters', () => {
    it('returns delivered-within-24h letters newest-first', () => {
      const list = [
        baseLetter({
          id: 'fresh',
          status: 'delivered',
          replyEntryId: 'e1',
          lastAttemptAt: NOW - 1 * hour,
        }),
        baseLetter({
          id: 'old',
          status: 'delivered',
          replyEntryId: 'e2',
          lastAttemptAt: NOW - 36 * hour,
        }),
        baseLetter({ id: 'pending', status: 'pending' }),
      ];
      const out = recentlyDeliveredLetters(list, NOW);
      expect(out.map((l) => l.id)).toEqual(['fresh']);
    });
  });

  describe('clearLettersForMemoir', () => {
    it('drops all letters of one memoir, keeps others', () => {
      const list = [
        baseLetter({ id: 'a', memoirId: 'memoir-X' }),
        baseLetter({ id: 'b', memoirId: 'memoir-Y' }),
      ];
      const next = clearLettersForMemoir(list, 'memoir-X');
      expect(next.map((l) => l.id)).toEqual(['b']);
    });
  });
});
