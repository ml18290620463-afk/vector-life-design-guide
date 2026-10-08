import { afterEach, describe, expect, it } from 'vitest';
import { AppState } from '../types';
import {
  getPostUnlockRouteAction,
  getPreviewScreenAction,
  getPreviewScreenFromSearch,
  getLastMainRoute,
  rememberMainRoute,
} from './appEntryRoutes';
import { AppStorageKeys } from '../services/appSettings';

describe('appEntryRoutes', () => {
  afterEach(() => localStorage.clear());
  it('parses known preview screens from query string', () => {
    expect(getPreviewScreenFromSearch('?preview=web&screen=now')).toBe('now');
    expect(getPreviewScreenFromSearch('?preview=mobile&screen=settings')).toBe('settings');
    expect(getPreviewScreenFromSearch('?preview=recovered-draft&screen=now')).toBeNull();
    expect(getPreviewScreenFromSearch('?preview=1&screen=now')).toBeNull();
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
      states: [AppState.PAST],
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

  it('persists only canonical main routes for root entry recovery', () => {
    rememberMainRoute('/now/avatar-chat');
    expect(getLastMainRoute()).toBe('/avatar');

    rememberMainRoute('/now/unsupported');
    expect(getLastMainRoute()).toBe('/avatar');

    rememberMainRoute('/viewer/private-entry');
    expect(getLastMainRoute()).toBe('/avatar');
  });

  it('discards invalid saved recovery routes', () => {
    localStorage.setItem(AppStorageKeys.lastMainRoute, '/viewer/private-entry');

    expect(getLastMainRoute()).toBeNull();
    expect(localStorage.getItem(AppStorageKeys.lastMainRoute)).toBeNull();
  });

  it('uses the stored main route when unlock has no explicit target', () => {
    rememberMainRoute('/future');

    expect(getPostUnlockRouteAction(null)).toMatchObject({
      kind: 'route',
      states: [AppState.FUTURE],
      replacePath: '/future',
    });
  });
});
