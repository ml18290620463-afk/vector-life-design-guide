import { AppState } from '../types';

const MAIN_MOBILE_STATES = [
  AppState.PAST,
  AppState.NOW,
  AppState.NOW_TAGS,
  AppState.FUTURE,
  AppState.NOW_AVATAR_CHAT,
] as const;

const MAIN_SURFACES = [
  AppState.VIEWER,
  AppState.PAST,
  AppState.FUTURE,
  AppState.NOW,
  AppState.NOW_TAGS,
  AppState.NOW_AVATAR_CHAT,
] as const;

const ALLOWED_TRANSITIONS: Record<AppState, AppState[]> = {
  [AppState.COVER]: [
    AppState.ONBOARDING,
    AppState.LOGIN,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.ONBOARDING]: [
    AppState.COVER,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.LOGIN]: [
    AppState.COVER,
    AppState.PAST,
    AppState.FUTURE,
    AppState.NOW,
    AppState.NOW_TAGS,
    AppState.NOW_AVATAR_CHAT,
  ],
  [AppState.VIEWER]: [AppState.COVER, AppState.PAST, AppState.NOW, AppState.NOW_AVATAR_CHAT],
  [AppState.PAST]: [...MAIN_SURFACES.filter((state) => state !== AppState.PAST)],
  [AppState.FUTURE]: [...MAIN_SURFACES.filter((state) => state !== AppState.FUTURE)],
  [AppState.NOW]: [...MAIN_SURFACES.filter((state) => state !== AppState.NOW)],
  [AppState.NOW_TAGS]: [...MAIN_SURFACES.filter((state) => state !== AppState.NOW_TAGS)],
  [AppState.NOW_AVATAR_CHAT]: [
    ...MAIN_SURFACES.filter((state) => state !== AppState.NOW_AVATAR_CHAT),
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
