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
import { preloadFuturePage, preloadPastRepository } from '../features/mobile/mobileLazyComponents';
import { preloadNowFlow } from '../features/now/nowLazyComponents';
import { preloadAvatarChatPage } from '../features/now/avatarChatLazy';

type UseAppMainNavigationOptions = {
  setAppState: (state: AppState) => void;
  setNowRoute: (route: NowRoute) => void;
};

export const useAppMainNavigation = ({ setAppState, setNowRoute }: UseAppMainNavigationOptions) => {
  const preloadMainModule = useCallback((tab: MobileMainTab) => {
    if (tab === 'past') return preloadPastRepository();
    if (tab === 'future') return preloadFuturePage();
    if (tab === 'now') return preloadNowFlow();
    if (tab === 'avatar') {
      return Promise.all([preloadNowFlow(), preloadAvatarChatPage()]);
    }
    return Promise.resolve();
  }, []);

  // Navigation feedback must never wait for a network chunk.
  const commitWhenReady = useCallback(
    (tab: MobileMainTab, commit: () => void) => {
      void preloadMainModule(tab).catch(() => undefined);
      commit();
    },
    [preloadMainModule],
  );

  const handleMobileTabChange = useCallback(
    (tab: MobileMainTab) => {
      commitWhenReady(tab, () => {
        navigateMobileTab(tab);
        rememberMainRoute(getMainTabPathname(tab));
        if (tab === 'avatar') {
          setNowRoute('avatar-chat');
        } else {
          setNowRoute('now');
        }
        setAppState(getMobileTabAppState(tab));
      });
    },
    [commitWhenReady, setAppState, setNowRoute],
  );

  const handleNowRouteChange = useCallback(
    (route: NowRoute) => {
      const tab: MobileMainTab = route === 'avatar-chat' || route === 'avatar-settings' ? 'avatar' : 'now';
      void preloadMainModule(tab).catch(() => undefined);
      rememberMainRoute(
        route === 'avatar-chat' ? '/avatar' : route === 'avatar-settings' ? '/now/avatar-settings' : route === 'tags' ? '/now/tags' : '/now',
      );
      if (isMobileExperience() && route === 'avatar-chat') navigateMobileTab(tab);
      else pushNowPath(route);
      setNowRoute(route);
      setAppState(getNowRouteAppState(route));
    },
    [preloadMainModule, setAppState, setNowRoute],
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
    commitWhenReady('past', () => {
      rememberMainRoute('/past');
      setAppState(AppState.PAST);
    });
  }, [commitWhenReady, handleMobileTabChange, setAppState]);

  const handleMainModuleNavigate = useCallback(
    (tab: MobileMainTab) => {
      if (isMobileExperience()) {
        handleMobileTabChange(tab);
        return;
      }
      if (tab === 'past') {
        commitWhenReady(tab, () => {
          pushAppPath(getMainTabPathname('past'), {});
          rememberMainRoute('/past');
          setNowRoute('now');
          setAppState(AppState.PAST);
        });
        return;
      }
      if (tab === 'future') {
        commitWhenReady(tab, () => {
          pushAppPath(getMainTabPathname('future'), {});
          rememberMainRoute('/future');
          setNowRoute('now');
          setAppState(AppState.FUTURE);
        });
        return;
      }
      if (tab === 'avatar') {
        commitWhenReady(tab, () => {
          pushAppPath(getMainTabPathname('avatar'), { nowRoute: 'avatar-chat' });
          rememberMainRoute('/avatar');
          setNowRoute('avatar-chat');
          setAppState(getMobileTabAppState(tab));
        });
        return;
      }
      if (tab === 'now') {
        commitWhenReady(tab, () => {
          pushAppPath(getMainTabPathname('now'), { nowRoute: 'now' });
          rememberMainRoute('/now');
          setNowRoute('now');
          setAppState(getMobileTabAppState(tab));
        });
      }
    },
    [commitWhenReady, handleMobileTabChange, setAppState, setNowRoute],
  );

  const returnToPast = useCallback(() => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
      return;
    }
    commitWhenReady('past', () => {
      if (typeof window !== 'undefined' && isNowSurfacePathname(window.location.pathname)) {
        pushAppPath(getMainTabPathname('past'), {});
      }
      rememberMainRoute('/past');
      setNowRoute('now');
      setAppState(AppState.PAST);
    });
  }, [commitWhenReady, handleMobileTabChange, setAppState, setNowRoute]);

  return {
    handleExitNow: returnToPast,
    handleMainModuleNavigate,
    handleMobileTabChange,
    handleNowRecordComplete: returnToPast,
    handleNowRouteChange,
    handleOpenArchive,
    handleOpenNow,
    preloadMainModule,
  };
};
