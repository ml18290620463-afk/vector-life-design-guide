import { useCallback } from 'react';
import { AppState } from '../types';
import { getMainTabPathname, isNowSurfacePathname } from '../lib/appPathRules';
import { pushNowPath } from '../lib/appEntryRoutes';
import { isMobileExperience, replaceAppPath } from '../lib/previewMode';
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

export const useAppMainNavigation = ({
  setAppState,
  setNowRoute,
}: UseAppMainNavigationOptions) => {
  const handleMobileTabChange = useCallback(
    (tab: MobileMainTab) => {
      navigateMobileTab(tab, { replace: true });
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
      if (isMobileExperience() && route === 'avatar-chat') {
        navigateMobileTab('avatar', { replace: true });
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
    setAppState(AppState.ARCHIVE);
  }, [handleMobileTabChange, setAppState]);

  const handleMainModuleNavigate = useCallback(
    (tab: MobileMainTab) => {
      if (isMobileExperience()) {
        handleMobileTabChange(tab);
        return;
      }
      if (tab === 'past') {
        replaceAppPath(getMainTabPathname('past'), {});
        setAppState(AppState.ARCHIVE);
        return;
      }
      if (tab === 'future') {
        replaceAppPath(getMainTabPathname('future'), {});
        setAppState(AppState.FUTURE);
        return;
      }
      if (tab === 'avatar') {
        replaceAppPath(getMainTabPathname('avatar'), { nowRoute: 'avatar-chat' });
        setNowRoute('avatar-chat');
        setAppState(getMobileTabAppState(tab));
        return;
      }
      if (tab === 'now') {
        replaceAppPath(getMainTabPathname('now'), { nowRoute: 'now' });
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
      replaceAppPath(getMainTabPathname('past'), {});
    }
    setNowRoute('now');
    setAppState(AppState.ARCHIVE);
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
