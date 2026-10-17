import { AppState } from '../types';
import type { MobileMainTab } from '../features/mobile/types';

export const shouldUseMobileShell = (isMobile: boolean, mobileMainTab: MobileMainTab | null) =>
  isMobile && mobileMainTab !== null;

export const shouldShowGlobalBackground = (appState: AppState) =>
  [
    AppState.VIEWER,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ].includes(appState);

/**
 * Main modules remain available while IndexedDB refreshes in the background.
 *
 * A vault read can legitimately outlive navigation and used to place a fixed,
 * full-screen loader above Past, Now, Future, and Avatar. That made a ready
 * screen feel stalled even though it could already render its last known (or
 * empty) state. Entry-gate screens own their own initial loading fallbacks, so
 * there is no main-shell case that should block the entire interface here.
 */
export const shouldShowLoadingOverlay = (_loading: boolean, _appState: AppState) => false;

export const isPastSurfaceState = (appState: AppState) => [AppState.PAST].includes(appState);

export const isNowSurfaceState = (appState: AppState) =>
  [AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT].includes(appState);
