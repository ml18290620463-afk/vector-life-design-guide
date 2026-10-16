import { useCallback, useEffect, useRef, useState } from 'react';
import type { Material } from '../types/now';
import { validateMaterials } from '../state/nowRules';
import { generateSecureId } from '../../../services/idGenerator';
import { normalizeWebMaterialUrl } from '../../../lib/materialPersistence';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error('读取已取消'));
    reader.readAsDataURL(file);
  });

export const useMaterialPicker = (args: {
  materials: Material[];
  onAdd: (materials: Material[]) => void;
  onError: (message: string) => void;
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [failures, setFailures] = useState<{ id: string; file: File; type?: 'image' | 'video' }[]>(
    [],
  );
  const failureRef = useRef(failures);
  failureRef.current = failures;
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const latest = useRef(args);
  latest.current = args;
  useEffect(() => {
    const protectPendingRead = (event: BeforeUnloadEvent) => {
      if (!busy.current && !failureRef.current.length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectPendingRead);
    return () => window.removeEventListener('beforeunload', protectPendingRead);
  }, []);
  useEffect(
    () => () => {
      generation.current += 1;
      busy.current = false;
    },
    [],
  );

  const addLink = useCallback((input: string) => {
    if (busy.current) return false;
    const url = normalizeWebMaterialUrl(input.trim());
    if (!url) {
      latest.current.onError('请输入有效的网页链接');
      return false;
    }
    const material: Material = {
      id: generateSecureId('material'),
      type: 'link',
      url,
      meta: { title: url },
      sort_order: latest.current.materials.length,
    };
    const check = validateMaterials([...latest.current.materials, material]);
    if (check.ok === false) {
      latest.current.onError(check.message);
      return false;
    }
    latest.current.onAdd([material]);
    return true;
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[] | null, expectedType?: 'image' | 'video', retryId?: string) => {
      if (!files?.length || busy.current) return;
      const picked = Array.from(files);
      const materials: Material[] = [];
      for (const file of picked) {
        const type = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : null;
        if (!type || (expectedType && type !== expectedType)) {
          latest.current.onError('请选择图片或视频文件');
          return;
        }
        if (file.size > (type === 'image' ? 10 : 100) * 1024 * 1024) {
          latest.current.onError(type === 'image' ? '单图不能超过 10MB' : '视频不能超过 100MB');
          return;
        }
        materials.push({
          id: generateSecureId('material'),
          type,
          url: '',
          local_path: file.name,
          meta: { title: file.name },
          sort_order: latest.current.materials.length + materials.length,
        });
      }
      const check = validateMaterials([...latest.current.materials, ...materials]);
      if (check.ok === false) {
        latest.current.onError(check.message);
        return;
      }
      const token = generation.current;
      busy.current = true;
      setReading(true);
      try {
        const results = await Promise.allSettled(picked.map(readFileAsDataUrl));
        if (generation.current !== token) return;
        const successful = materials.flatMap((material, index) => {
          const result = results[index];
          return result.status === 'fulfilled' && result.value
            ? [
                {
                  ...material,
                  url: result.value,
                  sort_order:
                    latest.current.materials.length +
                    results
                      .slice(0, index)
                      .filter((item) => item.status === 'fulfilled' && item.value).length,
                },
              ]
            : [];
        });
        if (successful.length) latest.current.onAdd(successful);
        setFailures((current) => [
          ...current.filter((item) => item.id !== retryId),
          ...results.flatMap((result, index) =>
            result.status === 'rejected' || !result.value
              ? [{ id: materials[index].id, file: picked[index], type: expectedType }]
              : [],
          ),
        ]);
      } catch {
        if (generation.current === token) latest.current.onError('素材读取失败，请重新选择');
      } finally {
        if (generation.current === token) {
          busy.current = false;
          setReading(false);
        }
      }
    },
    [],
  );

  return {
    failures,
    clearFailures: () => setFailures([]),
    hasFailures: () => failureRef.current.length > 0,
    removeFailure: (id: string) =>
      setFailures((current) => current.filter((item) => item.id !== id)),
    retryFailure: async (id: string) => {
      if (busy.current) return;
      const failure = failureRef.current.find((item) => item.id === id);
      if (!failure) return;
      await addFiles([failure.file], failure.type, id);
    },
    reading,
    isReading: () => busy.current,
    imageInputRef,
    videoInputRef,
    addLink,
    openImagePicker: () => imageInputRef.current?.click(),
    openVideoPicker: () => videoInputRef.current?.click(),
    addFiles,
  };
};
