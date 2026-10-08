import { beforeEach, describe, expect, it } from 'vitest';
import {
  getStoredJson,
  getStoredString,
  hasStoredValue,
  removeStoredValue,
  setStoredJson,
  setStoredString,
} from './browserStorage';

describe('browserStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and reads strings safely', () => {
    expect(setStoredString('key', 'value')).toBe(true);
    expect(getStoredString('key')).toBe('value');
    expect(hasStoredValue('key')).toBe(true);
  });

  it('stores and reads json safely', () => {
    expect(setStoredJson('json', { ok: true })).toBe(true);
    expect(getStoredJson<{ ok: boolean }>('json')).toEqual({ ok: true });
  });

  it('returns null for malformed json', () => {
    localStorage.setItem('broken', '{oops');
    expect(getStoredJson('broken')).toBeNull();
  });

  it('removes keys safely', () => {
    localStorage.setItem('key', 'value');
    expect(removeStoredValue('key')).toBe(true);
    expect(getStoredString('key')).toBeNull();
  });
});
