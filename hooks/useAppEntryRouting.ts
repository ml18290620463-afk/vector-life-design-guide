import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from '../types';
import { getMobileTabAppState, getMobileTabFromPath } from '../features/mobile/mobileRoutes';
import type { NowRoute } from '../features/now/types/now';
import {
  type AppEntryRouteAction,
  getCurrentRestorablePathname,
  getNowRouteFromPath,
  getPostUnlockRouteAction,
  getPreviewScreen,
  getPreviewScreenAction,
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

  const routeToEntryGate = useCallback(() => {
    pendingPathAfterUnlockRef.current = getCurrentRestorablePathname();
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
      if (action.replacePath) replaceAppPath(action.replacePath, action.replaceState ?? {});
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
        if (isMobileExperience()) {
          setAppState(AppState.PAST);
        } else {
          setAppState(AppState.ARCHIVE);
        }
        return;
      }
      if (tab === 'future') {
        setAppState(getMobileTabAppState(tab));
        return;
      }
      if (tab === 'avatar') {
        setNowRoute('avatar-chat');
        setAppState(getMobileTabAppState(tab));
        return;
      }
      setNowRoute('now');
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

  useEffect(() => {
    if (loading) return;
    const route = getNowRouteFromPath();
    if (route) {
      routeNowPath(route);
      return;
    }

    const mobileTab = getMobileTabFromPath();
    if (mobileTab) routeMainTabFromPath(mobileTab);
  }, [loading, routeMainTabFromPath, routeNowPath]);

  useEffect(() => {
    const onPopState = () => {
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

      if (isMobileExperience()) {
        routeMainTabFromPath('now');
        return;
      }
      setAppState(AppState.DASHBOARD);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [routeMainTabFromPath, routeNowPath, setAppState]);

  const enterPendingOrPastMain = useCallback(() => {
    const target = pendingPathAfterUnlockRef.current;
    pendingPathAfterUnlockRef.current = null;
    applyEntryRouteAction(getPostUnlockRouteAction(target));
  }, [applyEntryRouteAction]);

  return { enterPendingOrPastMain, nowRoute, setNowRoute };
};
