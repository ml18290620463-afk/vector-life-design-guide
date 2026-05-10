import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useMorningStarPipeline,
  type MorningStarFetcher,
  type MorningStarStreamer,
} from './useMorningStarPipeline';
import type { DiaryEntry } from '../types';

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e1',
  title: 'Title',
  content: 'plain content',
  createdAt: 1,
  tags: [],
  isLocked: false,
  ...overrides,
});

let onUpdateEntry: ReturnType<typeof vi.fn<(updated: DiaryEntry) => void>>;
let fetcher: ReturnType<typeof vi.fn<MorningStarFetcher>>;
let streamer: ReturnType<typeof vi.fn<MorningStarStreamer>>;

beforeEach(() => {
  onUpdateEntry = vi.fn<(updated: DiaryEntry) => void>();
  fetcher = vi.fn<MorningStarFetcher>();
  streamer = vi.fn<MorningStarStreamer>();
});

describe('useMorningStarPipeline', () => {
  it('seeds personas from entry.morningStarPersonas when present', () => {
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: baseEntry({ morningStarPersonas: ['Naval Ravikant'] }),
        guidingStars: ['Marcus Aurelius'],
        decryptedContent: '',
        language: 'en',
        onUpdateEntry,
        fetcher,
      }),
    );
    expect(result.current.personas).toEqual(['Naval Ravikant']);
  });

  it('falls back to guidingStars when entry has none', () => {
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: baseEntry(),
        guidingStars: ['Camus'],
        decryptedContent: '',
        language: 'en',
        onUpdateEntry,
        fetcher,
      }),
    );
    expect(result.current.personas).toEqual(['Camus']);
  });

  it('starts at evaluation when an analysis already exists', () => {
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: baseEntry({ morningStarAnalysis: '{"content":"hi","metrics":{"clarity":7}}' }),
        guidingStars: [],
        decryptedContent: '',
        language: 'en',
        onUpdateEntry,
        fetcher,
      }),
    );
    expect(result.current.readingStep).toBe('evaluation');
    expect(result.current.parsedAnalysis).toEqual({ content: 'hi', metrics: { clarity: 7 } });
  });

  it('analyze() persists the upstream result on success', async () => {
    fetcher.mockResolvedValueOnce('{"content":"reply","metrics":{"clarity":7}}');
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: baseEntry({ reflection: 'I feel stuck.' }),
        guidingStars: ['Camus'],
        decryptedContent: 'plain text',
        language: 'en',
        onUpdateEntry,
        fetcher,
      }),
    );

    await act(async () => {
      await result.current.analyze();
    });

    expect(onUpdateEntry).toHaveBeenCalledOnce();
    const updated = onUpdateEntry.mock.calls[0][0] as DiaryEntry;
    expect(updated.morningStarAnalysis).toContain('reply');
    expect(updated.reflection).toBe('I feel stuck.');
  });

  it('analyze() surfaces an error message on failure', async () => {
    fetcher.mockRejectedValueOnce(new Error('upstream'));
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: baseEntry({ reflection: 'reflection' }),
        guidingStars: ['Camus'],
        decryptedContent: '',
        language: 'zh',
        onUpdateEntry,
        fetcher,
      }),
    );

    // Pre-seed reflection via the entry prop so the useCallback closure
    // captures a non-empty value at first render — otherwise StrictMode's
    // double-render delays the closure refresh and analyze() short-circuits.
    expect(result.current.reflectionText).toBe('reflection');

    await act(async () => {
      await result.current.analyze();
    });

    expect(onUpdateEntry).not.toHaveBeenCalled();
    expect(result.current.error).toContain('启明星');
  });

  it('deleteAnalysis() forwards a cleared entry to onUpdateEntry', () => {
    // We deliberately do NOT call deleteAnalysis through `act()` and we do
    // NOT inspect post-call hook state here: the realistic flow is
    // "hook calls onUpdateEntry → parent re-renders Viewer with a new
    // entry prop → useEffect resets local state". A bare `act` against a
    // mocked onUpdateEntry was triggering an effect-driven feedback loop
    // in StrictMode that exhausted the V8 heap (worker OOM). The
    // contract we actually care about — the call payload — is checked
    // below, and the post-update reset is exercised end-to-end by the
    // Viewer integration in `e2e/app.spec.ts`.
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: baseEntry({
          morningStarAnalysis: '{"content":"x","metrics":{}}',
          morningStarPersonas: ['Camus'],
          reflection: 'old',
        }),
        guidingStars: [],
        decryptedContent: '',
        language: 'en',
        onUpdateEntry,
        fetcher,
      }),
    );

    result.current.deleteAnalysis();

    expect(onUpdateEntry).toHaveBeenCalledOnce();
    const cleared = onUpdateEntry.mock.calls[0][0] as DiaryEntry;
    expect(cleared.morningStarAnalysis).toBeUndefined();
    expect(cleared.morningStarPersonas).toBeUndefined();
    expect(cleared.reflection).toBe('');
  });
});

describe('useMorningStarPipeline — W2.4 streaming branch', () => {
  // Reflection is seeded via the entry prop (NOT through
  // setReflectionText) so analyze() doesn't churn through extra
  // re-renders that exhaust the worker heap under StrictMode — same
  // contract documented at the top of the file.
  const reflectiveEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry =>
    baseEntry({
      morningStarPersonas: ['Marcus Aurelius'],
      reflection: 'I feel stuck.',
      ...overrides,
    });

  it('exposes streamingPreview="" by default', () => {
    const { result } = renderHook(() =>
      useMorningStarPipeline({
        entry: reflectiveEntry(),
        guidingStars: [],
        decryptedContent: '',
        language: 'en',
        onUpdateEntry,
        fetcher,
        streamer,
      }),
    );
    expect(result.current.streamingPreview).toBe('');
  });
});
