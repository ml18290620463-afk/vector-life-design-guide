import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../types';
import { isMobileExperience, pushAppPath } from '../lib/previewMode';
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

vi.mock('../features/mobile/mobileLazyComponents', () => ({
  preloadFuturePage: vi.fn(() => Promise.resolve()),
  preloadPastRepository: vi.fn(() => Promise.resolve()),
}));
vi.mock('../features/now/nowLazyComponents', () => ({
  preloadNowFlow: vi.fn(() => Promise.resolve()),
}));
vi.mock('../features/now/avatarChatLazy', () => ({
  preloadAvatarChatPage: vi.fn(() => Promise.resolve()),
}));

describe('useAppMainNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMobileExperience).mockReturnValue(false);
  });

  it('leaves the avatar route cleanly when navigating to Past on desktop', async () => {
    const setAppState = vi.fn();
    const setNowRoute = vi.fn();
    const { result } = renderHook(() => useAppMainNavigation({ setAppState, setNowRoute }));

    await act(async () => result.current.handleMainModuleNavigate('avatar'));
    await act(async () => result.current.handleMainModuleNavigate('past'));

    expect(pushAppPath).toHaveBeenNthCalledWith(1, '/avatar', { nowRoute: 'avatar-chat' });
    expect(pushAppPath).toHaveBeenNthCalledWith(2, '/past', {});
    expect(setNowRoute).toHaveBeenNthCalledWith(1, 'avatar-chat');
    expect(setNowRoute).toHaveBeenNthCalledWith(2, 'now');
    expect(setAppState).toHaveBeenNthCalledWith(1, AppState.NOW_AVATAR_CHAT);
    expect(setAppState).toHaveBeenNthCalledWith(2, AppState.PAST);
    expect(rememberMainRoute).toHaveBeenNthCalledWith(1, '/avatar');
    expect(rememberMainRoute).toHaveBeenNthCalledWith(2, '/past');
  });

  it.each(['past', 'future'] as const)(
    'leaves the avatar subroute when navigating to %s on mobile',
    async (tab) => {
      vi.mocked(isMobileExperience).mockReturnValue(true);
      const setAppState = vi.fn();
      const setNowRoute = vi.fn();
      const { result } = renderHook(() => useAppMainNavigation({ setAppState, setNowRoute }));
      await act(async () => result.current.handleMainModuleNavigate('avatar'));
      await act(async () => result.current.handleMainModuleNavigate(tab));
      expect(setNowRoute).toHaveBeenLastCalledWith('now');
      expect(setAppState).toHaveBeenLastCalledWith(
        tab === 'past' ? AppState.PAST : AppState.FUTURE,
      );
      vi.mocked(isMobileExperience).mockReturnValue(false);
    },
  );

  it('clears the avatar subroute when navigating to Future on desktop', async () => {
    const setAppState = vi.fn();
    const setNowRoute = vi.fn();
    const { result } = renderHook(() => useAppMainNavigation({ setAppState, setNowRoute }));

    await act(async () => result.current.handleMainModuleNavigate('future'));

    expect(pushAppPath).toHaveBeenCalledWith('/future', {});
    expect(setNowRoute).toHaveBeenCalledWith('now');
    expect(setAppState).toHaveBeenCalledWith(AppState.FUTURE);
    expect(rememberMainRoute).toHaveBeenCalledWith('/future');
  });
});

it.each([false, true])(
  'only commits the latest request when an earlier chunk resolves late (mobile=%s)',
  async (mobile) => {
    vi.mocked(isMobileExperience).mockReturnValue(mobile);
    const { preloadPastRepository } = await import('../features/mobile/mobileLazyComponents');
    let resolvePast!: () => void;
    vi.mocked(preloadPastRepository).mockReturnValueOnce(
      new Promise<Awaited<ReturnType<typeof preloadPastRepository>>>((resolve) => {
        resolvePast = () => resolve({ default: () => null });
      }),
    );
    const setAppState = vi.fn();
    const setNowRoute = vi.fn();
    const { result } = renderHook(() => useAppMainNavigation({ setAppState, setNowRoute }));
    act(() => result.current.handleMainModuleNavigate('past'));
    expect(setAppState).not.toHaveBeenCalled();
    await act(async () => result.current.handleMainModuleNavigate('future'));
    expect(setAppState).toHaveBeenCalledExactlyOnceWith(AppState.FUTURE);
    await act(async () => resolvePast());
    expect(setAppState).toHaveBeenCalledExactlyOnceWith(AppState.FUTURE);
  },
);
