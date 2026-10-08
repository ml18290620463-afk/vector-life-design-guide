import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardImportConfirm } from './useDashboardImportConfirm';

describe('useDashboardImportConfirm', () => {
  it('starts with no pending confirm', () => {
    const { result } = renderHook(() => useDashboardImportConfirm());
    expect(result.current.pending).toBeNull();
  });

  it('confirm() puts a pending entry on the queue', () => {
    const { result } = renderHook(() => useDashboardImportConfirm());
    act(() => {
      result.current.confirm('Replace 12 entries?');
    });
    expect(result.current.pending?.message).toBe('Replace 12 entries?');
  });

  it('resolveConfirm(true) settles the promise with true and clears pending', async () => {
    const { result } = renderHook(() => useDashboardImportConfirm());
    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirm('Are you sure?');
    });
    act(() => result.current.resolveConfirm(true));
    await expect(promise).resolves.toBe(true);
    expect(result.current.pending).toBeNull();
  });

  it('resolveConfirm(false) settles with false', async () => {
    const { result } = renderHook(() => useDashboardImportConfirm());
    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirm('Confirm?');
    });
    act(() => result.current.resolveConfirm(false));
    await expect(promise).resolves.toBe(false);
  });

  it('queues only the latest confirm — earlier ones are dropped', () => {
    const { result } = renderHook(() => useDashboardImportConfirm());
    act(() => {
      result.current.confirm('first');
    });
    act(() => {
      result.current.confirm('second');
    });
    expect(result.current.pending?.message).toBe('second');
  });

  it('resolveConfirm without a pending entry is a safe no-op', () => {
    const { result } = renderHook(() => useDashboardImportConfirm());
    expect(() => act(() => result.current.resolveConfirm(true))).not.toThrow();
    expect(result.current.pending).toBeNull();
  });
});
