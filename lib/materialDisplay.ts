import type { EntryMaterial, Language } from '../types';

const FALLBACK_LABELS: Record<EntryMaterial['type'], { zh: string; en: string }> = {
  image: { zh: '图片素材', en: 'Image material' },
  video: { zh: '视频素材', en: 'Video material' },
  audio: { zh: '录音', en: 'Audio recording' },
  link: { zh: '链接', en: 'Link' },
};

export const getMaterialTitle = (
  material: Pick<EntryMaterial, 'type' | 'url' | 'local_path' | 'meta'>,
  language: Language = 'zh',
): string =>
  material.meta?.title ||
  material.local_path ||
  material.url ||
  FALLBACK_LABELS[material.type][language === 'zh' ? 'zh' : 'en'];

export const getMaterialAlt = (
  material: Pick<EntryMaterial, 'type' | 'url' | 'local_path' | 'meta'>,
  language: Language = 'zh',
): string => getMaterialTitle(material, language);

export const getAudioPlayLabel = (language: Language = 'zh'): string =>
  language === 'zh' ? '▶ 播放录音' : '▶ Play audio';
