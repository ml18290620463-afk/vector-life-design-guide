import { useCallback, useRef } from 'react';
import type { CustomPersona, MemoryCategory } from '../types';
import {
  extractMemoirMemories,
  type MemoirConversationTurn,
} from '../services/memoryExtractionService';
import { buildMemoirTranscript } from '../services/memoirTranscriptSlicer';

/**
 * Phase 4 Week 3.5 — `useMemoirMemoryHarvest`
 *
 * Closes the **心象记忆循环**: every time a Morning Star round
 * finishes successfully and at least one of the participating
 * personas was a Memoir (`kind === 'memoir'`), this hook:
 *
 *   1. Slices the result markdown into per-Memoir transcripts
 *      (USER reflection + that Memoir's letter section).
 *   2. Calls `/api/memoir-extract` for each transcript.
 *      Failures are silent (see `memoryExtractionService`).
 *   3. Pipes each surviving candidate body through
 *      `addMemory` from `useMemoryStore`, which re-runs the
 *      `detectUnsafeMemoryBody` second-line PII guard before
 *      persisting (defence in depth — the LLM is the first line
 *      of defence, the service is the second).
 *
 * Background-only by design:
 *   - The harvest is **fire-and-forget**: `triggerHarvest` returns
 *     immediately with a void promise so it never blocks the UI.
 *   - The current in-flight harvest is tracked via an AbortController
 *     so navigating away from the entry mid-harvest cancels cleanly.
 *   - Failures NEVER surface to the user — the Morning Star round
 *     itself succeeded and that is the user-visible outcome.
 *
 * Quota / paywall posture: no client-side quota gate is enforced
 * here because the Memoir's own chat quota
 * (`quotaService.canChatMemoir`) was already checked when the
 * conversation started. The extraction call is metered as part of
 * that round.
 */
export interface UseMemoirMemoryHarvestArgs {
  /** Live custom persona list (we filter to `kind === 'memoir'`). */
  customPersonas: readonly CustomPersona[];
  /** Append a memory candidate to the live store. Same signature
   *  as `useMemoryStore.addMemory`. */
  addMemory: (input: {
    memoirId: string;
    category: MemoryCategory;
    body: string;
    sourceRef?: string;
  }) => Promise<{ ok: boolean }>;
  /** Optional fetch override — tests inject a stub instead of
   *  hitting the real `/api/memoir-extract`. */
  fetcher?: typeof fetch;
}

export interface HarvestArgs {
  /** Plain-text reflection the user sent in. */
  reflection: string;
  /** The Morning Star result's `content` markdown (after JSON
   *  parsing — pass `parsed.content`, not the raw envelope). */
  responseMarkdown: string;
  /** Names of the personas that participated in this round. The
   *  hook intersects this with `customPersonas` to find the
   *  Memoirs that need a harvest. */
  participatingPersonas: readonly string[];
  /** Optional source reference written onto every minted memory.
   *  Defaults to `entry-${entryId}`. */
  sourceRef?: string;
}

export interface UseMemoirMemoryHarvestResult {
  /** Fire-and-forget; resolves once the harvest round finishes
   *  (success / silent failure). Returns the count of memories
   *  successfully written across all participating Memoirs. */
  triggerHarvest: (args: HarvestArgs) => Promise<number>;
  /** Cancel any in-flight harvest. Called on entry navigation. */
  cancelInFlight: () => void;
}

export const useMemoirMemoryHarvest = ({
  customPersonas,
  addMemory,
  fetcher,
}: UseMemoirMemoryHarvestArgs): UseMemoirMemoryHarvestResult => {
  const abortRef = useRef<AbortController | null>(null);
  // Stable ref to the latest persona list so the callback below
  // doesn't have to depend on the array (which mutates every time
  // the user adds a persona — would otherwise re-create the
  // callback per render and force every consumer's deps to churn).
  const personasRef = useRef<readonly CustomPersona[]>(customPersonas);
  personasRef.current = customPersonas;

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const triggerHarvest = useCallback(
    async ({
      reflection,
      responseMarkdown,
      participatingPersonas,
      sourceRef,
    }: HarvestArgs): Promise<number> => {
      // Cancel any prior round before starting a new one — guards
      // against a fast double-click on Morning Star analyse.
      cancelInFlight();
      const controller = new AbortController();
      abortRef.current = controller;

      const trimmedReflection = reflection?.trim() ?? '';
      if (!trimmedReflection || !responseMarkdown) return 0;

      const participatingSet = new Set(participatingPersonas);
      const memoirs = personasRef.current.filter(
        (p) => p.kind === 'memoir' && participatingSet.has(p.name),
      );
      if (memoirs.length === 0) return 0;

      let written = 0;
      // Process each Memoir independently — one bad LLM round
      // shouldn't poison the others.
      await Promise.all(
        memoirs.map(async (memoir) => {
          if (controller.signal.aborted) return;
          const transcript = buildMemoirTranscript({
            reflection: trimmedReflection,
            responseMarkdown,
            memoir,
          });
          if (!transcript) return;
          const candidates = await runExtractor({
            transcript,
            fetcher,
            signal: controller.signal,
          });
          if (!candidates || controller.signal.aborted) return;
          for (const candidate of candidates) {
            if (controller.signal.aborted) break;
            const result = await addMemory({
              memoirId: memoir.id,
              category: candidate.category,
              body: candidate.body,
              sourceRef,
            });
            if (result.ok) written += 1;
          }
        }),
      );

      // Clear the active controller if it's still ours.
      if (abortRef.current === controller) abortRef.current = null;
      return written;
    },
    [addMemory, fetcher, cancelInFlight],
  );

  return { triggerHarvest, cancelInFlight };
};

/* ------------------------------------------------------------------ */
/*  Internal helper (split out so the hook callback stays slim)        */
/* ------------------------------------------------------------------ */

interface RunExtractorArgs {
  transcript: MemoirConversationTurn[];
  fetcher?: typeof fetch;
  signal: AbortSignal;
}

const runExtractor = async ({ transcript, fetcher, signal }: RunExtractorArgs) =>
  extractMemoirMemories({ transcript, fetcher, signal });
