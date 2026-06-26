import type { RefObject } from 'react';
import { TRANSLATIONS } from '../constants';
import type { DiaryEntry, Container, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

/**
 * Phase 3 §3.b — shared Storybook mocks.
 *
 * Stories deliberately live next to their components, but every story
 * pulls its translation dictionary, sample entries and sample
 * containers from this module so each `*.stories.tsx` file stays
 * focused on the prop variations under test (light / dark, locked /
 * unlocked, error / success, etc.).
 */
export const tZh: TranslationDictionary = TRANSLATIONS.zh;
export const tEn: TranslationDictionary = TRANSLATIONS.en;

export const themes = ['dark', 'light'] as const satisfies readonly Theme[];

export const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'abcd1234',
  title: 'On Cognitive Sovereignty',
  content:
    'The first principle is that you must not fool yourself — and you are the easiest person to fool. The second is to keep records.',
  createdAt: Date.UTC(2025, 5, 15, 9, 30),
  tags: ['#meta', '#discipline'],
  isLocked: false,
  ...overrides,
});

export const lockedEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry =>
  baseEntry({
    id: 'lock1234',
    title: 'Sealed Letter to Future Self',
    isLocked: true,
    isEncrypted: true,
    unlockAt: Date.UTC(2030, 11, 31),
    ...overrides,
  });

export const sampleContainers: Container[] = [
  { id: 'c-1', name: 'Field Notes', createdAt: Date.UTC(2024, 0, 1) },
  { id: 'c-2', name: 'Long-Form', createdAt: Date.UTC(2024, 3, 1) },
  { id: 'c-3', name: 'Volatile', createdAt: Date.UTC(2025, 0, 1) },
];

export const sampleMorningStarMetrics: Record<string, number> = {
  rationality: 0.82,
  emotionality: 0.55,
  futureFocus: 0.7,
  selfReflection: 0.9,
  resilience: 0.6,
};

export const samplePrinciples = [
  {
    id: 'p-1',
    text: '记录优先于灵感',
    year: 2024,
    createdAt: Date.UTC(2024, 0, 1),
    showOnHome: true,
  },
  {
    id: 'p-2',
    text: '怀疑你最相信的事',
    year: 2024,
    createdAt: Date.UTC(2024, 5, 1),
    showOnHome: true,
  },
  {
    id: 'p-3',
    text: '速度第二，方向第一',
    year: 2025,
    createdAt: Date.UTC(2025, 1, 1),
    showOnHome: true,
  },
];

export const noopRef = <T>(): RefObject<T | null> => ({ current: null });
