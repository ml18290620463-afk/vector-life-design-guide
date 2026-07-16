import { pushAppPath } from './previewMode';
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
  if (!params.get('preview')) return null;
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
    return options.isMobile
      ? { kind: 'route', states: [AppState.PAST], replacePath: getMainTabPathname('past') }
      : { kind: 'route', states: [AppState.ARCHIVE], replacePath: getMainTabPathname('past') };
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

  if (!targetPathname) return pastAction;

  const targetNowRoute = getNowRouteFromPathname(targetPathname);
  if (targetNowRoute) {
    return {
      kind: 'route',
      states: [getNowRouteState(targetNowRoute)],
      nowRoute: targetNowRoute,
      replacePath: targetPathname,
      replaceState: { nowRoute: targetNowRoute },
    };
  }

  const targetTab = getMainTabFromPathname(targetPathname);
  if (targetTab === 'future') {
    return { kind: 'route', states: [AppState.FUTURE], replacePath: getMainTabPathname('future') };
  }

  return pastAction;
};
