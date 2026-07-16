import type { Language } from '../types';

export const pad2 = (value: number): string => value.toString().padStart(2, '0');

export const formatNowDisplayTime = (date: Date): string =>
  `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${date.getHours()}点${date.getMinutes()}分`;

export const formatEntryDateTime = (timestamp: number, language: Language): string =>
  new Date(timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: language === 'zh' ? 'long' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDateDots = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
};

export const formatDateKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const formatMonthKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};
