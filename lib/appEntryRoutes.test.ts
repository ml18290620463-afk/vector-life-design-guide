import { describe, expect, it } from 'vitest';
import { AppState } from '../types';
import {
  getPostUnlockRouteAction,
  getPreviewScreenAction,
  getPreviewScreenFromSearch,
} from './appEntryRoutes';

describe('appEntryRoutes', () => {
  it('parses known preview screens from query string', () => {
    expect(getPreviewScreenFromSearch('?preview=1&screen=now')).toBe('now');
    expect(getPreviewScreenFromSearch('?preview=true&screen=settings')).toBe('settings');
    expect(getPreviewScreenFromSearch('?screen=now')).toBeNull();
  });

  it('rejects unknown preview screens', () => {
    expect(getPreviewScreenFromSearch('?preview=1&screen=unknown')).toBeNull();
    expect(getPreviewScreenFromSearch('?preview=1')).toBeNull();
  });

  it('routes locked mobile preview links back to the entry gate', () => {
    expect(getPreviewScreenAction('now', { isMobile: true, isUnlocked: false })).toEqual({
      kind: 'entry-gate',
    });
  });

  it('keeps onboarding as an explicit locked route', () => {
    expect(getPreviewScreenAction('onboarding', { isMobile: true, isUnlocked: false })).toEqual({
      kind: 'route',
      states: [AppState.ONBOARDING],
      lock: true,
    });
  });

  it('maps preview screens to mobile-first states', () => {
    expect(getPreviewScreenAction('past', { isMobile: true, isUnlocked: true })).toMatchObject({
      kind: 'route',
      states: [AppState.PAST],
      replacePath: '/past',
    });
    expect(getPreviewScreenAction('future', { isMobile: true, isUnlocked: true })).toMatchObject({
      kind: 'route',
      states: [AppState.FUTURE],
      replacePath: '/future',
    });
    expect(getPreviewScreenAction('now', { isMobile: true, isUnlocked: true })).toMatchObject({
      kind: 'route',
      states: [AppState.NOW],
      nowRoute: 'now',
      replacePath: '/now',
    });
  });

  it('routes desktop past to the unified responsive Past surface', () => {
    expect(getPreviewScreenAction('past', { isMobile: false, isUnlocked: true })).toMatchObject({
      kind: 'route',
      states: [AppState.ARCHIVE],
      replacePath: '/past',
    });
  });

  it('restores the intended route after unlock', () => {
    expect(getPostUnlockRouteAction('/now/tags')).toMatchObject({
      kind: 'route',
      states: [AppState.NOW_TAGS],
      nowRoute: 'tags',
      replacePath: '/now/tags',
    });
    expect(getPostUnlockRouteAction('/future')).toMatchObject({
      kind: 'route',
      states: [AppState.FUTURE],
      replacePath: '/future',
    });
    expect(getPostUnlockRouteAction(null)).toMatchObject({
      kind: 'route',
      states: [AppState.PAST],
      nowRoute: 'now',
      replacePath: '/past',
    });
  });
});
