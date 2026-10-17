import { lazy } from 'react';

let nowFlowModule: Promise<{ default: typeof import('./NowFlow').NowFlow }> | undefined;

const loadNowFlow = () =>
  (nowFlowModule ??= import('./NowFlow').then((module) => ({ default: module.NowFlow })));

export const preloadNowFlow = () => loadNowFlow();

export const NowFlow = lazy(loadNowFlow);
