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

export const shouldShowLoadingOverlay = (loading: boolean, appState: AppState) =>
  loading && ![AppState.COVER, AppState.ONBOARDING, AppState.LOGIN].includes(appState);

export const isPastSurfaceState = (appState: AppState) => [AppState.PAST].includes(appState);

export const isNowSurfaceState = (appState: AppState) =>
  [AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT].includes(appState);
