import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as idb from 'idb-keyval';
import { useMemoryStore } from './useMemoryStore';
import type { Memory } from '../types';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

const seedMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: `memory-${Math.random().toString(36).slice(2)}`,
  memoirId: 'memoir-test-1',
  category: 'fact',
  body: '用户周五要面试',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

describe('useMemoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(idb.get).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts loading + resolves to an empty list when nothing is stored', async () => {
    const { result } = renderHook(() => useMemoryStore());
    expect(result.current.loading).toBe(true);
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.memories).toEqual([]);
  });

  it('hydrates from IDB on mount and rejects malformed entries', async () => {
    vi.mocked(idb.get).mockResolvedValue([
      seedMemory({ id: 'memory-good' }),
      { id: 'bad-no-fields' },
      null,
    ]);
    const { result } = renderHook(() => useMemoryStore());
    await flush();
    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0].id).toBe('memory-good');
  });

  it('addMemory persists a clean body', async () => {
    const { result } = renderHook(() => useMemoryStore());
    await flush();

    let returned: Awaited<ReturnType<typeof result.current.addMemory>> | undefined;
    await act(async () => {
      returned = await result.current.addMemory({
        memoirId: 'memoir-test-1',
        category: 'fact',
        body: '用户上周得了 A 评级',
      });
    });

    expect(returned?.ok).toBe(true);
    expect(result.current.memories).toHaveLength(1);
    expect(idb.set).toHaveBeenCalledWith('vector_master_vault_memories', expect.any(Array));
  });

  it('addMemory surfaces the failure branch when body is unsafe', async () => {
    const { result } = renderHook(() => useMemoryStore());
    await flush();

    let returned: Awaited<ReturnType<typeof result.current.addMemory>> | undefined;
    await act(async () => {
      returned = await result.current.addMemory({
        memoirId: 'memoir-test-1',
        category: 'fact',
        body: '电话 138 0013 8000 联系',
      });
    });

    expect(returned?.ok).toBe(false);
    expect(result.current.memories).toHaveLength(0);
  });

  it('updateMemory mutates the in-memory list and persists', async () => {
    const seed = seedMemory({ id: 'memory-a', body: 'old body' });
    vi.mocked(idb.get).mockResolvedValue([seed]);
    const { result } = renderHook(() => useMemoryStore());
    await flush();

    await act(async () => {
      await result.current.updateMemory('memory-a', { body: 'new body' });
    });
    expect(result.current.memories[0].body).toBe('new body');
  });

  it('Phase 4 W4 — deleteMemory soft-deletes (recycle bin); hardDeleteMemory removes', async () => {
    const seed = seedMemory({ id: 'memory-a' });
    vi.mocked(idb.get).mockResolvedValue([seed]);
    const { result } = renderHook(() => useMemoryStore());
    await flush();

    await act(async () => {
      await result.current.deleteMemory('memory-a');
    });
    // Soft-deleted: still in the array but with deletedAt stamped
    // and excluded from recall + capacity counts.
    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0].deletedAt).toBeDefined();
    expect(result.current.recallForMemoir('memoir-test-1')).toEqual([]);
    expect(result.current.countForMemoir('memoir-test-1')).toBe(0);
    expect(result.current.listRecycleBin('memoir-test-1')).toHaveLength(1);

    // Restore brings it back.
    await act(async () => {
      await result.current.restoreMemory('memory-a');
    });
    expect(result.current.memories[0].deletedAt).toBeUndefined();
    expect(result.current.countForMemoir('memoir-test-1')).toBe(1);

    // Hard delete removes entirely.
    await act(async () => {
      await result.current.hardDeleteMemory('memory-a');
    });
    expect(result.current.memories).toEqual([]);
  });

  it('Phase 4 W4 — addMemory dedup-collapses near-duplicates instead of inserting', async () => {
    vi.mocked(idb.get).mockResolvedValue([
      seedMemory({
        id: 'm-target',
        body: '用户上周面试通过了',
        createdAt: 1_690_000_000_000,
        updatedAt: 1_690_000_000_000,
      }),
    ]);
    const { result } = renderHook(() => useMemoryStore());
    await flush();

    let outcome: Awaited<ReturnType<typeof result.current.addMemory>> | undefined;
    await act(async () => {
      outcome = await result.current.addMemory({
        memoirId: 'memoir-test-1',
        category: 'fact',
        body: '用户上周面试通过',
      });
    });
    expect(outcome?.kind).toBe('collapsed');
    // Bank still has exactly one memory; updatedAt was bumped.
    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0].updatedAt).toBeGreaterThan(1_690_000_000_000);
  });

  it('clearForMemoir wipes only the requested memoir', async () => {
    vi.mocked(idb.get).mockResolvedValue([
      seedMemory({ id: 'memory-a', memoirId: 'memoir-X' }),
      seedMemory({ id: 'memory-b', memoirId: 'memoir-Y' }),
    ]);
    const { result } = renderHook(() => useMemoryStore());
    await flush();

    await act(async () => {
      await result.current.clearForMemoir('memoir-X');
    });

    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0].memoirId).toBe('memoir-Y');
  });

  it('replaceMemories runs hydrateMemories on the input', async () => {
    const { result } = renderHook(() => useMemoryStore());
    await flush();
    await act(async () => {
      await result.current.replaceMemories([
        seedMemory({ id: 'memory-good' }),
        // Will be dropped by hydrateMemories.
        { id: 'bad' } as unknown as Memory,
      ]);
    });
    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0].id).toBe('memory-good');
  });

  it('recallForMemoir returns the top-N memories scoped to the memoir', async () => {
    const NOW = Date.now();
    vi.mocked(idb.get).mockResolvedValue([
      seedMemory({ id: 'memory-a', memoirId: 'memoir-X', updatedAt: NOW - 1000 }),
      seedMemory({
        id: 'memory-b',
        memoirId: 'memoir-X',
        updatedAt: NOW - 2_000_000,
      }),
      seedMemory({ id: 'memory-c', memoirId: 'memoir-Y', updatedAt: NOW }),
    ]);
    const { result } = renderHook(() => useMemoryStore());
    await flush();
    const recall = result.current.recallForMemoir('memoir-X');
    expect(recall.every((m) => m.memoirId === 'memoir-X')).toBe(true);
    expect(recall).toHaveLength(2);
    expect(recall[0].id).toBe('memory-a');
  });
});
