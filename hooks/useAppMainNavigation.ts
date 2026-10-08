import { useCallback } from 'react';
import { AppState } from '../types';
import { getMainTabPathname, isNowSurfacePathname } from '../lib/appPathRules';
import { pushNowPath, rememberMainRoute } from '../lib/appEntryRoutes';
import { isMobileExperience, pushAppPath } from '../lib/previewMode';
import {
  getMobileTabAppState,
  getNowRouteAppState,
  navigateMobileTab,
} from '../features/mobile/mobileRoutes';
import type { MobileMainTab } from '../features/mobile/types';
import type { NowRoute } from '../features/now/types/now';

type UseAppMainNavigationOptions = {
  setAppState: (state: AppState) => void;
  setNowRoute: (route: NowRoute) => void;
};

export const useAppMainNavigation = ({ setAppState, setNowRoute }: UseAppMainNavigationOptions) => {
  const handleMobileTabChange = useCallback(
    (tab: MobileMainTab) => {
      navigateMobileTab(tab);
      rememberMainRoute(getMainTabPathname(tab));
      if (tab === 'avatar') {
        setNowRoute('avatar-chat');
      } else if (tab === 'now') {
        setNowRoute('now');
      }
      setAppState(getMobileTabAppState(tab));
    },
    [setAppState, setNowRoute],
  );

  const handleNowRouteChange = useCallback(
    (route: NowRoute) => {
      setNowRoute(route);
      rememberMainRoute(route === 'avatar-chat' ? '/avatar' : route === 'tags' ? '/now/tags' : '/now');
      if (isMobileExperience() && route === 'avatar-chat') {
        navigateMobileTab('avatar');
        setAppState(getNowRouteAppState(route));
        return;
      }
      pushNowPath(route);
      setAppState(getNowRouteAppState(route));
    },
    [setAppState, setNowRoute],
  );

  const handleOpenNow = useCallback(
    (route: NowRoute = 'now') => {
      handleNowRouteChange(route);
    },
    [handleNowRouteChange],
  );

  const handleOpenArchive = useCallback(() => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
      return;
    }
    rememberMainRoute('/past');
    setAppState(AppState.PAST);
  }, [handleMobileTabChange, setAppState]);

  const handleMainModuleNavigate = useCallback(
    (tab: MobileMainTab) => {
      if (isMobileExperience()) {
        handleMobileTabChange(tab);
        return;
      }
      if (tab === 'past') {
        pushAppPath(getMainTabPathname('past'), {});
        rememberMainRoute('/past');
        setNowRoute('now');
        setAppState(AppState.PAST);
        return;
      }
      if (tab === 'future') {
        pushAppPath(getMainTabPathname('future'), {});
        rememberMainRoute('/future');
        setNowRoute('now');
        setAppState(AppState.FUTURE);
        return;
      }
      if (tab === 'avatar') {
        pushAppPath(getMainTabPathname('avatar'), { nowRoute: 'avatar-chat' });
        rememberMainRoute('/avatar');
        setNowRoute('avatar-chat');
        setAppState(getMobileTabAppState(tab));
        return;
      }
      if (tab === 'now') {
        pushAppPath(getMainTabPathname('now'), { nowRoute: 'now' });
        rememberMainRoute('/now');
        setNowRoute('now');
        setAppState(getMobileTabAppState(tab));
      }
    },
    [handleMobileTabChange, setAppState, setNowRoute],
  );

  const returnToPast = useCallback(() => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
      return;
    }
    if (typeof window !== 'undefined' && isNowSurfacePathname(window.location.pathname)) {
      pushAppPath(getMainTabPathname('past'), {});
    }
    rememberMainRoute('/past');
    setNowRoute('now');
    setAppState(AppState.PAST);
  }, [handleMobileTabChange, setAppState, setNowRoute]);

  return {
    handleExitNow: returnToPast,
    handleMainModuleNavigate,
    handleMobileTabChange,
    handleNowRecordComplete: returnToPast,
    handleNowRouteChange,
    handleOpenArchive,
    handleOpenNow,
  };
};
