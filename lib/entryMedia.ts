import type { DiaryEntry, EntryMaterial } from '../types';
import { extractLegacyMediaUrl, stripLegacyMaterialPrefix } from './entryContent';

const isTypedMaterial = (material: EntryMaterial, type: EntryMaterial['type']) =>
  material.type === type && Boolean(material.url);

export const getEntryMediaGroups = (entry: DiaryEntry, rawMaterials: string[] = []) => {
  const nowMaterials = entry.nowMaterials ?? [];
  const imageMaterials = nowMaterials.filter((material) => isTypedMaterial(material, 'image'));
  const videoMaterials = nowMaterials.filter((material) => isTypedMaterial(material, 'video'));
  const audioMaterials = nowMaterials.filter((material) => isTypedMaterial(material, 'audio'));
  const seenLinks = new Set<string>();
  const linkKey = (url: string) => {
    try {
      return new URL(url.trim()).href;
    } catch {
      return url.trim();
    }
  };
  const linkMaterials = nowMaterials.filter((material) => {
    if (material.type !== 'link') return false;
    const key = linkKey(material.url || material.local_path || material.id);
    if (seenLinks.has(key)) return false;
    seenLinks.add(key);
    return true;
  });
  const otherMaterials = nowMaterials.filter(
    (material) =>
      material.type !== 'image' &&
      material.type !== 'video' &&
      material.type !== 'audio' &&
      material.type !== 'link',
  );
  const legacyAudioUrls = rawMaterials
    .map((material) => extractLegacyMediaUrl(material, 'audio'))
    .filter((url): url is string => Boolean(url));
  const legacyVideoUrls = rawMaterials
    .map((material) => extractLegacyMediaUrl(material, 'video'))
    .filter((url): url is string => Boolean(url));
  const legacyLinkMaterials = rawMaterials
    .filter((material) => /^link\s*[:：]/i.test(material))
    .map((material) => {
      const text = stripLegacyMaterialPrefix(material);
      const annotation = text.match(/（用户说明：([\s\S]*)）$/);
      const url = annotation ? text.slice(0, annotation.index).trim() : text;
      return { title: url, url, description: annotation?.[1].trim() };
    })
    .filter((material) => {
      if (!material.url) return false;
      const key = linkKey(material.url);
      if (seenLinks.has(key)) return false;
      seenLinks.add(key);
      return true;
    });

  return {
    imageMaterials,
    videoMaterials,
    audioMaterials,
    linkMaterials,
    otherMaterials,
    legacyAudioUrls,
    legacyVideoUrls,
    legacyLinkMaterials,
  };
};
