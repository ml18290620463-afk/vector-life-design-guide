import { AppState } from '../../types';
import { getMainTabFromPathname, getMainTabPathname } from '../../lib/appPathRules';
import { pushAppPath, replaceAppPath } from '../../lib/previewMode';
import type { MobileMainTab } from './types';
import type { NowRoute } from '../now/types/now';

export const getMobileTabFromPath = (): MobileMainTab | null => {
  if (typeof window === 'undefined') return null;
  return getMainTabFromPathname(window.location.pathname);
};

export const getMobileMainTab = (appState: AppState): MobileMainTab | null => {
  switch (appState) {
    case AppState.PAST:
    case AppState.ARCHIVE:
      return 'past';
    case AppState.NOW:
    case AppState.NOW_TAGS:
      return 'now';
    case AppState.FUTURE:
      return 'future';
    case AppState.NOW_AVATAR_CHAT:
      return 'avatar';
    default:
      return null;
  }
};

export const isMobileMainAppState = (appState: AppState) => getMobileMainTab(appState) !== null;

export const getNowRouteAppState = (route: NowRoute): AppState => {
  if (route === 'tags') return AppState.NOW_TAGS;
  if (route === 'avatar-chat') return AppState.NOW_AVATAR_CHAT;
  return AppState.NOW;
};

export const getMobileTabAppState = (tab: MobileMainTab): AppState => {
  if (tab === 'past') return AppState.PAST;
  if (tab === 'future') return AppState.FUTURE;
  if (tab === 'avatar') return AppState.NOW_AVATAR_CHAT;
  return AppState.NOW;
};

export const navigateMobileTab = (tab: MobileMainTab, options: { replace?: boolean } = {}) => {
  const path = getMainTabPathname(tab);
  const state =
    tab === 'avatar' ? { nowRoute: 'avatar-chat' } : tab === 'now' ? { nowRoute: 'now' } : {};
  if (options.replace) {
    replaceAppPath(path, state);
  } else {
    pushAppPath(path, state);
  }
};
