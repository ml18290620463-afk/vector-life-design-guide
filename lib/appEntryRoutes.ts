import { pushAppPath } from './previewMode';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, removeStoredValue, setStoredString } from '../services/browserStorage';
import {
  getMainTabFromPathname,
  getMainTabPathname,
  getNowPathname,
  getNowRouteFromPathname,
  getRestorablePathname,
  type AppNowRoutePath,
} from './appPathRules';
import { AppState } from '../types';

export type PreviewScreen =
  | 'dashboard'
  | 'future'
  | 'editor'
  | 'now'
  | 'onboarding'
  | 'settings'
  | 'archive'
  | 'past';

const previewScreens = new Set<PreviewScreen>([
  'dashboard',
  'future',
  'editor',
  'now',
  'onboarding',
  'settings',
  'archive',
  'past',
]);

export const getPreviewScreenFromSearch = (search: string): PreviewScreen | null => {
  const params = new URLSearchParams(search);
  if (params.get('preview') !== 'mobile' && params.get('preview') !== 'web') return null;
  const screen = params.get('screen');
  return screen && previewScreens.has(screen as PreviewScreen) ? (screen as PreviewScreen) : null;
};

export const getPreviewScreen = () => {
  if (typeof window === 'undefined') return null;
  return getPreviewScreenFromSearch(window.location.search);
};

export const getNowRouteFromPath = (): AppNowRoutePath | null => {
  if (typeof window === 'undefined') return null;
  return getNowRouteFromPathname(window.location.pathname);
};

export const pushNowPath = (route: AppNowRoutePath) => {
  if (typeof window === 'undefined') return;
  pushAppPath(getNowPathname(route), { nowRoute: route });
};

export const getCurrentRestorablePathname = (): string | null => {
  if (typeof window === 'undefined') return null;
  return getRestorablePathname(window.location.pathname);
};

/**
 * The root URL is an application entry point, not the introductory cover.
 * Only canonical module paths are persisted; record, dialog, and query state
 * deliberately remain outside this recovery contract.
 */
const getCanonicalMainRoute = (pathname: string): string | null => {
  const nowRoute = getNowRouteFromPathname(pathname);
  if (nowRoute) return getNowPathname(nowRoute);

  const tab = getMainTabFromPathname(pathname);
  return tab && pathname === getMainTabPathname(tab) ? pathname : null;
};

export const getLastMainRoute = (): string | null => {
  const storedPath = getStoredString(AppStorageKeys.lastMainRoute);
  if (!storedPath) return null;

  const canonicalPath = getCanonicalMainRoute(storedPath);
  if (canonicalPath) return canonicalPath;

  removeStoredValue(AppStorageKeys.lastMainRoute);
  return null;
};

export const rememberMainRoute = (pathname: string) => {
  const canonicalPath = getCanonicalMainRoute(pathname);
  if (canonicalPath) setStoredString(AppStorageKeys.lastMainRoute, canonicalPath);
};

export type AppEntryRouteAction =
  | { kind: 'entry-gate' }
  | {
      kind: 'route';
      states: AppState[];
      nowRoute?: AppNowRoutePath;
      replacePath?: string;
      replaceState?: Record<string, unknown>;
      lock?: boolean;
    };

const getNowRouteState = (route: AppNowRoutePath): AppState => {
  if (route === 'tags') return AppState.NOW_TAGS;
  if (route === 'avatar-chat') return AppState.NOW_AVATAR_CHAT;
  return AppState.NOW;
};

export const getPreviewScreenAction = (
  screen: PreviewScreen,
  options: { isMobile: boolean; isUnlocked: boolean },
): AppEntryRouteAction => {
  if (screen === 'onboarding') {
    return { kind: 'route', states: [AppState.ONBOARDING], lock: true };
  }

  if (options.isMobile && !options.isUnlocked) {
    return { kind: 'entry-gate' };
  }

  if (screen === 'now') {
    return {
      kind: 'route',
      states: [AppState.NOW],
      nowRoute: 'now',
      replacePath: getMainTabPathname('now'),
      replaceState: { nowRoute: 'now' },
    };
  }

  if (screen === 'editor') {
    return {
      kind: 'route',
      states: [AppState.NOW],
      nowRoute: 'now',
      replacePath: getMainTabPathname('now'),
      replaceState: { nowRoute: 'now' },
    };
  }

  if (screen === 'archive' || screen === 'past') {
    return { kind: 'route', states: [AppState.PAST], replacePath: getMainTabPathname('past') };
  }

  if (screen === 'future') {
    return options.isMobile
      ? { kind: 'route', states: [AppState.FUTURE], replacePath: getMainTabPathname('future') }
      : { kind: 'route', states: [AppState.DASHBOARD] };
  }

  return { kind: 'route', states: [AppState.DASHBOARD] };
};

export const getPostUnlockRouteAction = (targetPathname: string | null): AppEntryRouteAction => {
  const pastAction: AppEntryRouteAction = {
    kind: 'route',
    states: [AppState.PAST],
    nowRoute: 'now',
    replacePath: getMainTabPathname('past'),
  };

  const resolvedTarget = targetPathname ?? getLastMainRoute();
  if (!resolvedTarget) return pastAction;

  const targetNowRoute = getNowRouteFromPathname(resolvedTarget);
  if (targetNowRoute) {
    return {
      kind: 'route',
      states: [getNowRouteState(targetNowRoute)],
      nowRoute: targetNowRoute,
      replacePath: getNowPathname(targetNowRoute),
      replaceState: { nowRoute: targetNowRoute },
    };
  }

  const targetTab = getMainTabFromPathname(resolvedTarget);
  if (targetTab === 'future') {
    return { kind: 'route', states: [AppState.FUTURE], replacePath: getMainTabPathname('future') };
  }

  return pastAction;
};
