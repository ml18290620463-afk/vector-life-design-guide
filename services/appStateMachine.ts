import { AppState } from '../types';

const ALLOWED_TRANSITIONS: Record<AppState, AppState[]> = {
  [AppState.COVER]: [AppState.ONBOARDING, AppState.DASHBOARD],
  [AppState.ONBOARDING]: [AppState.COVER, AppState.DASHBOARD],
  [AppState.DASHBOARD]: [AppState.COVER, AppState.EDITOR, AppState.VIEWER, AppState.ARCHIVE],
  [AppState.EDITOR]: [AppState.COVER, AppState.DASHBOARD],
  [AppState.VIEWER]: [AppState.COVER, AppState.DASHBOARD],
  [AppState.ARCHIVE]: [AppState.COVER, AppState.DASHBOARD, AppState.VIEWER],
};

export const canTransitionAppState = (from: AppState, to: AppState) =>
  from === to || ALLOWED_TRANSITIONS[from].includes(to);

export const getAllowedAppStateTransitions = (from: AppState) => [
  from,
  ...ALLOWED_TRANSITIONS[from],
];
