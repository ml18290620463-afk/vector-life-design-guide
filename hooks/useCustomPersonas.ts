import { useCallback, useEffect, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import type { CustomPersona } from '../types';
import {
  deletePersona as removePersona,
  hydratePersonas,
  updatePersona as patchPersona,
} from '../services/personaService';
import { mirrorDiaryValue, readDiaryJson } from '../services/diaryStorage';

/**
 * Phase 4 Week 2 (§5.1.A) — `useCustomPersonas`
 *
 * Extracts the **自定义启明星** persistence layer out of
 * `hooks/useDiaryData.ts` so that file stays under the ROADMAP
 * 600-line ceiling (working agreement: hooks > 350 LOC must extract
 * sub-hooks). Same architectural pattern as `useBackupReminder` /
 * `useDashboardVault` from Phase 2.
 *
 * Storage path:
 *   - **Primary**: IndexedDB via `idb-keyval` keyed by
 *     `DiaryStorageKeys.customPersonas`. Survives across sessions
 *     and tabs without occupying localStorage budget.
 *   - **Mirror**: localStorage (skipped when payload > 100 KB) for
 *     dev-tool inspection and recovery if IDB is wiped.
 *   - **Backup**: serialised into the v2 `vector-vault-backup` JSON
 *     payload by `useBackupExport` (Day 6 work).
 *
 * Schema validation:
 *   - On read, every entry runs through `personaService.hydratePersonas`
 *     so a corrupted IDB blob can never poison the runtime list.
 *   - On write, the array is JSON-stringified verbatim — `mintPersona`
 *     / `updatePersona` already sanitise.
 *
 * Why a dedicated hook (not just a useState in useDiaryData)?
 *   - Persona CRUD has 4 actions × ~10 LOC each = ~40 LOC, plus a
 *     load effect. That alone would push useDiaryData to ~740 LOC.
 *   - The hook is also independently testable: tests can mount it in
 *     isolation without booting the full diary pipeline.
 */
export interface UseCustomPersonasResult {
  customPersonas: CustomPersona[];
  /** True until the first IDB read completes. Mirrors `useDiaryData.loading`. */
  loading: boolean;
  /** Append a new persona (already minted via `mintPersona`). */
  addPersona: (persona: CustomPersona) => Promise<void>;
  /** Patch an existing persona by id. Returns the new array. */
  updatePersona: (id: string, patch: Partial<CustomPersona>) => Promise<void>;
  /** Remove by id. */
  deletePersona: (id: string) => Promise<void>;
  /** Bulk replace — used when restoring a v2 backup. */
  replacePersonas: (next: CustomPersona[]) => Promise<void>;
}

const readPersistedPersonas = async (): Promise<CustomPersona[]> => {
  // Wrap to defend against `idb-keyval.get()` synchronously
  // throwing when `indexedDB` is undefined (happy-dom test env);
  // the inner `.catch` handler doesn't fire on sync throws.
  let idbValue: unknown;
  try {
    idbValue = await get('vector_master_vault_custom_personas').catch(() => undefined);
  } catch {
    idbValue = undefined;
  }
  if (Array.isArray(idbValue)) return hydratePersonas(idbValue);

  const mirror = readDiaryJson<unknown>('vector_master_vault_custom_personas');
  if (Array.isArray(mirror)) return hydratePersonas(mirror);

  return [];
};

export const useCustomPersonas = (): UseCustomPersonasResult => {
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const activeLoadIdRef = useRef(0);

  // Hydrate once on mount. Re-runs are guarded against late-arriving
  // promises clobbering newer state (mirrors the load-id pattern from
  // `useDiaryData`).
  useEffect(() => {
    const loadId = ++activeLoadIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || activeLoadIdRef.current !== loadId;

    (async () => {
      try {
        const persisted = await readPersistedPersonas();
        if (isStale()) return;
        setCustomPersonas(persisted);
      } finally {
        if (!isStale()) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: CustomPersona[]) => {
    setCustomPersonas(next);
    try {
      await set('vector_master_vault_custom_personas', next).catch(() => {});
      mirrorDiaryValue('vector_master_vault_custom_personas', JSON.stringify(next));
    } catch (err) {
      // Persistence failures are non-fatal — the runtime state is
      // already updated, the user just won't see the new persona on
      // a hard refresh. The error reaches console for diagnosis.
      console.warn('useCustomPersonas: persist failed', err);
    }
  }, []);

  const addPersona = useCallback(
    async (persona: CustomPersona) => {
      await persist([...customPersonas, persona]);
    },
    [customPersonas, persist],
  );

  const updatePersonaById = useCallback(
    async (id: string, patch: Partial<CustomPersona>) => {
      const next = patchPersona(customPersonas, id, patch);
      if (next === customPersonas) return; // no-op — id not found
      await persist(next);
    },
    [customPersonas, persist],
  );

  const deletePersonaById = useCallback(
    async (id: string) => {
      await persist(removePersona(customPersonas, id));
    },
    [customPersonas, persist],
  );

  const replacePersonas = useCallback(
    async (next: CustomPersona[]) => {
      await persist(hydratePersonas(next));
    },
    [persist],
  );

  return {
    customPersonas,
    loading,
    addPersona,
    updatePersona: updatePersonaById,
    deletePersona: deletePersonaById,
    replacePersonas,
  };
};
