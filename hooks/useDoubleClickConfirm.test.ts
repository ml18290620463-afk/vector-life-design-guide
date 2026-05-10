import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDoubleClickConfirm } from './useDoubleClickConfirm';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDoubleClickConfirm', () => {
  it('starts un-armed', () => {
    const { result } = renderHook(() => useDoubleClickConfirm({ onConfirm: vi.fn() }));
    expect(result.current.isConfirming).toBe(false);
  });

  it('first trigger arms the confirmation badge but does NOT call onConfirm', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleClickConfirm({ onConfirm }));
    act(() => result.current.trigger());
    expect(result.current.isConfirming).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('second trigger after minGap fires onConfirm and resets the badge', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleClickConfirm({ onConfirm, minGapMs: 100 }));
    act(() => result.current.trigger());
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => result.current.trigger());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirming).toBe(false);
  });

  it('rapid second click within minGap is ignored (debounces accidental double-tap)', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleClickConfirm({ onConfirm, minGapMs: 500 }));
    act(() => result.current.trigger());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => result.current.trigger());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.isConfirming).toBe(true);
  });

  it('confirmation badge auto-dismisses after confirmWindowMs', () => {
    const { result } = renderHook(() =>
      useDoubleClickConfirm({ onConfirm: vi.fn(), confirmWindowMs: 200 }),
    );
    act(() => result.current.trigger());
    expect(result.current.isConfirming).toBe(true);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.isConfirming).toBe(false);
  });

  it('reset() imperatively dismisses an armed confirmation', () => {
    const { result } = renderHook(() => useDoubleClickConfirm({ onConfirm: vi.fn() }));
    act(() => result.current.trigger());
    expect(result.current.isConfirming).toBe(true);
    act(() => result.current.reset());
    expect(result.current.isConfirming).toBe(false);
  });
});
