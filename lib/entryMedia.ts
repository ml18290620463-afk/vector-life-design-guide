import type { DiaryEntry, EntryMaterial } from '../types';
import { extractLegacyMediaUrl, stripLegacyMaterialPrefix } from './entryContent';

const isTypedMaterial = (material: EntryMaterial, type: EntryMaterial['type']) =>
  material.type === type && Boolean(material.url);

export const getEntryMediaGroups = (entry: DiaryEntry, rawMaterials: string[] = []) => {
  const nowMaterials = entry.nowMaterials ?? [];
  const imageMaterials = nowMaterials.filter((material) => isTypedMaterial(material, 'image'));
  const videoMaterials = nowMaterials.filter((material) => isTypedMaterial(material, 'video'));
  const audioMaterials = nowMaterials.filter((material) => isTypedMaterial(material, 'audio'));
  const linkMaterials = nowMaterials.filter((material) => material.type === 'link');
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
    .map(stripLegacyMaterialPrefix)
    .filter(Boolean);

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
