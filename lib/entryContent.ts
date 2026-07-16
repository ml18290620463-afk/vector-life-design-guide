import type { DiaryEntry, Language } from '../types';
import { formatEntryDateTime } from './dateFormat';

export const splitEntryContent = (content: string) => {
  const [body = '', materialBlock = ''] = content.split(/\n素材:\n/);
  const materials = materialBlock
    .split('\n')
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  return { body: body.trim(), materials };
};

export const isLegacyMediaMaterial = (material: string) =>
  /^(image|video|audio)\s*:/i.test(material) ||
  /\.(png|jpe?g|gif|webp|heic|avif|mp4|mov|m4v|webm|mp3|m4a|wav|ogg)$/i.test(material);

export const extractLegacyMediaUrl = (material: string, type: 'audio' | 'video' | 'image') => {
  const match = material.match(new RegExp(`^${type}\\s*[:：]\\s*(data:${type}/[^\\s]+)`, 'i'));
  return match?.[1] ?? null;
};

export const stripLegacyMaterialPrefix = (material: string) =>
  material.replace(/^(image|video|audio|link)\s*[:：]\s*/i, '').trim();

export const formatEntryTag = (tag: string) => tag.replace(/^(心情|事件)\s*[:：]\s*/, '').trim();

export const formatEntryTime = (entry: DiaryEntry, language: Language) =>
  formatEntryDateTime(entry.createdAt, language);

export const isGeneratedTimeTitle = (title: string) =>
  /^\d{4}年\d{1,2}月\d{1,2}日\d{1,2}点\d{1,2}分$/.test(title.trim());
