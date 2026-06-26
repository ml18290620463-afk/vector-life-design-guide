import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProactiveRecall } from './useProactiveRecall';
import { mintPersona } from '../services/personaService';
import type { DiaryEntry } from '../types';

const day = 1000 * 60 * 60 * 24;
const NOW = 1_700_000_000_000;

const memoir = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});
memoir.createdAt = NOW - 60 * day;

const entryWithMemoir = (over: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'e-x',
  title: 't',
  content: 'c',
  createdAt: NOW - 30 * day,
  tags: [],
  isLocked: false,
  morningStarPersonas: ['奶奶'],
  ...over,
});

describe('useProactiveRecall', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('returns silence-reconnect suggestions for stale Memoirs', () => {
    const { result } = renderHook(() =>
      useProactiveRecall({
        memoirs: [memoir],
        memories: [],
        entries: [entryWithMemoir({ createdAt: NOW - 30 * day })],
        now: NOW,
      }),
    );
    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].trigger).toBe('silence-reconnect');
  });

  it('dismiss removes the suggestion until cooldown expires', () => {
    const { result, rerender } = renderHook(
      ({ now }) =>
        useProactiveRecall({
          memoirs: [memoir],
          memories: [],
          entries: [entryWithMemoir({ createdAt: NOW - 30 * day })],
          now,
        }),
      { initialProps: { now: NOW } },
    );
    const first = result.current.suggestions[0];
    act(() => {
      result.current.dismiss(first);
    });
    // Same `now` → suggestion is now suppressed.
    rerender({ now: NOW });
    expect(result.current.suggestions).toHaveLength(0);

    // Cooldown is 24h — fast-forward 25h, suggestion returns.
    rerender({ now: NOW + 25 * 60 * 60 * 1000 });
    // The hook caches dismissed in state; the cooldown evaluation
    // happens against the live `now`, so on re-eval the entry is
    // expired and the suggestion comes back.
    expect(result.current.suggestions).toHaveLength(1);
  });

  it('persists dismissal to localStorage', () => {
    const { result } = renderHook(() =>
      useProactiveRecall({
        memoirs: [memoir],
        memories: [],
        entries: [entryWithMemoir({ createdAt: NOW - 30 * day })],
        now: NOW,
      }),
    );
    const s = result.current.suggestions[0];
    act(() => {
      result.current.dismiss(s);
    });
    const raw = localStorage.getItem('vector_proactive_recall_dismissed');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(typeof parsed[`${s.memoirId}::silence-reconnect`]).toBe('number');
  });

  it('respects existing localStorage cooldown on first mount', () => {
    const expiresAt = NOW + 60 * 60 * 1000; // 1h from NOW
    localStorage.setItem(
      'vector_proactive_recall_dismissed',
      JSON.stringify({ [`${memoir.id}::silence-reconnect`]: expiresAt }),
    );
    const { result } = renderHook(() =>
      useProactiveRecall({
        memoirs: [memoir],
        memories: [],
        entries: [entryWithMemoir({ createdAt: NOW - 30 * day })],
        now: NOW,
      }),
    );
    expect(result.current.suggestions).toHaveLength(0);
  });
});
