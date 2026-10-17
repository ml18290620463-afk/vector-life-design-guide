import { lazy } from 'react';

type LazyModule<T> = Promise<{ default: T }>;

// Keep the exact Promise used by both preloading and React.lazy. Calling
// import() again after it has settled still produces a new Promise, which can
// make React briefly enter a Suspense fallback during an otherwise warm route.
let futurePageModule: LazyModule<typeof import('../future/FuturePage').FuturePage> | undefined;
let pastRepositoryModule: LazyModule<typeof import('./PastRepository').PastRepository> | undefined;
let mobileShellModule: LazyModule<typeof import('./MobileShell').MobileShell> | undefined;

const loadFuturePage = () =>
  (futurePageModule ??= import('../future/FuturePage').then((module) => ({ default: module.FuturePage })));
const loadPastRepository = () =>
  (pastRepositoryModule ??= import('./PastRepository').then((module) => ({ default: module.PastRepository })));
const loadMobileShell = () =>
  (mobileShellModule ??= import('./MobileShell').then((module) => ({ default: module.MobileShell })));

/** Start fetching a module before a navigation commits. Import caching makes this idempotent. */
export const preloadFuturePage = () => loadFuturePage();
export const preloadPastRepository = () => loadPastRepository();
export const preloadMobileShell = () => loadMobileShell();

export const FuturePage = lazy(loadFuturePage);
export const PastRepository = lazy(loadPastRepository);
export const MobileShell = lazy(loadMobileShell);
