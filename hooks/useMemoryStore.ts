import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import type { Memory, MemoryCategory } from '../types';
import {
  clearMemoirMemories as clearForMemoir,
  countLiveMemoriesForMemoir,
  deleteMemory as removeMemory,
  evictLowestSalience,
  hydrateMemories,
  listSoftDeletedForMemoir,
  mintMemory,
  purgeExpiredSoftDeletes,
  restoreSoftDeletedMemory as restoreSoftDeleted,
  selectMemoriesForRecall,
  softDeleteMemory as softDelete,
  updateMemory as patchMemory,
  type MintMemoryResult,
} from '../services/memoryService';
import { applyCollapse, dedupVerdict } from '../services/memoryDedup';
import { getTierLimits } from '../services/quotaService';
import { DiaryStorageKeys, mirrorDiaryValue, readDiaryJson } from '../services/diaryStorage';

/**
 * Phase 4 Week 3 (§5.1.B) — `useMemoryStore`
 *
 * Mirrors the architectural shape of [`useCustomPersonas`](
 * ../hooks/useCustomPersonas.ts):
 *
 *   - **Primary** persistence in IndexedDB via `idb-keyval`.
 *   - **Mirror** to localStorage via `mirrorDiaryValue` (skipped
 *     above the 100 KB threshold).
 *   - Schema validation via `memoryService.hydrateMemories` on
 *     every read; corrupted blobs degrade gracefully to an empty
 *     list rather than crashing the app.
 *
 * Why a separate hook (rather than inlining into `useDiaryData`):
 *   - Memory CRUD has 5 actions × ~10 LOC each + a load effect +
 *     a recall selector — that alone would push `useDiaryData`
 *     well past the ROADMAP 600-LOC ceiling.
 *   - `useMemoirChat` (Day 6) needs `selectMemoriesForRecall`
 *     bound to the live memory list. Putting it on this hook
 *     keeps the dependency surface tight (Memoir chat depends on
 *     `useMemoryStore`, not on the entire `useDiaryData` blast
 *     radius).
 *   - The hook is independently testable — Vitest can mount it in
 *     isolation without booting the diary pipeline.
 *
 * Privacy posture: the IDB blob is unencrypted-at-rest the same way
 * `customPersonas` is. The Vault password protects access to the
 * page, not the IDB store. (Whole-store encryption is a Phase 5
 * roadmap item — see [`docs/security/argon2-eval.md`](
 * ../docs/security/argon2-eval.md).) The memory **bodies** themselves
 * pass through `detectUnsafeMemoryBody` before persistence so that
 * even an IDB exfiltration cannot leak third-party PII the user
 * never intended to store.
 */
/** Phase 4 W4 — outcome of a dedup-aware addMemory call. The
 *  Memoir memory harvest hook reads `kind` to count what
 *  contributed to the user-visible "N new memories" count. */
export type AddMemoryOutcome =
  | (MintMemoryResult & { kind: 'minted' })
  | { ok: true; kind: 'collapsed'; matchId: string }
  | { ok: false; kind: 'rejected'; reason: string };

