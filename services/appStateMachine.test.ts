import { describe, expect, it } from 'vitest';
import { AppState } from '../types';
import { canTransitionAppState, getAllowedAppStateTransitions } from './appStateMachine';

describe('appStateMachine', () => {
  it('allows the main app navigation flow', () => {
    expect(canTransitionAppState(AppState.COVER, AppState.ONBOARDING)).toBe(true);
    expect(canTransitionAppState(AppState.COVER, AppState.LOGIN)).toBe(true);
    expect(canTransitionAppState(AppState.LOGIN, AppState.PAST)).toBe(true);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.PAST)).toBe(true);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.NOW)).toBe(true);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.FUTURE)).toBe(true);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.NOW_AVATAR_CHAT)).toBe(true);
    expect(canTransitionAppState(AppState.PAST, AppState.NOW)).toBe(true);
    expect(canTransitionAppState(AppState.PAST, AppState.VIEWER)).toBe(true);
  });

  it('allows navigation among the four primary modules', () => {
    expect(canTransitionAppState(AppState.PAST, AppState.NOW)).toBe(true);
    expect(canTransitionAppState(AppState.NOW, AppState.PAST)).toBe(true);
    expect(canTransitionAppState(AppState.NOW, AppState.FUTURE)).toBe(true);
    expect(canTransitionAppState(AppState.FUTURE, AppState.NOW_AVATAR_CHAT)).toBe(true);
    expect(canTransitionAppState(AppState.NOW_AVATAR_CHAT, AppState.PAST)).toBe(true);
  });

  it('blocks unsafe direct jumps', () => {
    expect(canTransitionAppState(AppState.COVER, AppState.VIEWER)).toBe(false);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.VIEWER)).toBe(false);
  });

  it('includes current state as an allowed no-op transition', () => {
    expect(getAllowedAppStateTransitions(AppState.PAST)).toContain(AppState.PAST);
  });
});
