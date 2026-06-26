import { AppState } from '../../types';
import { pushAppPath, replaceAppPath } from '../../lib/previewMode';
import type { MobileMainTab } from './types';

export const getMobileTabFromPath = (): MobileMainTab | null => {
  if (typeof window === 'undefined') return null;
  const { pathname } = window.location;
  if (pathname === '/past') return 'past';
  if (pathname === '/future') return 'future';
  if (pathname === '/avatar') return 'avatar';
  if (pathname === '/now' || pathname.startsWith('/now/')) return 'now';
  return null;
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

export const navigateMobileTab = (tab: MobileMainTab, options: { replace?: boolean } = {}) => {
  const path =
    tab === 'now' ? '/now' : tab === 'past' ? '/past' : tab === 'future' ? '/future' : '/avatar';
  const state =
    tab === 'avatar' ? { nowRoute: 'avatar-chat' } : tab === 'now' ? { nowRoute: 'now' } : {};
  if (options.replace) {
    replaceAppPath(path, state);
  } else {
    pushAppPath(path, state);
  }
};
