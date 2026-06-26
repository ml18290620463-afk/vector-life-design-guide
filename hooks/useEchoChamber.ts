import { useCallback, useMemo, useRef, useState } from 'react';
import {
  runEchoChamber,
  type RunEchoChamberFailureReason,
  type RunEchoChamberResult,
} from '../services/echoChamberService';
import { ECHO_CHAMBER_LIMITS } from '../lib/echoChamberSchema';

/**
 * Phase 4.5 §B (Echo Chamber) — `useEchoChamber`
 *
 * State machine + dispatch for the round-table modal. Drives:
 *   - the form state (`query`, `selectedPersonas`)
 *   - the request lifecycle (`'idle' | 'submitting' | 'success' |
 *     'error' | 'cancelled'`)
 *   - the result + the discriminated failure reason so the modal
 *     can render the right inline copy
 *   - an `AbortController` so closing the modal mid-flight
 *     cancels the request cleanly
 *
 * Why a hook (vs lifting state straight into the modal):
 *   - Keeps the modal a pure render tree — easier to reason about,
 *     trivially testable.
 *   - Lets a future "round-table from inside Viewer" entry point
 *     reuse the dispatch logic without re-implementing it.
 *
 * The hook intentionally does NOT persist the result. The modal's
 * Save CTA threads the result back to the consumer (`onSave`),
 * which calls into `useDiaryData.addEntry` — same posture as the
 * Persona Builder hook and `useMemoirBuilder`.
 */

export type EchoChamberPhase = 'idle' | 'submitting' | 'success' | 'error' | 'cancelled';

export interface UseEchoChamberArgs {
  /** Optional fetch override — tests inject a stub instead of
   *  hitting the real `/api/echo-chamber`. */
  fetcher?: typeof fetch;
}

export interface UseEchoChamberResult {
  query: string;
  setQuery: (value: string) => void;
  selectedPersonas: string[];
  togglePersona: (name: string) => void;
  setSelectedPersonas: (names: readonly string[]) => void;
  phase: EchoChamberPhase;
  errorReason: RunEchoChamberFailureReason | null;
  errorDetail: string | null;
  resultMarkdown: string | null;
  /** Whether the form is currently valid for submit. Mirrors the
   *  shared schema bounds; the modal greys out the Send CTA when
   *  this is false. */
  isReadyToSubmit: boolean;
  /** Submit the form. Returns the result so callers can chain. */
  submit: (input?: {
    /** Optional persona-prompt overrides for custom 启明星. */
    customPersonaPrompts?: Record<string, string>;
    /** Optional Memoir recall map (`name → top-N memories`). */
    memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>;
  }) => Promise<RunEchoChamberResult>;
  /** Abort an in-flight call (closing the modal calls this). */
  cancel: () => void;
  /** Reset the form back to `'idle'` with empty inputs. */
  reset: () => void;
}

export const useEchoChamber = (args: UseEchoChamberArgs = {}): UseEchoChamberResult => {
  const fetcher = args.fetcher;
  const [query, setQuery] = useState('');
  const [selectedPersonas, setSelectedPersonasState] = useState<string[]>([]);
  const [phase, setPhase] = useState<EchoChamberPhase>('idle');
  const [errorReason, setErrorReason] = useState<RunEchoChamberFailureReason | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [resultMarkdown, setResultMarkdown] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const togglePersona = useCallback((name: string) => {
    setSelectedPersonasState((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= ECHO_CHAMBER_LIMITS.maxPersonas) return prev;
      return [...prev, name];
    });
  }, []);

  const setSelectedPersonas = useCallback((names: readonly string[]) => {
    // Cap silently at the schema's max — keeps consumer code simple.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of names) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
      if (out.length >= ECHO_CHAMBER_LIMITS.maxPersonas) break;
    }
    setSelectedPersonasState(out);
  }, []);

  const isReadyToSubmit = useMemo(() => {
    if (selectedPersonas.length < ECHO_CHAMBER_LIMITS.minPersonas) return false;
    if (selectedPersonas.length > ECHO_CHAMBER_LIMITS.maxPersonas) return false;
    if (query.trim().length < ECHO_CHAMBER_LIMITS.minQueryChars) return false;
    return true;
  }, [query, selectedPersonas]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase((prev) => (prev === 'submitting' ? 'cancelled' : prev));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setQuery('');
    setSelectedPersonasState([]);
    setPhase('idle');
    setErrorReason(null);
    setErrorDetail(null);
    setResultMarkdown(null);
  }, []);

  const submit = useCallback<UseEchoChamberResult['submit']>(
    async (input = {}) => {
      if (!isReadyToSubmit) {
        const failure: RunEchoChamberResult = {
          ok: false,
          reason: 'invalid-input',
          detail: 'form not ready',
        };
        setPhase('error');
        setErrorReason('invalid-input');
        setErrorDetail('form not ready');
        return failure;
      }
      // Abort any prior in-flight call (defence against double-tap).
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase('submitting');
      setErrorReason(null);
      setErrorDetail(null);
      setResultMarkdown(null);
      const result = await runEchoChamber({
        query,
        personaNames: selectedPersonas,
        customPersonaPrompts: input.customPersonaPrompts,
        memoirRecallByPersona: input.memoirRecallByPersona,
        fetcher,
        signal: controller.signal,
      });
      // If the controller is no longer the active one, a newer call
      // has already started — silently let the newer one own state.
      if (abortRef.current !== controller) return result;
      abortRef.current = null;
      if (result.ok === true) {
        setResultMarkdown(result.markdown);
        setPhase('success');
      } else if (result.reason === 'aborted') {
        setPhase('cancelled');
      } else {
        setErrorReason(result.reason);
        setErrorDetail(result.detail ?? null);
        setPhase('error');
      }
      return result;
    },
    [fetcher, isReadyToSubmit, query, selectedPersonas],
  );

  return useMemo(
    () => ({
      query,
      setQuery,
      selectedPersonas,
      togglePersona,
      setSelectedPersonas,
      phase,
      errorReason,
      errorDetail,
      resultMarkdown,
      isReadyToSubmit,
      submit,
      cancel,
      reset,
    }),
    [
      query,
      selectedPersonas,
      togglePersona,
      setSelectedPersonas,
      phase,
      errorReason,
      errorDetail,
      resultMarkdown,
      isReadyToSubmit,
      submit,
      cancel,
      reset,
    ],
  );
};
