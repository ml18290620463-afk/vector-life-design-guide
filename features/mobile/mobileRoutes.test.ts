import { describe, expect, it, vi, afterEach } from 'vitest';
import { AppState } from '../../types';
import {
  getMobileMainTab,
  getMobileTabAppState,
  getNowRouteAppState,
  navigateMobileTab,
} from './mobileRoutes';

describe('mobileRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('maps app state to mobile tab', () => {
    expect(getMobileMainTab(AppState.PAST)).toBe('past');
    expect(getMobileMainTab(AppState.NOW_TAGS)).toBe('now');
    expect(getMobileMainTab(AppState.NOW_AVATAR_CHAT)).toBe('avatar');
    expect(getMobileMainTab(AppState.FUTURE)).toBe('future');
  });

  it('maps now routes and mobile tabs to app states', () => {
    expect(getNowRouteAppState('now')).toBe(AppState.NOW);
    expect(getNowRouteAppState('tags')).toBe(AppState.NOW_TAGS);
    expect(getNowRouteAppState('avatar-chat')).toBe(AppState.NOW_AVATAR_CHAT);
    expect(getMobileTabAppState('past')).toBe(AppState.PAST);
    expect(getMobileTabAppState('avatar')).toBe(AppState.NOW_AVATAR_CHAT);
  });

  it('navigates avatar tab to avatar path with route state', () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    navigateMobileTab('avatar', { replace: true });

    expect(replaceSpy).toHaveBeenCalledWith({ nowRoute: 'avatar-chat' }, '', '/avatar');
  });
});
