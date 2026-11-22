import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { zh } from './locales/zh';
import { normalizeLanguage, SUPPORTED_LANGUAGES, TRANSLATIONS } from './translations';

describe('published languages', () => {
  it('has identical complete zh/en keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const dictionary of [en, zh]) {
      for (const value of Object.values(dictionary)) expect(value.trim().length).toBeGreaterThan(0);
    }
  });
  it('offers only zh/en and safely resolves legacy preferences', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['zh', 'en']);
    expect(normalizeLanguage('zh')).toBe('zh');
    for (const language of ['ja', 'ko', 'fr', 'de', 'es'] as const) {
      expect(normalizeLanguage(language)).toBe('en');
      expect(TRANSLATIONS[language]).toBe(en);
    }
  });
});
