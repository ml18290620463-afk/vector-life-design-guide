import { describe, expect, it } from 'vitest';
import { AppState } from '../types';
import { canTransitionAppState, getAllowedAppStateTransitions } from './appStateMachine';

describe('appStateMachine', () => {
  it('allows the main app navigation flow', () => {
    expect(canTransitionAppState(AppState.COVER, AppState.ONBOARDING)).toBe(true);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.DASHBOARD)).toBe(true);
    expect(canTransitionAppState(AppState.DASHBOARD, AppState.EDITOR)).toBe(true);
    expect(canTransitionAppState(AppState.EDITOR, AppState.DASHBOARD)).toBe(true);
    expect(canTransitionAppState(AppState.ARCHIVE, AppState.VIEWER)).toBe(true);
  });

  it('blocks unsafe direct jumps', () => {
    expect(canTransitionAppState(AppState.COVER, AppState.VIEWER)).toBe(false);
    expect(canTransitionAppState(AppState.COVER, AppState.EDITOR)).toBe(false);
    expect(canTransitionAppState(AppState.ONBOARDING, AppState.VIEWER)).toBe(false);
  });

  it('includes current state as an allowed no-op transition', () => {
    expect(getAllowedAppStateTransitions(AppState.DASHBOARD)).toContain(AppState.DASHBOARD);
  });
});
