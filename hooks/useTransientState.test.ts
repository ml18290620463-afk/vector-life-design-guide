import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransientState } from './useTransientState';

describe('useTransientState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto clears transient values after the default duration', () => {
    const { result } = renderHook(() => useTransientState<string | null>(null));

    act(() => {
      result.current.showValue('hello');
    });
    expect(result.current.value).toBe('hello');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.value).toBeNull();
  });

  it('keeps persistent values until they are changed explicitly', () => {
    const { result } = renderHook(() => useTransientState<string | null>(null));

    act(() => {
      result.current.setValue('steady');
      vi.runAllTimers();
    });

    expect(result.current.value).toBe('steady');
  });

  it('restarts the timer when a new transient value is shown', () => {
    const { result } = renderHook(() => useTransientState<string | null>(null));

    act(() => {
      result.current.showValue('first');
      vi.advanceTimersByTime(2000);
      result.current.showValue('second');
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.value).toBe('second');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.value).toBeNull();
  });
});
