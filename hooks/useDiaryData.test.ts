import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDiaryData } from './useDiaryData';
import { useAppStore } from '../stores/appStore';
import { SecurityService } from '../services/securityService';
import * as idb from 'idb-keyval';
import { DiaryStorageKeys, getDiaryStorageKeys } from '../services/diaryStorage';
import { getSampleEntries } from '../services/sampleEntries';
import { readAvatarUnderstandings, writeAvatarUnderstanding } from '../services/avatarMemory';

// Mock idb-keyval
vi.mock('idb-keyval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('idb-keyval')>();
  return { ...actual, get: vi.fn(actual.get) };
});

describe('useDiaryData', () => {
  const userId = 'test-user';

  beforeEach(async () => {
    useAppStore.setState({ isUnlocked: false, masterPassword: null });
    vi.mocked(idb.get).mockReset();
    const actual = await vi.importActual<typeof import('idb-keyval')>('idb-keyval');
    vi.mocked(idb.get).mockImplementation(actual.get);
    await idb.clear();
    localStorage.clear();
  });

  it('should initialize with loading state', async () => {
    const { result } = renderHook(() => useDiaryData(userId));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('should load mock data if no storage data exists', async () => {
    const { result } = renderHook(() => useDiaryData(userId, 'zh'));

    // Wait for useEffect to finish
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loading).toBe(false);
    expect(result.current.entries.length).toBeGreaterThan(0);
  });

  it('should add an entry (and prune sample reflections — Phase 4 §4.a-1)', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

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
    expect(await idb.get(getDiaryStorageKeys(userId).entries)).toEqual(result.current.entries);
  });

  it('extracts pending avatar pattern candidates when records are saved', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addEntry({
        title: '演示前准备',
        content: '我提前整理了材料。',
        tags: ['事件:职业发展'],
      });
    });

    expect(readAvatarUnderstandings()).toEqual([]);

    await act(async () => {
      await result.current.addEntry({
        title: '出发前确认',
        content: '我提前确认了路线和时间。',
        tags: ['事件:职业发展'],
      });
    });

    expect(readAvatarUnderstandings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
          sourceEntryIds: expect.arrayContaining([
            result.current.entries[0].id,
            result.current.entries[1].id,
          ]),
        }),
      ]),
    );
  });

  it('keeps samples when the entry being added is itself a sample', async () => {
    // Defensive: a future "send sample to a friend" path or an
    // accidental import of a sample backup must not trigger the
    // prune. Adding an isSample entry leaves the existing samples
    // alone.
    const { result } = renderHook(() => useDiaryData(userId));
    await waitFor(() => expect(result.current.loading).toBe(false));
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

  it('persists an action and closes it when a result entry is recorded', async () => {
    const { result } = renderHook(() => useDiaryData(userId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let actionId = '';
    await act(async () => {
      const action = await result.current.addAction({
        title: '先确认会议目标',
        status: 'active',
        question: '如何避免讨论失焦？',
        principleId: 'principle-1',
      });
      actionId = action.id;
    });

    expect(result.current.actions[0]).toMatchObject({
      id: actionId,
      status: 'active',
      principleId: 'principle-1',
    });

    await act(async () => {
      await result.current.recordActionResult(actionId, 'result-entry');
    });

    expect(result.current.actions[0]).toMatchObject({
      status: 'completed',
      resultEntryId: 'result-entry',
    });
    expect(await idb.get(getDiaryStorageKeys(userId).actions)).toEqual(result.current.actions);
  });

  it('should update an entry', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

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

    await waitFor(() => expect(result.current.loading).toBe(false));

    const initialCount = result.current.entries.length;
    const entryToDelete = result.current.entries[0];

    await act(async () => {
      await result.current.deleteEntry(entryToDelete.id);
    });

    expect(result.current.entries.length).toBe(initialCount - 1);
  });

  it('should delete multiple entries in one update', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const idsToDelete = result.current.entries.slice(0, 2).map((entry) => entry.id);
    const initialCount = result.current.entries.length;

    await act(async () => {
      await result.current.deleteEntries(idsToDelete);
    });

    expect(result.current.entries).toHaveLength(initialCount - idsToDelete.length);
    expect(result.current.entries.some((entry) => idsToDelete.includes(entry.id))).toBe(false);
  });

  it('cascades record deletion to orphaned patterns, derived principles, and links', async () => {
    const { result } = renderHook(() => useDiaryData(userId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const sourceEntryId = result.current.entries[0].id;
    writeAvatarUnderstanding({
      id: 'pattern-from-entry',
      statement: '由该记录提取的模式',
      status: 'confirmed',
      sourceEntryIds: [sourceEntryId],
      createdAt: Date.now(),
      summaryKind: 'past-pattern',
    });

    await act(async () => {
      await result.current.addPrinciple(
        '由该记录萃取的原则',
        2026,
        true,
        [sourceEntryId],
        undefined,
        ['pattern-from-entry'],
      );
      await result.current.addPrinciple('手写原则', 2026);
    });

    await act(async () => {
      await result.current.deleteEntry(sourceEntryId);
    });

    expect(readAvatarUnderstandings()).toEqual([]);
    expect(result.current.principles.map((principle) => principle.text)).toEqual(['手写原则']);
    expect(result.current.patternPrincipleLinks).toEqual([]);
  });

  it('retains patterns, principles, and links when requested during record deletion', async () => {
    const { result } = renderHook(() => useDiaryData(userId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const sourceEntryId = result.current.entries[0].id;
    writeAvatarUnderstanding({
      id: 'retained-pattern',
      statement: '需要继续保留的模式',
      status: 'confirmed',
      sourceEntryIds: [sourceEntryId],
      createdAt: Date.now(),
      summaryKind: 'past-pattern',
    });

    await act(async () => {
      await result.current.addPrinciple(
        '需要继续保留的原则',
        2026,
        true,
        [sourceEntryId],
        undefined,
        ['retained-pattern'],
      );
    });

    await act(async () => {
      await result.current.deleteEntries([sourceEntryId], true);
    });

    expect(result.current.entries.some((entry) => entry.id === sourceEntryId)).toBe(false);
    expect(readAvatarUnderstandings()).toEqual([
      expect.objectContaining({
        id: 'retained-pattern',
        sourceEntryIds: [],
        retainedAfterSourceDeletion: true,
      }),
    ]);
    expect(result.current.principles).toEqual([
      expect.objectContaining({
        text: '需要继续保留的原则',
        derivedFromEntryIds: undefined,
        sourcePatternIds: ['retained-pattern'],
      }),
    ]);
    expect(result.current.patternPrincipleLinks).toEqual([
      expect.objectContaining({
        patternId: 'retained-pattern',
        principleId: result.current.principles[0].id,
      }),
    ]);
  });

  it('should wipe data', async () => {
    const keys = getDiaryStorageKeys(userId);
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.wipeData();
    });

    expect(result.current.entries.length).toBe(0);
    expect(result.current.principles.length).toBe(0);
    expect(await idb.get(keys.entries)).toEqual([]);
    expect(await idb.get(keys.patternPrincipleLinks)).toEqual([]);
  });

  it('should handle principles', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

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

  it('creates an independent pattern-principle link while keeping legacy sourcePatternIds', async () => {
    const keys = getDiaryStorageKeys(userId);
    localStorage.setItem(keys.initializedFlag, 'true');
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addPrinciple('先完成一个最小步骤', 2026, true, [], undefined, [
        'pattern-1',
      ]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.principles[0].sourcePatternIds).toEqual(['pattern-1']);
    expect(result.current.patternPrincipleLinks[0]).toMatchObject({
      patternId: 'pattern-1',
      principleId: result.current.principles[0].id,
      relation: 'adjust',
      status: 'confirmed',
      createdBy: 'user',
    });
    expect(await idb.get(keys.patternPrincipleLinks)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          patternId: 'pattern-1',
          principleId: result.current.principles[0].id,
        }),
      ]),
    );
  });

  it('validates a pattern-principle link after a helpful action result', async () => {
    const keys = getDiaryStorageKeys(userId);
    localStorage.setItem(keys.initializedFlag, 'true');
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPrinciple('先完成一个最小步骤', 2026, true, [], undefined, [
        'pattern-1',
      ]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const principle = result.current.principles[0];
    await act(async () => {
      await result.current.updatePrinciple({
        ...principle,
        helpfulCount: 1,
        recallCount: 1,
        lastFeedbackAt: 100,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.patternPrincipleLinks[0]).toMatchObject({
      principleId: principle.id,
      patternId: 'pattern-1',
      status: 'validated',
      updatedAt: 100,
    });
  });

  it('hydrates legacy sourcePatternIds as effective pattern-principle links', async () => {
    const keys = getDiaryStorageKeys(userId);
    localStorage.setItem(keys.initializedFlag, 'true');
    await idb.set(keys.entries, []);
    await idb.set(keys.principles, [
      {
        id: 'principle-1',
        text: '先完成一个最小步骤',
        year: 2026,
        createdAt: 1,
        showOnHome: true,
        sourcePatternIds: ['pattern-1'],
      },
    ]);

    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.patternPrincipleLinks).toHaveLength(1);
    expect(result.current.patternPrincipleLinks[0]).toMatchObject({
      patternId: 'pattern-1',
      principleId: 'principle-1',
      relation: 'adjust',
      status: 'confirmed',
    });
  });

  it('keeps legacy knowledge without interpreting missing sources as consent to delete', async () => {
    const keys = getDiaryStorageKeys(userId);
    localStorage.setItem(keys.initializedFlag, 'true');
    writeAvatarUnderstanding({
      id: 'legacy-pattern',
      statement: '已失去来源的模式',
      status: 'confirmed',
      sourceEntryIds: ['deleted-entry'],
      createdAt: 1,
    });
    await idb.set(keys.entries, []);
    await idb.set(keys.principles, [
      {
        id: 'legacy-principle',
        text: '已失去来源的原则',
        year: 2026,
        createdAt: 1,
        showOnHome: true,
        derivedFromEntryIds: ['deleted-entry'],
        sourcePatternIds: ['legacy-pattern'],
      },
    ]);

    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(readAvatarUnderstandings()).toEqual([expect.objectContaining({ id: 'legacy-pattern' })]);
    expect(result.current.principles).toEqual([
      expect.objectContaining({ id: 'legacy-principle' }),
    ]);
    expect(result.current.patternPrincipleLinks).toHaveLength(1);
  });

  it('should handle containers', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addContainer('New Category');
    });

    expect(result.current.containers.length).toBe(1);
    expect(result.current.containers[0].name).toBe('New Category');

    const c = result.current.containers[0];
    await act(async () => {
      await result.current.deleteContainer(c.id);
    });
    expect(result.current.containers.length).toBe(0);
  });

  it('should handle passwords', async () => {
    const password = 'Test-password1!';
    const hash = await SecurityService.hashPassword(password, 'salt');
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.savePasswordHash(hash);
      await result.current.savePasswordSalt('salt');
    });

    expect(result.current.passwordHash).toBe(hash);
    expect(result.current.passwordSalt).toBe('salt');
    useAppStore.setState({ isUnlocked: true, masterPassword: password });

    await act(async () => {
      await result.current.clearPasswordHash();
    });

    expect(result.current.passwordHash).toBe(null);
  });

  it('should handle archive/unarchive', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

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
    vi.mocked(idb.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstGet = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ language }: { language: 'zh' | 'en' }) => useDiaryData(userId, language),
      { initialProps: { language: 'zh' as const } },
    );

    await waitFor(() => expect(resolveFirstGet).not.toBeNull());
    rerender({ language: 'en' as const });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Empty IDB now seeds the two sample reflections from
    // `services/sampleEntries.ts` instead of the old MOCK_ENTRIES.
    // The first entry is the newest sample in the descending UI.
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

    await waitFor(() => expect(result.current.loading).toBe(false));

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

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.wipeData();
    });

    for (const key of [
      keys.selectedStars,
      keys.materials,
      keys.actions,
      keys.semanticEmbeddings,
      keys.patternPrincipleLinks,
    ]) {
      expect(await idb.get(key)).toEqual([]);
    }
    expect(await idb.get(DiaryStorageKeys.initializedFlag)).toBe(true);
  });

  it('imports backup entries by merging with existing ones', async () => {
    const { result } = renderHook(() => useDiaryData(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

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

    await waitFor(() => expect(result.current.loading).toBe(false));

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

    await waitFor(() => expect(result.current.loading).toBe(false));

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
