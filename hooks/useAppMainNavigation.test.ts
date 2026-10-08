import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../types';
import { pushAppPath } from '../lib/previewMode';
import { rememberMainRoute } from '../lib/appEntryRoutes';
import { useAppMainNavigation } from './useAppMainNavigation';

vi.mock('../lib/previewMode', () => ({
  isMobileExperience: vi.fn(() => false),
  pushAppPath: vi.fn(),
}));

vi.mock('../lib/appEntryRoutes', () => ({
  pushNowPath: vi.fn(),
  rememberMainRoute: vi.fn(),
}));

describe('useAppMainNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leaves the avatar route cleanly when navigating to Past on desktop', () => {
    const setAppState = vi.fn();
    const setNowRoute = vi.fn();
    const { result } = renderHook(() => useAppMainNavigation({ setAppState, setNowRoute }));

    act(() => result.current.handleMainModuleNavigate('avatar'));
    act(() => result.current.handleMainModuleNavigate('past'));

    expect(pushAppPath).toHaveBeenNthCalledWith(1, '/avatar', { nowRoute: 'avatar-chat' });
    expect(pushAppPath).toHaveBeenNthCalledWith(2, '/past', {});
    expect(setNowRoute).toHaveBeenNthCalledWith(1, 'avatar-chat');
    expect(setNowRoute).toHaveBeenNthCalledWith(2, 'now');
    expect(setAppState).toHaveBeenNthCalledWith(1, AppState.NOW_AVATAR_CHAT);
    expect(setAppState).toHaveBeenNthCalledWith(2, AppState.PAST);
    expect(rememberMainRoute).toHaveBeenNthCalledWith(1, '/avatar');
    expect(rememberMainRoute).toHaveBeenNthCalledWith(2, '/past');
  });

  it('clears the avatar subroute when navigating to Future on desktop', () => {
    const setAppState = vi.fn();
    const setNowRoute = vi.fn();
    const { result } = renderHook(() => useAppMainNavigation({ setAppState, setNowRoute }));

    act(() => result.current.handleMainModuleNavigate('future'));

    expect(pushAppPath).toHaveBeenCalledWith('/future', {});
    expect(setNowRoute).toHaveBeenCalledWith('now');
    expect(setAppState).toHaveBeenCalledWith(AppState.FUTURE);
    expect(rememberMainRoute).toHaveBeenCalledWith('/future');
  });
});
