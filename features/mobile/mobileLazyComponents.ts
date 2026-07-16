import { lazy } from 'react';

export const PastRepository = lazy(() =>
  import('./PastRepository').then((module) => ({ default: module.PastRepository })),
);

export const FuturePlaceholder = lazy(() =>
  import('./FuturePlaceholder').then((module) => ({
    default: module.FuturePlaceholder,
  })),
);

export const MobileShell = lazy(() =>
  import('./MobileShell').then((module) => ({ default: module.MobileShell })),
);
