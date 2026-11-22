import { Language } from '../types';

export type TranslationDictionary = Record<string, string>;

import { zh } from './locales/zh';
import { en } from './locales/en';

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  zh,
  en,
  ja: en, // Legacy values normalize to English; archive is not bundled.
  ko: en, // Legacy values normalize to English; archive is not bundled.
  fr: en, // Legacy values normalize to English; archive is not bundled.
  es: en, // Legacy values normalize to English; archive is not bundled.
  de: en, // Legacy values normalize to English; archive is not bundled.
};

export const SUPPORTED_LANGUAGES = ['zh', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const normalizeLanguage = (language: string): SupportedLanguage =>
  language === 'zh' ? 'zh' : 'en';
