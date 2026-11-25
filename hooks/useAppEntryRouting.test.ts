import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../types';
import { useAppEntryRouting } from './useAppEntryRouting';
vi.mock('../lib/previewMode', () => ({ isMobileExperience: () => false, replaceAppPath: vi.fn() }));
describe('entry route restoration', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/now');
    localStorage.clear();
  });
  it('shows the cover at root without unlocking protected data', () => {
    window.history.replaceState({}, '', '/');
    const setAppState = vi.fn();
    const setIsUnlocked = vi.fn();
    renderHook(() => useAppEntryRouting({ loading: false, passwordHash: 'existing-hash', isUnlocked: false, setAppState, setIsUnlocked }));
    expect(setAppState).toHaveBeenCalledExactlyOnceWith(AppState.COVER);
    expect(setIsUnlocked).not.toHaveBeenCalled();
  });
  it('keeps existing protected vaults behind login', () => {
    const setAppState = vi.fn();
    const setIsUnlocked = vi.fn();
    renderHook(() =>
      useAppEntryRouting({
        loading: false,
        passwordHash: 'existing-hash',
        isUnlocked: false,
        setAppState,
        setIsUnlocked,
      }),
    );
    expect(setAppState).toHaveBeenCalledExactlyOnceWith(AppState.LOGIN);
    expect(setIsUnlocked).toHaveBeenCalledWith(false);
  });
  it('opens a fresh local vault directly and restores navigation', () => {
    const setAppState = vi.fn();
    const setIsUnlocked = vi.fn();
    renderHook(() =>
      useAppEntryRouting({
        loading: false,
        passwordHash: null,
        isUnlocked: false,
        setAppState,
        setIsUnlocked,
      }),
    );
    expect(setAppState).toHaveBeenCalledExactlyOnceWith(AppState.NOW);
    expect(setIsUnlocked).toHaveBeenCalledWith(true);
    act(() => {
      window.history.replaceState({}, '', '/past');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(setAppState).toHaveBeenLastCalledWith(AppState.PAST);
    expect(setAppState).not.toHaveBeenCalledWith(AppState.ONBOARDING);
  });
  it('waits for storage and does not interrupt vault creation when the password changes', () => {
    const setAppState = vi.fn();
    const setIsUnlocked = vi.fn();
    const { rerender } = renderHook(
      ({ loading, passwordHash }) =>
        useAppEntryRouting({
          loading,
          passwordHash,
          isUnlocked: false,
          setAppState,
          setIsUnlocked,
        }),
      { initialProps: { loading: true, passwordHash: null as string | null } },
    );
    expect(setAppState).not.toHaveBeenCalled();
    rerender({ loading: false, passwordHash: null });
    expect(setAppState).toHaveBeenCalledExactlyOnceWith(AppState.NOW);
    setAppState.mockClear();
    rerender({ loading: false, passwordHash: 'new-vault-hash' });
    expect(setAppState).not.toHaveBeenCalled();
    act(() => {
      window.history.replaceState({}, '', '/past');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(setAppState).toHaveBeenLastCalledWith(AppState.PAST);
  });
});
