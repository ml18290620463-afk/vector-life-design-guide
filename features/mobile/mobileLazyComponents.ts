import { lazy } from 'react';

export const FuturePage = lazy(() => import('../future/FuturePage').then((module) => ({ default: module.FuturePage })));

export const PastRepository = lazy(() =>
  import('./PastRepository').then((module) => ({ default: module.PastRepository })),
);

export const MobileShell = lazy(() =>
  import('./MobileShell').then((module) => ({ default: module.MobileShell })),
);
