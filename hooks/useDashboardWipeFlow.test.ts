import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardWipeFlow } from './useDashboardWipeFlow';

describe('useDashboardWipeFlow', () => {
  it('starts collapsed with empty input', () => {
    const { result } = renderHook(() => useDashboardWipeFlow({ onWipeData: vi.fn() }));
    expect(result.current.wipeMode).toBe(false);
    expect(result.current.wipeInput).toBe('');
  });

  it('toggles wipeMode via setter', () => {
    const { result } = renderHook(() => useDashboardWipeFlow({ onWipeData: vi.fn() }));
    act(() => result.current.setWipeMode(true));
    expect(result.current.wipeMode).toBe(true);
  });

  it('controls wipeInput via setter', () => {
    const { result } = renderHook(() => useDashboardWipeFlow({ onWipeData: vi.fn() }));
    act(() => result.current.setWipeInput('DEL'));
    expect(result.current.wipeInput).toBe('DEL');
  });

  it('handleWipeConfirm is a no-op when input is not exactly "DELETE"', () => {
    const onWipeData = vi.fn();
    const { result } = renderHook(() => useDashboardWipeFlow({ onWipeData }));
    act(() => result.current.setWipeInput('delete'));
    act(() => result.current.handleWipeConfirm());
    expect(onWipeData).not.toHaveBeenCalled();
  });

  it('fires onWipeData + collapses + invokes onAfterWipe on a "DELETE" match', () => {
    const onWipeData = vi.fn();
    const onAfterWipe = vi.fn();
    const { result } = renderHook(() => useDashboardWipeFlow({ onWipeData, onAfterWipe }));
    act(() => result.current.setWipeMode(true));
    act(() => result.current.setWipeInput('DELETE'));
    act(() => result.current.handleWipeConfirm());
    expect(onWipeData).toHaveBeenCalledTimes(1);
    expect(onAfterWipe).toHaveBeenCalledTimes(1);
    expect(result.current.wipeMode).toBe(false);
  });

  it('skips onAfterWipe when not supplied', () => {
    const onWipeData = vi.fn();
    const { result } = renderHook(() => useDashboardWipeFlow({ onWipeData }));
    act(() => result.current.setWipeInput('DELETE'));
    act(() => result.current.handleWipeConfirm());
    expect(onWipeData).toHaveBeenCalledTimes(1);
    expect(result.current.wipeMode).toBe(false);
  });
});
