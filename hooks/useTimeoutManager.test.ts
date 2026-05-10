import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeoutManager } from './useTimeoutManager';

describe('useTimeoutManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs scheduled callbacks after the delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useTimeoutManager());

    act(() => {
      result.current.scheduleTimeout(callback, 1000);
      vi.advanceTimersByTime(999);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('clears pending callbacks when requested', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useTimeoutManager());

    act(() => {
      result.current.scheduleTimeout(callback, 1000);
      result.current.clearScheduledTimeouts();
      vi.runAllTimers();
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('cleans up pending callbacks on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useTimeoutManager());

    act(() => {
      result.current.scheduleTimeout(callback, 1000);
    });
    unmount();

    act(() => {
      vi.runAllTimers();
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
