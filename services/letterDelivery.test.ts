import { describe, expect, it, vi } from 'vitest';
import { deliverLetter } from './letterDelivery';
import { mintPersona } from './personaService';
import type { PendingLetter } from '../types';

const memoir = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const persona = mintPersona({
  name: '乔布斯',
  systemPrompt: 'x'.repeat(200),
  kind: 'persona',
});

const NOW = 1_700_000_000_000;

const baseLetter: PendingLetter = {
  id: 'letter-1',
  memoirId: memoir.id,
  body: '想跟你说一件事 - 我换了工作。',
  composedAt: NOW - 24 * 60 * 60 * 1000,
  deliverAt: NOW,
  status: 'pending',
};

describe('services/letterDelivery', () => {
  it('returns persona-not-memoir when given a non-memoir persona', async () => {
    const out = await deliverLetter({
      letter: baseLetter,
      memoir: persona,
      mintReplyEntry: vi.fn(),
      fetcher: vi.fn(),
    });
    expect(out).toEqual({ ok: false, reason: 'persona-not-memoir' });
  });

  it('returns ai-unavailable when the fetcher rejects', async () => {
    const out = await deliverLetter({
      letter: baseLetter,
      memoir,
      mintReplyEntry: vi.fn(),
      fetcher: vi.fn().mockRejectedValue(new Error('network down')),
    });
    expect(out).toEqual({ ok: false, reason: 'ai-unavailable' });
  });

  it('returns ai-empty-response when the AI returns the fallback signature', async () => {
    const out = await deliverLetter({
      letter: baseLetter,
      memoir,
      mintReplyEntry: vi.fn(),
      fetcher: vi.fn().mockResolvedValue('某些消息 ... 星光指引中断 ...'),
    });
    expect(out).toEqual({ ok: false, reason: 'ai-empty-response' });
  });

  it('returns persist-failed when mintReplyEntry throws', async () => {
    const out = await deliverLetter({
      letter: baseLetter,
      memoir,
      mintReplyEntry: vi.fn().mockRejectedValue(new Error('IDB busy')),
      fetcher: vi.fn().mockResolvedValue(
        JSON.stringify({
          content: '### ✉️ 来自 奶奶 的回信\n\n孩子,我都听见了。',
          metrics: {},
        }),
      ),
    });
    expect(out).toEqual({ ok: false, reason: 'persist-failed' });
  });

  it('returns persist-failed when mintReplyEntry resolves to an empty id', async () => {
    const out = await deliverLetter({
      letter: baseLetter,
      memoir,
      mintReplyEntry: vi.fn().mockResolvedValue(''),
      fetcher: vi.fn().mockResolvedValue(
        JSON.stringify({
          content: '### ✉️ 来自 奶奶 的回信\n\n慢慢来。',
          metrics: {},
        }),
      ),
    });
    expect(out).toEqual({ ok: false, reason: 'persist-failed' });
  });

  it('on success, mints an entry with isLetterReply + letterId + tags', async () => {
    const mintReplyEntry = vi.fn().mockResolvedValue('entry-XYZ');
    const fetcher = vi.fn().mockResolvedValue(
      JSON.stringify({
        content: '### ✉️ 来自 奶奶 的回信\n\n孩子,不要紧。',
        metrics: {},
      }),
    );
    const out = await deliverLetter({
      letter: baseLetter,
      memoir,
      mintReplyEntry,
      fetcher,
    });
    expect(out).toEqual({ ok: true, replyEntryId: 'entry-XYZ' });
    expect(mintReplyEntry).toHaveBeenCalledTimes(1);
    const payload = mintReplyEntry.mock.calls[0][0];
    expect(payload.isLetterReply).toBe(true);
    expect(payload.letterId).toBe('letter-1');
    expect(payload.tags).toContain('letter-reply');
    expect(payload.morningStarPersonas).toEqual(['奶奶']);
    // The user's letter body lives in `reflection` (the field the
    // Morning Star template weights for tone).
    expect(payload.reflection).toBe(baseLetter.body);
  });

  it('forwards customPersonaPrompts + memoirRecallByPersona to the fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      JSON.stringify({
        content: '### ✉️ 来自 奶奶 的回信\n\n好。',
        metrics: {},
      }),
    );
    await deliverLetter({
      letter: baseLetter,
      memoir,
      mintReplyEntry: vi.fn().mockResolvedValue('entry-1'),
      fetcher,
      customPersonaPrompts: { 奶奶: 'You are 奶奶...' },
      memoirRecallByPersona: { 奶奶: [{ body: '用户上次说要换工作' }] },
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('奶奶'),
      baseLetter.body,
      ['奶奶'],
      { 奶奶: 'You are 奶奶...' },
      { 奶奶: [{ body: '用户上次说要换工作' }] },
    );
  });
});
