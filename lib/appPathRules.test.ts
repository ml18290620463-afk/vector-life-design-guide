import { describe, expect, it } from 'vitest';
import {
  getMainTabPathname,
  getMainTabFromPathname,
  getNowPathname,
  getNowRouteFromPathname,
  getRestorablePathname,
  isNowSurfacePathname,
} from './appPathRules';

describe('appPathRules', () => {
  it('treats now and avatar routes as now surfaces', () => {
    expect(isNowSurfacePathname('/now')).toBe(true);
    expect(isNowSurfacePathname('/now/tags')).toBe(true);
    expect(isNowSurfacePathname('/now/avatar-chat')).toBe(true);
    expect(isNowSurfacePathname('/avatar')).toBe(true);
  });

  it('does not treat main module routes as now surfaces', () => {
    expect(isNowSurfacePathname('/past')).toBe(false);
    expect(isNowSurfacePathname('/future')).toBe(false);
    expect(isNowSurfacePathname('/settings')).toBe(false);
  });

  it('resolves direct urls to main module tabs', () => {
    expect(getMainTabFromPathname('/past')).toBe('past');
    expect(getMainTabFromPathname('/future')).toBe('future');
    expect(getMainTabFromPathname('/avatar')).toBe('avatar');
    expect(getMainTabFromPathname('/now')).toBe('now');
    expect(getMainTabFromPathname('/now/tags')).toBe('now');
    expect(getMainTabFromPathname('/settings')).toBeNull();
  });

  it('resolves now sub routes before main module routing', () => {
    expect(getNowRouteFromPathname('/now')).toBe('now');
    expect(getNowRouteFromPathname('/now/tags')).toBe('tags');
    expect(getNowRouteFromPathname('/now/avatar-chat')).toBe('avatar-chat');
    expect(getNowRouteFromPathname('/avatar')).toBe('avatar-chat');
    expect(getNowRouteFromPathname('/future')).toBeNull();
  });

  it('captures only app routes for post-unlock restoration', () => {
    expect(getRestorablePathname('/avatar')).toBe('/avatar');
    expect(getRestorablePathname('/future')).toBe('/future');
    expect(getRestorablePathname('/now/tags')).toBe('/now/tags');
    expect(getRestorablePathname('/')).toBeNull();
    expect(getRestorablePathname('/unknown')).toBeNull();
  });

  it('builds canonical app pathnames from routes', () => {
    expect(getNowPathname('now')).toBe('/now');
    expect(getNowPathname('tags')).toBe('/now/tags');
    expect(getNowPathname('avatar-chat')).toBe('/avatar');
    expect(getMainTabPathname('past')).toBe('/past');
    expect(getMainTabPathname('now')).toBe('/now');
    expect(getMainTabPathname('future')).toBe('/future');
    expect(getMainTabPathname('avatar')).toBe('/avatar');
  });
});
