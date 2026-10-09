import { useCallback, useRef } from 'react';
import type { Material, MaterialType } from '../types/now';
import { CONFIG } from '../constants/config';
import { canAddMaterialType } from '../state/nowRules';
import { generateSecureId } from '../../../services/idGenerator';
import { normalizeWebMaterialUrl } from '../../../lib/materialPersistence';

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
    const input = window.prompt('粘贴网页链接');
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const url = normalizeWebMaterialUrl(trimmed);
    if (!url) {
      args.onError('请输入有效的网页链接，例如 example.com');
      return;
    }
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
      if (picked.some((file) => !file.type.startsWith(`${type}/`))) {
        args.onError(type === 'image' ? '请选择图片文件' : '请选择视频文件');
        return;
      }
      const oversized = picked.find((file) => file.size > maxBytes);
      if (oversized) {
        args.onError(type === 'image' ? '单图不能超过 10MB' : '视频不能超过 100MB');
        return;
      }
      let urls: string[];
      try {
        urls = await Promise.all(picked.map((file) => readFileAsDataUrl(file)));
      } catch {
        args.onError('素材读取失败，请重新选择');
        return;
      }
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
