import { useCallback, useRef } from 'react';
import type { Material, MaterialType } from '../types/now';
import { CONFIG } from '../constants/config';
import { canAddMaterialType } from '../state/nowRules';

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `material-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
        id: makeId(),
        type: 'link',
        url,
        meta: { title: url },
        sort_order: args.materials.length,
      },
    ]);
  }, [args]);

  const addFiles = useCallback(
    (files: FileList | null, type: Extract<MaterialType, 'image' | 'video'>) => {
      if (!files?.length) return;
      const check = canAddMaterialType(args.materials, type);
      if (check.ok === false) {
        args.onError(check.message);
        return;
      }
      const maxCount = type === 'image' ? CONFIG.MAX_IMAGES - args.materials.filter((m) => m.type === 'image').length : 1;
      const maxBytes = type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
      const picked = Array.from(files).slice(0, maxCount);
      const oversized = picked.find((file) => file.size > maxBytes);
      if (oversized) {
        args.onError(type === 'image' ? '单图不能超过 10MB' : '视频不能超过 100MB');
        return;
      }
      args.onAdd(
        picked.map((file, index) => ({
          id: makeId(),
          type,
          url: URL.createObjectURL(file),
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
