import { lazy } from 'react';

export const CoverScreen = lazy(() =>
  import('./CoverScreen').then((module) => ({ default: module.CoverScreen })),
);

export const SpaceTimeBackground = lazy(() =>
  import('./SpaceTimeBackground').then((module) => ({
    default: module.SpaceTimeBackground,
  })),
);

export const Dashboard = lazy(() =>
  import('./Dashboard').then((module) => ({ default: module.Dashboard })),
);

export const Onboarding = lazy(() =>
  import('./Onboarding').then((module) => ({ default: module.Onboarding })),
);

export const MasterLock = lazy(() =>
  import('./MasterLock').then((module) => ({ default: module.MasterLock })),
);

export const CommandPalette = lazy(() =>
  import('./CommandPalette').then((module) => ({ default: module.CommandPalette })),
);

export const Viewer = lazy(() => import('./Viewer').then((module) => ({ default: module.Viewer })));
