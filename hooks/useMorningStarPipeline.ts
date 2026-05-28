import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryEntry } from '../types';
import {
  getMorningStarAnalysis as defaultMorningStarFetcher,
  streamMorningStarAnalysis as defaultMorningStarStreamer,
  type MorningStarChunkHandler,
} from '../services/geminiService';
import { AppStorageKeys } from '../services/appSettings';

export type ReadingStep = 'reading' | 'reflecting' | 'evaluation';

export interface ParsedMorningStarAnalysis {
  content: string;
  metrics: Record<string, number>;
}

/** Signature compatible with `services/geminiService.getMorningStarAnalysis`.
 *  The trailing `customPersonaPrompts` arg (Phase 4 §5.1.A) carries the
 *  user-created persona's `name → systemPrompt` map; defaults to {}.
 *  Phase 4 §5.1.B adds `memoirRecallByPersona` for per-Memoir long-term
 *  memory recall — same key (persona name), value is the top-N memory
 *  bodies that the parent's `useMemoryStore.recallForMemoir(...)` produced. */
export type MorningStarFetcher = (
  decryptedContent: string,
  reflectionText: string,
  personas: string[],
  customPersonaPrompts?: Record<string, string>,
  memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>,
) => Promise<string>;

/**
 * Signature compatible with
 * `services/geminiService.streamMorningStarAnalysis`. Each chunk fires
 * with `(delta, accumulated)` so a UI preview can show the running
 * text without rebuilding the string itself.
 *
 * `customPersonaPrompts` (Phase 4 §5.1.A) is optional and carries the
 * user-created persona's `name → systemPrompt` map.
 *
 * `memoirRecallByPersona` (Phase 4 §5.1.B) is the per-Memoir recall
 * map; identical key shape to `customPersonaPrompts`.
 */
export type MorningStarStreamer = (
  decryptedContent: string,
  reflectionText: string,
  personas: string[],
  onChunk: MorningStarChunkHandler,
  signal?: AbortSignal,
  customPersonaPrompts?: Record<string, string>,
  memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>,
) => Promise<string>;

export interface UseMorningStarPipelineArgs {
  entry: DiaryEntry;
  guidingStars: string[];
  /** Plaintext (post-decryption) entry body. Falls back to `entry.content`. */
  decryptedContent: string;
  language: 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'es' | 'de';
  /** Persist updates back to useDiaryData. */
  onUpdateEntry: (updated: DiaryEntry) => void;
  /** Phase 4 §5.1.A — `name → systemPrompt` map for user-created
   *  custom 启明星. Optional; absent map keeps the legacy "speak as
   *  this guiding star" fallback for any selected persona. */
  customPersonaPrompts?: Record<string, string>;
  /** Phase 4 §5.1.B — `name → top-N memory bodies` map for Memoir
   *  personas. The Viewer is responsible for calling
   *  `useMemoryStore.recallForMemoir(memoirId, query)` and forwarding
   *  the result keyed by the Memoir's name. Absent map keeps the
   *  Memoir on its baseline systemPrompt without any recall context. */
  memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>;
  /** Phase 4 Week 3.5 — fire-and-forget hook that runs after a
   *  successful Morning Star round. Owned by the Viewer (which
   *  also owns `useMemoryStore`); the pipeline only knows it should
   *  call this with the just-saved reflection + the raw response.
   *  Returning a promise is fine but the pipeline does not await
   *  it — the harvest must never block UI exit. */
  onAnalysisHarvest?: (input: {
    reflection: string;
    rawResponse: string;
    participatingPersonas: readonly string[];
  }) => void | Promise<unknown>;
  /**
   * Override the buffered Morning Star call; defaults to the proxy in
   * `services/geminiService`. Useful for tests and for swapping providers
   * without touching this hook.
   */
  fetcher?: MorningStarFetcher;
  /** Override the streaming Morning Star call. */
  streamer?: MorningStarStreamer;
  /**
   * Force the streaming path (used by tests). When undefined, the hook
   * reads the per-installation flag at
   * `localStorage[AppStorageKeys.morningStarStreamingEnabled]`.
   */
  streamingEnabled?: boolean;
}