export interface UseMemoryStoreResult {
  memories: Memory[];
  /** True until the first IDB read completes. Mirrors `useDiaryData.loading`. */
  loading: boolean;
  /**
   * Mint + persist a memory. Phase 4 W4 — now runs the candidate
   * through dedup (`memoryDedup.dedupVerdict`) before insert:
   *   - similarity ≥ 0.55 → skip insert, bump matched memory's
   *     `updatedAt` (counts as reinforcement → decay scorer
   *     boosts it).
   *   - similarity ∈ [0.30, 0.55) → insert, stamp `relatedTo`.
   *   - similarity < 0.30 → insert clean.
   *
   * Also enforces the per-Memoir capacity ceiling
   * (`quotaService.getTierLimits().memoriesPerMemoir`): when the
   * Memoir is at-or-above its cap, the lowest-salience non-
   * milestone memory is evicted before the insert.
   *
   * Returns an `AddMemoryOutcome` so the caller (the harvester)
   * can distinguish minted from collapsed (both `ok: true`) for
   * UX counters / telemetry.
   */
  addMemory: (input: {
    memoirId: string;
    category: MemoryCategory;
    body: string;
    sourceRef?: string;
  }) => Promise<AddMemoryOutcome>;
  /** Patch an existing memory (Day 5 management panel). */
  updateMemory: (id: string, patch: { body?: string; category?: MemoryCategory }) => Promise<void>;
  /**
   * Phase 4 W4 — *soft* delete by default. Stamps `deletedAt` so
   * the memory disappears from recall + is excluded from the
   * capacity count, but remains restorable for 30 days via the
   * recycle bin.
   */
  deleteMemory: (id: string) => Promise<void>;
  /** Phase 4 W4 — hard delete (used by the recycle bin's
   *  "delete forever" action). */
  hardDeleteMemory: (id: string) => Promise<void>;
  /** Phase 4 W4 — undo a soft delete. */
  restoreMemory: (id: string) => Promise<void>;
  /** Phase 4 W4 — read-only accessor for the recycle bin tab. */
  listRecycleBin: (memoirId: string) => Memory[];
  /** Wipe every memory belonging to one Memoir persona. Used both
   *  by the user's "清空记忆" CTA and as a cascade when the Memoir
   *  persona itself is deleted. */
  clearForMemoir: (memoirId: string) => Promise<void>;
  /** Bulk replace — used by the v3-backup importer (Day 7). */
  replaceMemories: (next: Memory[]) => Promise<void>;
  /** Read-only selector for Memoir chat recall (Day 6). Memoised
   *  per-memoir so `useMemoirChat` can call it inside a `useMemo`
   *  without re-running on every parent render. */
  recallForMemoir: (memoirId: string, query?: string, limit?: number) => Memory[];
  /** Phase 4 W4 — live count of non-deleted memories for one Memoir.
   *  Read by the management panel header to render a "N / cap" chip. */
  countForMemoir: (memoirId: string) => number;
}

const STORAGE_KEY = DiaryStorageKeys.memories;

const readPersistedMemories = async (): Promise<Memory[]> => {
  // `idb-keyval.get()` can throw synchronously inside `getDB()`
  // when `indexedDB` is undefined (happy-dom test env). Wrap so
  // the rejection never escapes to the unhandled-rejection reporter.
  let idbValue: unknown;
  try {
    idbValue = await get(STORAGE_KEY).catch(() => undefined);
  } catch {
    idbValue = undefined;
  }
  if (Array.isArray(idbValue)) return hydrateMemories(idbValue);

  const mirror = readDiaryJson<unknown>(STORAGE_KEY);
  if (Array.isArray(mirror)) return hydrateMemories(mirror);

  return [];
};

