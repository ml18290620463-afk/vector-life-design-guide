import { useCallback, useMemo, useState } from 'react';
import type { CustomPersona, DiaryEntry, Memory } from '../types';
import {
  evaluateProactiveRecall,
  type ProactiveRecallSuggestion,
  type ProactiveRecallTrigger,
} from '../services/proactiveRecall';

/**
 * Phase 4 Week 5 Day 4 — `useProactiveRecall`
 *
 * Combines the pure `evaluateProactiveRecall` evaluator with a
 * **24-hour per-tuple cooldown** stored in localStorage. The
 * Dashboard mounts this once; the returned `suggestions` list is
 * what the `ProactiveRecallCard` UI renders, and `dismiss` writes
 * the cooldown.
 *
 * Why a hook (vs a pure helper at the call site):
 *   - Cooldown bookkeeping needs `useState` so the dismiss action
 *     re-renders the dashboard without the suggestion.
 *   - Reading localStorage on every Dashboard render would be a
 *     waste; the hook caches the dismissed map in state.
 *
 * Privacy posture: no network, no IDB. Cooldown lives in a single
 * localStorage key the user can wipe via Settings → Wipe Data.
 */

const STORAGE_KEY = 'vector_proactive_recall_dismissed';
const COOLDOWN_MS = 1000 * 60 * 60 * 24;

type DismissedMap = Record<string, number>; // key = `${memoirId}::${trigger}` → expiresAt ms

const tupleKey = (memoirId: string, trigger: ProactiveRecallTrigger): string =>
  `${memoirId}::${trigger}`;

const readDismissed = (): DismissedMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: DismissedMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
};

const writeDismissed = (map: DismissedMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (private mode etc) — silently ignore.
    // Cooldown is best-effort UX; not safety-critical.
  }
};

export interface UseProactiveRecallArgs {
  memoirs: readonly CustomPersona[];
  memories: readonly Memory[];
  entries: readonly DiaryEntry[];
  /** Optional `now` override for tests. */
  now?: number;
}

export interface UseProactiveRecallResult {
  suggestions: ProactiveRecallSuggestion[];
  /** Dismiss one suggestion for the cooldown window. */
  dismiss: (s: ProactiveRecallSuggestion) => void;
}

export const useProactiveRecall = ({
  memoirs,
  memories,
  entries,
  now,
}: UseProactiveRecallArgs): UseProactiveRecallResult => {
  const [dismissed, setDismissed] = useState<DismissedMap>(() => readDismissed());

  const evaluatedAt = now ?? Date.now();

  const suggestions = useMemo(() => {
    return evaluateProactiveRecall({
      memoirs,
      memories,
      entries,
      now: evaluatedAt,
      isOnCooldown: (memoirId, trigger) => {
        const exp = dismissed[tupleKey(memoirId, trigger)];
        return typeof exp === 'number' && exp > evaluatedAt;
      },
    });
  }, [memoirs, memories, entries, evaluatedAt, dismissed]);

  const dismiss = useCallback(
    (s: ProactiveRecallSuggestion) => {
      setDismissed((prev) => {
        const next = {
          ...prev,
          [tupleKey(s.memoirId, s.trigger)]: (now ?? Date.now()) + COOLDOWN_MS,
        };
        // Garbage-collect expired entries while we're here (cheap, O(N)).
        const fresh = now ?? Date.now();
        for (const k of Object.keys(next)) {
          if (next[k] <= fresh) delete next[k];
        }
        writeDismissed(next);
        return next;
      });
    },
    [now],
  );

  return { suggestions, dismiss };
};
