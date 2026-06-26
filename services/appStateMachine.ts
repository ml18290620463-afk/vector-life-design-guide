import { AppState } from '../types';

const ALLOWED_TRANSITIONS: Record<AppState, AppState[]> = {
  [AppState.COVER]: [
    AppState.ONBOARDING,
    AppState.LOGIN,
    AppState.DASHBOARD,
    AppState.ARCHIVE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.ONBOARDING]: [AppState.COVER, AppState.DASHBOARD, AppState.ARCHIVE, AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT],
  [AppState.LOGIN]: [AppState.COVER, AppState.DASHBOARD, AppState.ARCHIVE, AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT],
  [AppState.DASHBOARD]: [AppState.COVER, AppState.EDITOR, AppState.VIEWER, AppState.ARCHIVE, AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT],
  [AppState.EDITOR]: [AppState.COVER, AppState.DASHBOARD, AppState.ARCHIVE, AppState.NOW],
  [AppState.VIEWER]: [AppState.COVER, AppState.DASHBOARD, AppState.NOW],
  [AppState.ARCHIVE]: [AppState.COVER, AppState.DASHBOARD, AppState.EDITOR, AppState.VIEWER, AppState.NOW],
  [AppState.NOW]: [AppState.COVER, AppState.DASHBOARD, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT],
  [AppState.NOW_TAGS]: [AppState.NOW, AppState.DASHBOARD],
  [AppState.NOW_AVATAR_CHAT]: [AppState.NOW, AppState.NOW_TAGS, AppState.DASHBOARD],
};

export const canTransitionAppState = (from: AppState, to: AppState) =>
  from === to || ALLOWED_TRANSITIONS[from].includes(to);

export const getAllowedAppStateTransitions = (from: AppState) => [
  from,
  ...ALLOWED_TRANSITIONS[from],
];