export const useMemoryStore = (): UseMemoryStoreResult => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const activeLoadIdRef = useRef(0);
  // Latest snapshot ref so `recallForMemoir` (a stable callback)
  // never reads stale state.
  const memoriesRef = useRef<Memory[]>([]);
  memoriesRef.current = memories;

  useEffect(() => {
    const loadId = ++activeLoadIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || activeLoadIdRef.current !== loadId;

    (async () => {
      try {
        const persisted = await readPersistedMemories();
        if (isStale()) return;
        // Phase 4 W4 §2.5 — sweep expired soft-deletes on every
        // mount. The pure helper is a no-op when nothing has
        // expired, so this is cheap to run unconditionally.
        const swept = purgeExpiredSoftDeletes(persisted);
        setMemories(swept);
        // Persist the sweep result so the next mount sees the
        // already-purged list (otherwise expired items keep
        // hanging around forever in IDB).
        if (swept.length !== persisted.length) {
          try {
            await set(STORAGE_KEY, swept).catch(() => {});
            mirrorDiaryValue(STORAGE_KEY, JSON.stringify(swept));
          } catch (err) {
            console.warn('useMemoryStore: sweep persist failed', err);
          }
        }
      } finally {
        if (!isStale()) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: Memory[]) => {
    setMemories(next);
    try {
      await set(STORAGE_KEY, next).catch(() => {});
      mirrorDiaryValue(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('useMemoryStore: persist failed', err);
    }
  }, []);

  const addMemory = useCallback<UseMemoryStoreResult['addMemory']>(
    async (input) => {
      // 1. Mint candidate (runs the Week 3 PII safety guard).
      const minted = mintMemory(input);
      if (minted.ok === false) {
        return { ok: false, kind: 'rejected', reason: minted.reason };
      }

      const current = memoriesRef.current;

      // 2. Dedup against the existing same-Memoir, same-category
      //    memories. Three outcomes — see `memoryDedup.ts` for the
      //    threshold reasoning.
      const verdict = dedupVerdict(
        {
          memoirId: input.memoirId,
          category: input.category,
          body: minted.memory.body,
        },
        current,
      );

      if (verdict.kind === 'collapse') {
        // Skip insert; bump the matched memory's updatedAt so the
        // decay scorer treats it as reinforced.
        await persist(applyCollapse(current, verdict.matchId, Date.now()));
        return { ok: true, kind: 'collapsed', matchId: verdict.matchId };
      }

      // 3. Capacity ceiling — evict before insert when at-or-above
      //    cap. milestone memories are exempt from eviction.
      const cap = getTierLimits().memoriesPerMemoir;
      const after = evictLowestSalience(current, input.memoirId, cap);

      // 4. Build the candidate (with `relatedTo` if applicable),
      //    insert, persist.
      const toInsert: Memory =
        verdict.kind === 'insert-related'
          ? { ...minted.memory, relatedTo: verdict.matchId }
          : minted.memory;
      await persist([...after, toInsert]);
      return { ...minted, kind: 'minted' };
    },
    [persist],
  );

  const updateMemoryById = useCallback<UseMemoryStoreResult['updateMemory']>(
    async (id, patch) => {
      const next = patchMemory(memoriesRef.current, id, patch);
      if (next === memoriesRef.current) return;
      await persist(next);
    },
    [persist],
  );

  // Phase 4 W4 — soft delete by default. The recycle-bin tab in
  // the management panel surfaces undo for 30 days.
  const deleteMemoryById = useCallback<UseMemoryStoreResult['deleteMemory']>(
    async (id) => {
      const next = softDelete(memoriesRef.current, id);
      if (next === memoriesRef.current) return;
      await persist(next);
    },
    [persist],
  );

  const hardDeleteMemoryById = useCallback<UseMemoryStoreResult['hardDeleteMemory']>(
    async (id) => {
      await persist(removeMemory(memoriesRef.current, id));
    },
    [persist],
  );

  const restoreMemoryById = useCallback<UseMemoryStoreResult['restoreMemory']>(
    async (id) => {
      const next = restoreSoftDeleted(memoriesRef.current, id);
      if (next === memoriesRef.current) return;
      await persist(next);
    },
    [persist],
  );

  const clearForMemoirId = useCallback<UseMemoryStoreResult['clearForMemoir']>(
    async (memoirId) => {
      await persist(clearForMemoir(memoriesRef.current, memoirId));
    },
    [persist],
  );

  const replaceMemories = useCallback<UseMemoryStoreResult['replaceMemories']>(
    async (next) => {
      await persist(hydrateMemories(next));
    },
    [persist],
  );

  // `recallForMemoir` is a stable callback that always reads the live
  // ref — this lets `useMemoirChat` call it inside a memoised
  // selector without rebinding the dep on every memory CRUD.
  const recallForMemoir = useCallback<UseMemoryStoreResult['recallForMemoir']>(
    (memoirId, query, limit) =>
      selectMemoriesForRecall(memoriesRef.current, { memoirId, query, limit }),
    [],
  );

  const listRecycleBin = useCallback<UseMemoryStoreResult['listRecycleBin']>(
    (memoirId) => listSoftDeletedForMemoir(memoriesRef.current, memoirId),
    [],
  );

  const countForMemoir = useCallback<UseMemoryStoreResult['countForMemoir']>(
    (memoirId) => countLiveMemoriesForMemoir(memoriesRef.current, memoirId),
    [],
  );

  return useMemo(
    () => ({
      memories,
      loading,
      addMemory,
      updateMemory: updateMemoryById,
      deleteMemory: deleteMemoryById,
      hardDeleteMemory: hardDeleteMemoryById,
      restoreMemory: restoreMemoryById,
      clearForMemoir: clearForMemoirId,
      replaceMemories,
      recallForMemoir,
      listRecycleBin,
      countForMemoir,
    }),
    [
      memories,
      loading,
      addMemory,
      updateMemoryById,
      deleteMemoryById,
      hardDeleteMemoryById,
      restoreMemoryById,
      clearForMemoirId,
      replaceMemories,
      recallForMemoir,
      listRecycleBin,
      countForMemoir,
    ],
  );
};
