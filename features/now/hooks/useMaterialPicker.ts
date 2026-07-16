import { useCallback, useRef } from 'react';
import type { Material, MaterialType } from '../types/now';
import { CONFIG } from '../constants/config';
import { canAddMaterialType } from '../state/nowRules';
import { generateSecureId } from '../../../services/idGenerator';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const useMaterialPicker = (args: {
  materials: Material[];
  onAdd: (materials: Material[]) => void;
  onError: (message: string) => void;
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const addLink = useCallback(() => {
    const check = canAddMaterialType(args.materials, 'link');
    if (check.ok === false) {
      args.onError(check.message);
      return;
    }
    const url = window.prompt('输入 URL');
    if (!url) return;
    args.onAdd([
      {
        id: generateSecureId('material'),
        type: 'link',
        url,
        meta: { title: url },
        sort_order: args.materials.length,
      },
    ]);
  }, [args]);

  const addFiles = useCallback(
    async (files: FileList | null, type: Extract<MaterialType, 'image' | 'video'>) => {
      if (!files?.length) return;
      const check = canAddMaterialType(args.materials, type);
      if (check.ok === false) {
        args.onError(check.message);
        return;
      }
      const maxCount =
        type === 'image'
          ? CONFIG.MAX_IMAGES - args.materials.filter((m) => m.type === 'image').length
          : 1;
      const maxBytes = type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
      const picked = Array.from(files).slice(0, maxCount);
      const oversized = picked.find((file) => file.size > maxBytes);
      if (oversized) {
        args.onError(
          type === 'image' ? '单图不能超过 10MB' : '视频不能超过 100MB',
        );
        return;
      }
      const urls = await Promise.all(picked.map((file) => readFileAsDataUrl(file)));
      args.onAdd(
        picked.map((file, index) => ({
          id: generateSecureId('material'),
          type,
          url: urls[index],
          local_path: file.name,
          meta: { title: file.name },
          sort_order: args.materials.length + index,
        })),
      );
    },
    [args],
  );

  return {
    imageInputRef,
    videoInputRef,
    addLink,
    openImagePicker: () => imageInputRef.current?.click(),
    openVideoPicker: () => videoInputRef.current?.click(),
    addFiles,
  };
};
