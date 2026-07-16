import { AppState } from '../types';

const MAIN_MOBILE_STATES = [
  AppState.PAST,
  AppState.ARCHIVE,
  AppState.NOW,
  AppState.NOW_TAGS,
  AppState.FUTURE,
  AppState.NOW_AVATAR_CHAT,
] as const;

const ALLOWED_TRANSITIONS: Record<AppState, AppState[]> = {
  [AppState.COVER]: [
    AppState.ONBOARDING,
    AppState.LOGIN,
    AppState.DASHBOARD,
    AppState.ARCHIVE,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.ONBOARDING]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.LOGIN]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.ARCHIVE,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.DASHBOARD]: [
    AppState.COVER,
    AppState.VIEWER,
    AppState.ARCHIVE,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.VIEWER]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.PAST,
    AppState.NOW,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.ARCHIVE]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.VIEWER,
    AppState.PAST,
    AppState.NOW,
    AppState.FUTURE,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.PAST]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.VIEWER,
    AppState.ARCHIVE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.FUTURE,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.FUTURE]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.PAST,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.NOW]: [
    AppState.COVER,
    AppState.DASHBOARD,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.NOW_TAGS]: [AppState.NOW, AppState.DASHBOARD, AppState.PAST, AppState.FUTURE],
  [AppState.NOW_AVATAR_CHAT]: [
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.DASHBOARD,
    AppState.PAST,
    AppState.FUTURE,
  ],
};

export const canTransitionAppState = (from: AppState, to: AppState) =>
  from === to || ALLOWED_TRANSITIONS[from].includes(to);

export const getAllowedAppStateTransitions = (from: AppState) => [
  from,
  ...ALLOWED_TRANSITIONS[from],
];

export const isMobileMainFrameworkState = (state: AppState) =>
  MAIN_MOBILE_STATES.includes(state as (typeof MAIN_MOBILE_STATES)[number]);
