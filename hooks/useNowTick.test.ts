import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNowTick } from './useNowTick';

describe('useNowTick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => {
    act(() => {
      vi.setSystemTime(new Date(Date.now() + ms));
      vi.advanceTimersByTime(ms);
    });
  };

  it('returns Date.now() at mount', () => {
    const { result } = renderHook(() => useNowTick(false));
    expect(typeof result.current).toBe('number');
    expect(result.current).toBe(Date.now());
  });

  it('keeps the snapshot stable when disabled', () => {
    const { result } = renderHook(() => useNowTick(false));
    const initial = result.current;
    advance(5000);
    expect(result.current).toBe(initial);
  });

  it('refreshes the snapshot at each interval when enabled', () => {
    const { result } = renderHook(() => useNowTick(true, 1000));
    const first = result.current;
    advance(3000);
    expect(result.current).toBeGreaterThanOrEqual(first + 1000);
  });

  it('stops refreshing once disabled again', () => {
    const { result, rerender } = renderHook(({ enabled }) => useNowTick(enabled, 1000), {
      initialProps: { enabled: true },
    });
    advance(1000);
    rerender({ enabled: false });
    const frozen = result.current;
    advance(5000);
    expect(result.current).toBe(frozen);
  });
});