export interface MorningStarPipeline {
  personas: string[];
  setPersonas: (personas: string[]) => void;
  reflectionText: string;
  setReflectionText: (text: string) => void;
  loading: boolean;
  error: string | null;
  parsedAnalysis: ParsedMorningStarAnalysis | null;
  readingStep: ReadingStep;
  setReadingStep: (step: ReadingStep) => void;
  /**
   * W2.4 — Live preview of streamed Morning Star deltas. Empty string
   * when the streaming path is off OR before the first chunk arrives.
   * Cleared back to '' on every fresh analyze() call.
   */
  streamingPreview: string;
  /** Trigger an analysis call. No-ops if already loading or pre-conditions fail. */
  analyze: () => Promise<void>;
  /** Drop the persisted analysis and reset to the reading step. */
  deleteAnalysis: () => void;
}

const isStreamingEnabledFromStorage = (): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const value = localStorage.getItem(AppStorageKeys.morningStarStreamingEnabled);
    if (value == null) return true;
    return value === '1' || (typeof value === 'string' && value.toLowerCase() === 'true');
  } catch {
    return true;
  }
};

const initialPersonas = (entry: DiaryEntry, guidingStars: string[]): string[] => {
  if (entry.morningStarPersonas && entry.morningStarPersonas.length > 0) {
    return entry.morningStarPersonas;
  }
  if (guidingStars.length > 0) return guidingStars;
  return ['Marcus Aurelius'];
};

const initialReadingStep = (entry: DiaryEntry): ReadingStep =>
  entry.morningStarAnalysis ? 'evaluation' : 'reading';

const safeParseAnalysis = (raw: string | undefined): ParsedMorningStarAnalysis | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'content' in parsed && 'metrics' in parsed) {
      return parsed as ParsedMorningStarAnalysis;
    }
    return { content: raw, metrics: {} };
  } catch {
    return { content: raw, metrics: {} };
  }
};

/**
 * Owns the entire Morning Star sub-flow: persona selection, the
 * `reading → reflecting → evaluation` step machine, the loading /
 * error state, the upstream call, and the JSON parse of the persisted
 * analysis. Extracted from `Viewer.tsx` so the viewer's job shrinks to
 * "wire the pipeline into the panel".
 */
