import { Language } from '../types';

export type TranslationDictionary = Record<string, string>;

import { zh } from './locales/zh';
import { en } from './locales/en';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { de } from './locales/de';

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  zh,
  en,
  ja,
  ko,
  fr,
  es,
  de,
};
