import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from '../types';
import { getMobileTabAppState, getMobileTabFromPath } from '../features/mobile/mobileRoutes';
import type { NowRoute } from '../features/now/types/now';
import {
  type AppEntryRouteAction,
  getCurrentRestorablePathname,
  getLastMainRoute,
  getNowRouteFromPath,
  getPostUnlockRouteAction,
  getPreviewScreen,
  getPreviewScreenAction,
  rememberMainRoute,
} from '../lib/appEntryRoutes';
import { isMobileExperience, replaceAppPath } from '../lib/previewMode';

type UseAppEntryRoutingOptions = {
  isUnlocked: boolean;
  loading: boolean;
  passwordHash: string | null;
  setAppState: (state: AppState) => void;
  setIsUnlocked: (isUnlocked: boolean) => void;
};

const getNowRouteAppState = (route: NowRoute): AppState => {
  if (route === 'tags') return AppState.NOW_TAGS;
  if (route === 'avatar-chat') return AppState.NOW_AVATAR_CHAT;
  return AppState.NOW;
};

export const useAppEntryRouting = ({
  isUnlocked,
  loading,
  passwordHash,
  setAppState,
  setIsUnlocked,
}: UseAppEntryRoutingOptions) => {
  const [nowRoute, setNowRoute] = useState<NowRoute>(() => getNowRouteFromPath() ?? 'now');
  const isUnlockedRef = useRef(isUnlocked);
  const pendingPathAfterUnlockRef = useRef<string | null>(null);

  useEffect(() => {
    isUnlockedRef.current = isUnlocked;
  }, [isUnlocked]);

  const routeToEntryGate = useCallback((requestedPath?: string | null) => {
    pendingPathAfterUnlockRef.current = requestedPath ?? getCurrentRestorablePathname() ?? getLastMainRoute();
    isUnlockedRef.current = false;
    setIsUnlocked(false);
    setAppState(passwordHash ? AppState.LOGIN : AppState.ONBOARDING);
  }, [passwordHash, setAppState, setIsUnlocked]);

  const applyEntryRouteAction = useCallback(
    (action: AppEntryRouteAction) => {
      if (action.kind === 'entry-gate') {
        routeToEntryGate();
        return;
      }

      if (action.lock) {
        isUnlockedRef.current = false;
        setIsUnlocked(false);
      }
      if (action.nowRoute) setNowRoute(action.nowRoute);
      if (action.replacePath) {
        replaceAppPath(action.replacePath, action.replaceState ?? {});
        rememberMainRoute(action.replacePath);
      }
      action.states.forEach(setAppState);
    },
    [routeToEntryGate, setAppState, setIsUnlocked],
  );

  const routeMainTabFromPath = useCallback(
    (tab: 'past' | 'now' | 'future' | 'avatar') => {
      if (!isUnlockedRef.current) {
        routeToEntryGate();
        return;
      }
      if (tab === 'past') {
        setNowRoute('now');
        rememberMainRoute('/past');
        setAppState(AppState.PAST);
        return;
      }
      if (tab === 'future') {
        setNowRoute('now');
        rememberMainRoute('/future');
        setAppState(getMobileTabAppState(tab));
        return;
      }
      if (tab === 'avatar') {
        setNowRoute('avatar-chat');
        rememberMainRoute('/avatar');
        setAppState(getMobileTabAppState(tab));
        return;
      }
      setNowRoute('now');
      rememberMainRoute('/now');
      setAppState(getMobileTabAppState(tab));
    },
    [routeToEntryGate, setAppState],
  );

  const routeNowPath = useCallback(
    (route: NowRoute) => {
      if (!isUnlockedRef.current) {
        routeToEntryGate();
        return;
      }
      setNowRoute(route);
      rememberMainRoute(route === 'avatar-chat' ? '/avatar' : route === 'tags' ? '/now/tags' : '/now');
      setAppState(getNowRouteAppState(route));
    },
    [routeToEntryGate, setAppState],
  );

  useEffect(() => {
    if (loading) return;
    const screen = getPreviewScreen();
    if (!screen) return;
    applyEntryRouteAction(
      getPreviewScreenAction(screen, {
        isMobile: isMobileExperience(),
        isUnlocked: isUnlockedRef.current,
      }),
    );
  }, [applyEntryRouteAction, loading]);

  const restoreCurrentOrStableRoute = useCallback(() => {
    const route = getNowRouteFromPath();
    if (route) {
      routeNowPath(route);
      return;
    }

    const mobileTab = getMobileTabFromPath();
    if (mobileTab) {
      routeMainTabFromPath(mobileTab);
      return;
    }

    const fallbackPath = getLastMainRoute();
    if (!isUnlockedRef.current) {
      routeToEntryGate(fallbackPath);
      return;
    }

    applyEntryRouteAction(getPostUnlockRouteAction(fallbackPath));
  }, [applyEntryRouteAction, routeMainTabFromPath, routeNowPath, routeToEntryGate]);

  useEffect(() => {
    if (loading) return;
    restoreCurrentOrStableRoute();
  }, [loading, restoreCurrentOrStableRoute]);

  useEffect(() => {
    const onPopState = () => {
      restoreCurrentOrStableRoute();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [restoreCurrentOrStableRoute]);

  const enterPendingOrPastMain = useCallback(() => {
    const target = pendingPathAfterUnlockRef.current;
    pendingPathAfterUnlockRef.current = null;
    applyEntryRouteAction(getPostUnlockRouteAction(target));
  }, [applyEntryRouteAction]);

  return { enterPendingOrPastMain, nowRoute, setNowRoute };
};