export const useMorningStarPipeline = ({
  entry,
  guidingStars,
  decryptedContent,
  language,
  onUpdateEntry,
  customPersonaPrompts,
  memoirRecallByPersona,
  onAnalysisHarvest,
  fetcher = defaultMorningStarFetcher,
  streamer = defaultMorningStarStreamer,
  streamingEnabled,
}: UseMorningStarPipelineArgs): MorningStarPipeline => {
  const [personas, setPersonas] = useState<string[]>(() => initialPersonas(entry, guidingStars));
  const [reflectionText, setReflectionText] = useState(entry.reflection ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readingStep, setReadingStep] = useState<ReadingStep>(() => initialReadingStep(entry));
  const [streamingPreview, setStreamingPreview] = useState('');

  // Reset when navigating into a different entry.
  // We deliberately depend on the specific entry fields below — depending on
  // `entry` itself would re-fire on unrelated mutations (e.g. attachment
  // resize) and clobber in-progress reflection text. `guidingStars` is
  // joined into a string so we compare *content*, not reference; otherwise
  // a new array per render (the common React parent-passes-literal pattern)
  // would loop the effect.
  const guidingStarsKey = guidingStars.join('|');
  useEffect(() => {
    setPersonas(initialPersonas(entry, guidingStars));
    setReflectionText(entry.reflection ?? '');
    setReadingStep(initialReadingStep(entry));
    setLoading(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entry.id,
    entry.morningStarAnalysis,
    entry.morningStarPersonas,
    entry.reflection,
    guidingStarsKey,
  ]);

  // Auto-clear the error banner only when the user *changes* the
  // reflection (acknowledging the previous failure). We track the
  // previous value via a ref so the effect doesn't fire on the
  // initial mount with a pre-populated reflection.
  const prevReflectionRef = useRef(reflectionText);
  useEffect(() => {
    if (prevReflectionRef.current !== reflectionText) {
      prevReflectionRef.current = reflectionText;
      if (error && reflectionText.trim()) setError(null);
    }
  }, [error, reflectionText]);

  const parsedAnalysis = useMemo(
    () => safeParseAnalysis(entry.morningStarAnalysis),
    [entry.morningStarAnalysis],
  );

  const analyze = useCallback(async () => {
    if (loading || personas.length === 0) return;
    setLoading(true);
    setError(null);
    setStreamingPreview('');
    setReadingStep('evaluation');
    try {
      const contentToAnalyze = decryptedContent || entry.content;
      // Streaming path is opt-in via per-installation flag (or test
      // override). On any failure inside the streamer, the underlying
      // service silently falls back to the buffered endpoint, so the
      // hook only sees a single "result" string.
      const useStreaming = streamingEnabled ?? isStreamingEnabledFromStorage();
      const result = useStreaming
        ? await (async () => {
            try {
              return await streamer(
                contentToAnalyze,
                reflectionText.trim(),
                personas,
                (_delta, accumulated) => setStreamingPreview(accumulated),
                undefined,
                customPersonaPrompts,
                memoirRecallByPersona,
              );
            } catch {
              // Fallback to buffered response so one flaky stream
              // attempt does not hard-fail the entire reflection loop.
              return fetcher(
                contentToAnalyze,
                reflectionText.trim(),
                personas,
                customPersonaPrompts,
                memoirRecallByPersona,
              );
            }
          })()
        : await fetcher(
            contentToAnalyze,
            reflectionText.trim(),
            personas,
            customPersonaPrompts,
            memoirRecallByPersona,
          );
      onUpdateEntry({
        ...entry,
        morningStarAnalysis: result,
        morningStarPersonas: personas,
        reflection: reflectionText.trim(),
      });
      // Phase 4 Week 3.5 — fire-and-forget Memoir memory harvest.
      // The harvest hook itself swallows errors (extraction is a
      // background enrichment, not a user-visible step); we wrap
      // in try/catch as a belt-and-braces guard against a
      // misconfigured caller leaking a sync throw.
      if (onAnalysisHarvest) {
        try {
          void onAnalysisHarvest({
            reflection: reflectionText.trim(),
            rawResponse: result,
            participatingPersonas: personas,
          });
        } catch (harvestError) {
          console.warn('Memoir memory harvest dispatch failed:', harvestError);
        }
      }
    } catch (err) {
      console.error('Morning Star Analysis failed:', err);
      setError(
        language === 'zh'
          ? '启明星连接暂时不稳定，请稍后再试。'
          : 'Morning Star is temporarily unavailable. Please try again.',
      );
    } finally {
      setLoading(false);
      setStreamingPreview('');
    }
  }, [
    customPersonaPrompts,
    memoirRecallByPersona,
    onAnalysisHarvest,
    decryptedContent,
    entry,
    fetcher,
    language,
    loading,
    onUpdateEntry,
    personas,
    reflectionText,
    streamer,
    streamingEnabled,
  ]);

  const deleteAnalysis = useCallback(() => {
    onUpdateEntry({
      ...entry,
      morningStarAnalysis: undefined,
      morningStarPersonas: undefined,
      reflection: '',
    });
    setReadingStep('reading');
    setReflectionText('');
    setError(null);
  }, [entry, onUpdateEntry]);

  return {
    personas,
    setPersonas,
    reflectionText,
    setReflectionText,
    loading,
    error,
    parsedAnalysis,
    readingStep,
    setReadingStep,
    streamingPreview,
    analyze,
    deleteAnalysis,
  };
};
