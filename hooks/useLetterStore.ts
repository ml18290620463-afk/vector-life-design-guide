import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import type { PendingLetter } from '../types';
import {
  cancelLetter as cancelInList,
  clearLettersForMemoir as clearForMemoirList,
  dueLetters,
  hydrateLetters,
  listLettersForMemoir as listForMemoirList,
  markAttemptFailed as markFailedInList,
  markDelivered as markDeliveredInList,
  mintLetter,
  recentlyDeliveredLetters as recentDeliveredList,
  type MintLetterResult,
} from '../services/letterService';
import { DiaryStorageKeys, mirrorDiaryValue, readDiaryJson } from '../services/diaryStorage';

/**
 * Phase 4.5 §A — `useLetterStore`
 *
 * IDB persistence + reactive surface for **写信模式 (Memoir
 * delayed letters)**. Same architectural posture as
 * [`useMemoryStore`](./useMemoryStore.ts):
 *
 *   - **Primary**: IndexedDB via `idb-keyval`.
 *   - **Mirror**: localStorage via `mirrorDiaryValue`.
 *   - Schema validation via `letterService.hydrateLetters` on
 *     every read.
 *
 * The hook exposes:
 *   - `add` to compose a new letter (returns the mint result so
 *     the UI can surface validation errors)
 *   - `cancel` for the user-initiated lifecycle transition
 *   - `markDelivered` / `markFailed` consumed by the
 *     `letterDelivery` sweep
 *   - selectors: `dueNow`, `recentlyDelivered`, `forMemoir`
 *   - `clearForMemoir` for the memoir-cascade-delete path
 *
 * Why a separate hook (vs folding into useMemoryStore):
 *   - Letters and memories are independent IDB blobs. Letters
 *     mutate on a much slower cadence (compose / cancel / sweep)
 *     so coupling them would force a re-render of memory
 *     consumers on every letter change.
 *   - Letter sweep timing is parent-driven (Dashboard mount);
 *     `useMemoryStore`'s sweep is purely-on-mount. Keeping the
 *     hooks separate keeps each effect's deps tight.
 */
export interface UseLetterStoreResult {
  letters: PendingLetter[];
  loading: boolean;
  /** Mint + persist a new letter. Returns the result so callers
   *  can surface validation errors (empty body / missing memoir
   *  / etc) inline. */
  add: (input: { memoirId: string; body: string; delayMs: number }) => Promise<MintLetterResult>;
  /** User-initiated cancel for a pending letter. No-op if status
   *  is not `'pending'`. */
  cancel: (id: string) => Promise<void>;
  /** Delivery sweep: writes `replyEntryId` + flips status. */
  markDelivered: (id: string, replyEntryId: string) => Promise<void>;
  /** Delivery sweep: increments attempts; flips to `'failed'`
   *  past the cap. */
  markFailed: (id: string) => Promise<void>;
  /** Cascade — used when a Memoir persona is deleted. */
  clearForMemoir: (memoirId: string) => Promise<void>;
  /** Bulk replace — reserved for a future v4 backup importer. */
  replaceLetters: (next: PendingLetter[]) => Promise<void>;
  /** Read-only selector for the delivery sweep. Stable callback. */
  dueNow: (knownMemoirIds: ReadonlySet<string>) => PendingLetter[];
  /** Letters delivered within the last 24h, surface for the
   *  `LetterArrivedCard`. */
  recentlyDelivered: () => PendingLetter[];
  /** Letters scoped to one Memoir, newest-composed-first. */
  forMemoir: (memoirId: string) => PendingLetter[];
}

const STORAGE_KEY = DiaryStorageKeys.pendingLetters;

const readPersistedLetters = async (): Promise<PendingLetter[]> => {
  // `idb-keyval.get()` synchronously dereferences `indexedDB`
  // inside `getDB()`, so the chain throws **before** the
  // `.catch()` handler is wired in environments without IDB
  // (happy-dom in tests). Wrap in try/catch so the rejection
  // never escapes to the unhandled-rejection reporter.
  let idbValue: unknown;
  try {
    idbValue = await get(STORAGE_KEY).catch(() => undefined);
  } catch {
    idbValue = undefined;
  }
  if (Array.isArray(idbValue)) return hydrateLetters(idbValue);
  const mirror = readDiaryJson<unknown>(STORAGE_KEY);
  if (Array.isArray(mirror)) return hydrateLetters(mirror);
  return [];
};

export const useLetterStore = (): UseLetterStoreResult => {
  const [letters, setLetters] = useState<PendingLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const activeLoadIdRef = useRef(0);
  const lettersRef = useRef<PendingLetter[]>([]);
  lettersRef.current = letters;

  useEffect(() => {
    const loadId = ++activeLoadIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || activeLoadIdRef.current !== loadId;
    (async () => {
      try {
        const persisted = await readPersistedLetters();
        if (isStale()) return;
        setLetters(persisted);
      } finally {
        if (!isStale()) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: PendingLetter[]) => {
    setLetters(next);
    try {
      await set(STORAGE_KEY, next).catch(() => {});
      mirrorDiaryValue(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('useLetterStore: persist failed', err);
    }
  }, []);

  const add = useCallback<UseLetterStoreResult['add']>(
    async (input) => {
      const result = mintLetter(input);
      if (!result.ok) return result;
      await persist([...lettersRef.current, result.letter]);
      return result;
    },
    [persist],
  );

  const cancel = useCallback<UseLetterStoreResult['cancel']>(
    async (id) => {
      const next = cancelInList(lettersRef.current, id);
      await persist(next);
    },
    [persist],
  );

  const markDelivered = useCallback<UseLetterStoreResult['markDelivered']>(
    async (id, replyEntryId) => {
      const next = markDeliveredInList(lettersRef.current, id, replyEntryId);
      await persist(next);
    },
    [persist],
  );

  const markFailed = useCallback<UseLetterStoreResult['markFailed']>(
    async (id) => {
      const next = markFailedInList(lettersRef.current, id);
      await persist(next);
    },
    [persist],
  );

  const clearForMemoir = useCallback<UseLetterStoreResult['clearForMemoir']>(
    async (memoirId) => {
      const next = clearForMemoirList(lettersRef.current, memoirId);
      await persist(next);
    },
    [persist],
  );

  const replaceLetters = useCallback<UseLetterStoreResult['replaceLetters']>(
    async (next) => {
      await persist(hydrateLetters(next));
    },
    [persist],
  );

  const dueNow = useCallback<UseLetterStoreResult['dueNow']>(
    (knownMemoirIds) => dueLetters(lettersRef.current, knownMemoirIds),
    [],
  );

  const recentlyDelivered = useCallback<UseLetterStoreResult['recentlyDelivered']>(
    () => recentDeliveredList(lettersRef.current),
    [],
  );

  const forMemoir = useCallback<UseLetterStoreResult['forMemoir']>(
    (memoirId) => listForMemoirList(lettersRef.current, memoirId),
    [],
  );

  return useMemo(
    () => ({
      letters,
      loading,
      add,
      cancel,
      markDelivered,
      markFailed,
      clearForMemoir,
      replaceLetters,
      dueNow,
      recentlyDelivered,
      forMemoir,
    }),
    [
      letters,
      loading,
      add,
      cancel,
      markDelivered,
      markFailed,
      clearForMemoir,
      replaceLetters,
      dueNow,
      recentlyDelivered,
      forMemoir,
    ],
  );
};
