import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as idb from 'idb-keyval';
import { useLetterStore } from './useLetterStore';
import type { PendingLetter } from '../types';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

const NOW = 1_700_000_000_000;
const hour = 60 * 60 * 1000;

const seed = (over: Partial<PendingLetter> = {}): PendingLetter => ({
  id: `letter-${Math.random().toString(36).slice(2, 8)}`,
  memoirId: 'memoir-X',
  body: 'hi',
  composedAt: NOW - 1 * hour,
  deliverAt: NOW + 23 * hour,
  status: 'pending',
  ...over,
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

describe('useLetterStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(idb.get).mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts loading + resolves to empty list when nothing is stored', async () => {
    const { result } = renderHook(() => useLetterStore());
    expect(result.current.loading).toBe(true);
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.letters).toEqual([]);
  });

  it('hydrates from IDB + drops malformed entries', async () => {
    vi.mocked(idb.get).mockResolvedValue([seed({ id: 'good' }), { id: 'bad' }, null]);
    const { result } = renderHook(() => useLetterStore());
    await flush();
    expect(result.current.letters).toHaveLength(1);
    expect(result.current.letters[0].id).toBe('good');
  });

  it('add persists a fresh letter', async () => {
    const { result } = renderHook(() => useLetterStore());
    await flush();
    let returned;
    await act(async () => {
      returned = await result.current.add({
        memoirId: 'memoir-X',
        body: '想跟你说一些事',
        delayMs: 24 * hour,
      });
    });
    expect(returned?.ok).toBe(true);
    expect(result.current.letters).toHaveLength(1);
    expect(idb.set).toHaveBeenCalledWith('vector_master_vault_pending_letters', expect.any(Array));
  });

  it('add surfaces validation failure when body is empty', async () => {
    const { result } = renderHook(() => useLetterStore());
    await flush();
    let returned;
    await act(async () => {
      returned = await result.current.add({
        memoirId: 'memoir-X',
        body: '   ',
        delayMs: hour,
      });
    });
    expect(returned?.ok).toBe(false);
    expect(result.current.letters).toHaveLength(0);
  });

  it('cancel flips status to cancelled', async () => {
    vi.mocked(idb.get).mockResolvedValue([seed({ id: 'l1' })]);
    const { result } = renderHook(() => useLetterStore());
    await flush();
    await act(async () => {
      await result.current.cancel('l1');
    });
    expect(result.current.letters[0].status).toBe('cancelled');
  });

  it('markDelivered + markFailed mutate via the service helpers', async () => {
    vi.mocked(idb.get).mockResolvedValue([seed({ id: 'l-deliver' }), seed({ id: 'l-fail' })]);
    const { result } = renderHook(() => useLetterStore());
    await flush();
    await act(async () => {
      await result.current.markDelivered('l-deliver', 'entry-XYZ');
    });
    const delivered = result.current.letters.find((l) => l.id === 'l-deliver');
    expect(delivered?.status).toBe('delivered');
    expect(delivered?.replyEntryId).toBe('entry-XYZ');

    await act(async () => {
      await result.current.markFailed('l-fail');
    });
    const failed = result.current.letters.find((l) => l.id === 'l-fail');
    expect(failed?.attempts).toBe(1);
  });

  it('dueNow filters by known memoir + due time', async () => {
    // Anchor against real wall-clock time so the live `Date.now()`
    // inside `dueLetters` agrees with our deliverAt offsets.
    const realNow = Date.now();
    vi.mocked(idb.get).mockResolvedValue([
      seed({ id: 'due', deliverAt: realNow - hour }),
      seed({ id: 'future', deliverAt: realNow + hour }),
      seed({ id: 'orphan', deliverAt: realNow - hour, memoirId: 'memoir-DELETED' }),
    ]);
    const { result } = renderHook(() => useLetterStore());
    await flush();
    const out = result.current.dueNow(new Set(['memoir-X']));
    expect(out.map((l) => l.id)).toEqual(['due']);
  });

  it('clearForMemoir cascades a Memoir delete', async () => {
    vi.mocked(idb.get).mockResolvedValue([
      seed({ id: 'a', memoirId: 'memoir-X' }),
      seed({ id: 'b', memoirId: 'memoir-Y' }),
    ]);
    const { result } = renderHook(() => useLetterStore());
    await flush();
    await act(async () => {
      await result.current.clearForMemoir('memoir-X');
    });
    expect(result.current.letters).toHaveLength(1);
    expect(result.current.letters[0].memoirId).toBe('memoir-Y');
  });

  it('forMemoir returns scoped letters newest-first', async () => {
    vi.mocked(idb.get).mockResolvedValue([
      seed({ id: 'old', composedAt: NOW - 10 * hour }),
      seed({ id: 'new', composedAt: NOW - 1 * hour }),
      seed({ id: 'other', memoirId: 'memoir-Y' }),
    ]);
    const { result } = renderHook(() => useLetterStore());
    await flush();
    const out = result.current.forMemoir('memoir-X');
    expect(out.map((l) => l.id)).toEqual(['new', 'old']);
  });
});
