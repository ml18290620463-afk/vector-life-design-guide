import { describe, expect, it } from 'vitest';
import { AppState } from '../types';
import {
  isNowSurfaceState,
  isPastSurfaceState,
  shouldShowGlobalBackground,
  shouldShowLoadingOverlay,
  shouldUseMobileShell,
} from './appShellRules';

describe('appShellRules', () => {
  it('uses the mobile shell only for mobile main tabs', () => {
    expect(shouldUseMobileShell(true, 'past')).toBe(true);
    expect(shouldUseMobileShell(true, null)).toBe(false);
    expect(shouldUseMobileShell(false, 'past')).toBe(false);
  });

  it('shows global background only behind main immersive surfaces', () => {
    expect(shouldShowGlobalBackground(AppState.DASHBOARD)).toBe(true);
    expect(shouldShowGlobalBackground(AppState.PAST)).toBe(true);
    expect(shouldShowGlobalBackground(AppState.LOGIN)).toBe(false);
    expect(shouldShowGlobalBackground(AppState.ONBOARDING)).toBe(false);
  });

  it('hides loading overlay on entry gate surfaces', () => {
    expect(shouldShowLoadingOverlay(true, AppState.DASHBOARD)).toBe(true);
    expect(shouldShowLoadingOverlay(true, AppState.COVER)).toBe(false);
    expect(shouldShowLoadingOverlay(false, AppState.DASHBOARD)).toBe(false);
  });

  it('groups past and now shell states', () => {
    expect(isPastSurfaceState(AppState.PAST)).toBe(true);
    expect(isPastSurfaceState(AppState.ARCHIVE)).toBe(true);
    expect(isPastSurfaceState(AppState.NOW)).toBe(false);
    expect(isNowSurfaceState(AppState.NOW)).toBe(true);
    expect(isNowSurfaceState(AppState.NOW_TAGS)).toBe(true);
    expect(isNowSurfaceState(AppState.NOW_AVATAR_CHAT)).toBe(true);
    expect(isNowSurfaceState(AppState.PAST)).toBe(false);
  });
});
