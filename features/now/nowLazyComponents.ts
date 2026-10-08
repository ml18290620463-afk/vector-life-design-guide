import { lazy } from 'react';

export const NowFlow = lazy(() =>
  import('./NowFlow').then((module) => ({ default: module.NowFlow })),
);
