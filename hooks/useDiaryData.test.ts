import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiaryData } from './useDiaryData';
import * as idb from 'idb-keyval';
import { DiaryStorageKeys, getDiaryStorageKeys } from '../services/diaryStorage';
import { getSampleEntries } from '../services/sampleEntries';

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

describe('useDiaryData', () => {
  const userId = 'test-user';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(idb.get).mockResolvedValue(undefined);
  });

  it('should initialize with loading state', async () => {
    const { result } = renderHook(() => useDiaryData(userId));
    expect(result.current.loading).toBe(true);
  });

  it('should load mock data if no storage data exists', async () => {
    const { result } = renderHook(() => useDiaryData(userId, 'zh'));

    // Wait for useEffect to finish
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.entries.length).toBeGreaterThan(0);
  });

  it('should add an entry (and prune sample reflections — Phase 4 §4.a-1)', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Before the user's first real write, the seeded samples are
    // present. They all carry isSample=true.
    expect(result.current.entries.every((e) => e.isSample)).toBe(true);

    await act(async () => {
      await result.current.addEntry({
        title: 'New Entry',
        content: 'Content',
        tags: ['test'],
      });
    });

    // Lifecycle option C (per docs/product-vision-2026Q2.md §5.1.B
    // and services/sampleEntries.ts): writing the FIRST real entry
    // prunes every sample. So after addEntry the list contains
    // exactly the new entry — not new+samples.
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].title).toBe('New Entry');
    // isSample is optional; undefined / false both mean "real entry".
    expect(result.current.entries[0].isSample).toBeFalsy();
    expect(idb.set).toHaveBeenCalled();
  });

  it('keeps samples when the entry being added is itself a sample', async () => {
    // Defensive: a future "send sample to a friend" path or an
    // accidental import of a sample backup must not trigger the
    // prune. Adding an isSample entry leaves the existing samples
    // alone.
    const { result } = renderHook(() => useDiaryData(userId));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const initialCount = result.current.entries.length;

    await act(async () => {
      await result.current.addEntry({
        title: 'Another sample',
        content: 'sample content',
        tags: ['sample'],
        isSample: true,
      });
    });

    expect(result.current.entries.length).toBe(initialCount + 1);
    expect(result.current.entries.every((e) => e.isSample)).toBe(true);
  });

  it('should update an entry', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const entryToUpdate = result.current.entries[0];
    const updatedTitle = 'Updated Title';

    await act(async () => {
      await result.current.updateEntry({
        ...entryToUpdate,
        title: updatedTitle,
      });
    });

    expect(result.current.entries[0].title).toBe(updatedTitle);
  });

  it('should delete an entry', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const initialCount = result.current.entries.length;
    const entryToDelete = result.current.entries[0];

    await act(async () => {
      await result.current.deleteEntry(entryToDelete.id);
    });

    expect(result.current.entries.length).toBe(initialCount - 1);
  });

  it('should wipe data', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.wipeData();
    });

    expect(result.current.entries.length).toBe(0);
    expect(result.current.principles.length).toBe(0);
    expect(idb.del).toHaveBeenCalled();
  });

  it('should handle principles', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.addPrinciple('Test Principle', 2024);
    });

    expect(result.current.principles.length).toBe(1);
    expect(result.current.principles[0].text).toBe('Test Principle');

    const p = result.current.principles[0];
    await act(async () => {
      await result.current.deletePrinciple(p.id);
    });
    expect(result.current.principles.length).toBe(0);
  });

  it('should handle containers', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      result.current.addContainer('New Category');
    });

    expect(result.current.containers.length).toBe(1);
    expect(result.current.containers[0].name).toBe('New Category');

    const c = result.current.containers[0];
    await act(async () => {
      result.current.deleteContainer(c.id);
    });
    expect(result.current.containers.length).toBe(0);
  });

  it('should handle passwords', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current.savePasswordHash('hash');
      await result.current.savePasswordSalt('salt');
    });

    expect(result.current.passwordHash).toBe('hash');
    expect(result.current.passwordSalt).toBe('salt');

    await act(async () => {
      await result.current.clearPasswordHash();
    });

    expect(result.current.passwordHash).toBe(null);
  });

  it('should handle archive/unarchive', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const entryId = result.current.entries[0].id;

    await act(async () => {
      await result.current.archiveEntry(entryId);
    });
    expect(result.current.entries.find((e) => e.id === entryId)?.isArchived).toBe(true);

    await act(async () => {
      await result.current.unarchiveEntry(entryId);
    });
    expect(result.current.entries.find((e) => e.id === entryId)?.isArchived).toBe(false);
  });

  it('should ignore stale async loads after language changes', async () => {
    let resolveFirstGet: ((value: undefined) => void) | null = null;
    let callCount = 0;

    vi.mocked(idb.get).mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveFirstGet = resolve;
        });
      }
      return Promise.resolve(undefined);
    });

    const { result, rerender } = renderHook(
      ({ language }: { language: 'zh' | 'en' }) => useDiaryData(userId, language),
      { initialProps: { language: 'zh' as const } },
    );

    rerender({ language: 'en' as const });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Phase 4 §4.a-1: empty IDB now seeds the two sample reflections
    // from `services/sampleEntries.ts` instead of the old MOCK_ENTRIES.
    // The first entry (memoir teaser) sits at index 0 since
    // `getSampleEntries` orders [memoir, daily] for the descending UI.
    const expectedFirstTitle = getSampleEntries('en')[0].title;
    expect(result.current.entries[0]?.title).toBe(expectedFirstTitle);

    await act(async () => {
      resolveFirstGet?.(undefined);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.entries[0]?.title).toBe(expectedFirstTitle);
  });

  it('should hydrate persisted vault metadata from storage', async () => {
    const keys = getDiaryStorageKeys(userId);
    localStorage.setItem(keys.passwordHash, 'persisted-hash');
    localStorage.setItem(keys.passwordSalt, 'persisted-salt');
    localStorage.setItem(keys.guidingStars, JSON.stringify(['Marcus Aurelius']));
    localStorage.setItem(keys.selectedStars, JSON.stringify(['Marcus Aurelius']));
    localStorage.setItem(
      keys.materials,
      JSON.stringify([{ type: 'image', name: 'img.png', data: 'data:' }]),
    );
    localStorage.setItem(
      keys.containers,
      JSON.stringify([{ id: 'c1', name: 'Work', createdAt: 1 }]),
    );

    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.passwordHash).toBe('persisted-hash');
    expect(result.current.passwordSalt).toBe('persisted-salt');
    expect(result.current.guidingStars).toEqual(['Marcus Aurelius']);
    expect(result.current.selectedStars).toEqual(['Marcus Aurelius']);
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.containers).toEqual([{ id: 'c1', name: 'Work', createdAt: 1 }]);
  });

  it('should wipe selected stars and materials storage keys', async () => {
    const keys = getDiaryStorageKeys(userId);
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await result.current.wipeData();
    });

    expect(idb.del).toHaveBeenCalledWith(keys.selectedStars);
    expect(idb.del).toHaveBeenCalledWith(keys.materials);
    expect(localStorage.getItem(DiaryStorageKeys.initializedFlag)).toBeNull();
  });

  it('imports backup entries by merging with existing ones', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const initialCount = result.current.entries.length;
    let summary: { mode: 'merge' | 'replace'; importedCount: number; totalAfter: number } | null =
      null;

    await act(async () => {
      summary = await result.current.importBackup(
        [
          {
            id: 'imported-1',
            title: 'Imported',
            content: 'from backup',
            createdAt: 5,
            tags: [],
            isLocked: false,
          },
        ],
        'merge',
      );
    });

    expect(summary).toMatchObject({ mode: 'merge', importedCount: 1 });
    expect(result.current.entries.some((e) => e.id === 'imported-1')).toBe(true);
    expect(result.current.entries.length).toBe(initialCount + 1);
  });

  it('records a successful scan summary', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    let summary: Awaited<ReturnType<typeof result.current.triggerScan>> | null = null;
    await act(async () => {
      summary = await result.current.triggerScan();
    });

    expect(summary?.status).toBe('success');
    expect(result.current.lastScanSummary?.status).toBe('success');
    expect(result.current.isScanning).toBe(false);
  });

  it('addMaterial preserves rapid successive entries (no stale closure)', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const initial = result.current.materials.length;

    // Two synchronous calls in the same render frame would have lost the
    // first one in the previous (closure-based) implementation because both
    // invocations would read the same `materials` snapshot.
    await act(async () => {
      await Promise.all([
        result.current.addMaterial({
          type: 'image',
          name: 'a.png',
          mimeType: 'image/png',
          data: 'data:image/png;base64,a',
        }),
        result.current.addMaterial({
          type: 'image',
          name: 'b.png',
          mimeType: 'image/png',
          data: 'data:image/png;base64,b',
        }),
      ]);
    });

    expect(result.current.materials.length).toBe(initial + 2);
    const names = result.current.materials.map((m) => m.name);
    expect(names).toContain('a.png');
    expect(names).toContain('b.png');
  });
});
