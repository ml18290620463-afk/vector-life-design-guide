import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { set } from 'idb-keyval';
import type { Attachment, Container, DiaryEntry } from '../types';
import { AppError, reportError } from '../lib/error';
import { generateSecureId } from '../services/idGenerator';
import { getDiaryStorageKeys, mirrorDiaryValue } from '../services/diaryStorage';

/** Owns small supporting collections, keeping entry and principle mutations in the main diary hook. */
export const useDiaryCollections = (
  userId: string | undefined,
  persistEntries: (entries: DiaryEntry[]) => Promise<void>,
  setEntries: Dispatch<SetStateAction<DiaryEntry[]>>,
  entriesRef: MutableRefObject<DiaryEntry[]>,
) => {
  const [guidingStars, setGuidingStars] = useState<string[]>([]);
  const [selectedStars, setSelectedStars] = useState<string[]>([]);
  const [materials, setMaterials] = useState<Attachment[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);

  const saveGuidingStars = useCallback(
    async (stars: string[]) => {
      const keys = getDiaryStorageKeys(userId);
      setGuidingStars(stars);
      await set(keys.guidingStars, stars).catch(() =>
        mirrorDiaryValue(keys.guidingStars, JSON.stringify(stars)),
      );
    },
    [userId],
  );

  const saveSelectedStars = useCallback(
    async (stars: string[]) => {
      const keys = getDiaryStorageKeys(userId);
      setSelectedStars(stars);
      await set(keys.selectedStars, stars).catch(() =>
        mirrorDiaryValue(keys.selectedStars, JSON.stringify(stars)),
      );
    },
    [userId],
  );

  const addMaterial = useCallback(
    async (material: Attachment) => {
      const keys = getDiaryStorageKeys(userId);
      let nextMaterials: Attachment[] = [];
      setMaterials((previous) => {
        nextMaterials = [material, ...previous];
        return nextMaterials;
      });
      await set(keys.materials, nextMaterials).catch(() =>
        console.warn('Failed to save materials to IndexedDB'),
      );
    },
    [userId],
  );

  const deleteMaterial = useCallback(
    async (index: number) => {
      const keys = getDiaryStorageKeys(userId);
      let nextMaterials: Attachment[] = [];
      setMaterials((previous) => {
        nextMaterials = previous.filter((_, currentIndex) => currentIndex !== index);
        return nextMaterials;
      });
      await set(keys.materials, nextMaterials).catch(() =>
        console.warn('Failed to save materials to IndexedDB'),
      );
    },
    [userId],
  );

  const persistContainers = useCallback(
    async (next: Container[]) => {
      const keys = getDiaryStorageKeys(userId);
      try {
        await set(keys.containers, next).catch((error) => {
          console.warn('IndexedDB set failed for containers, falling back to localStorage', error);
          mirrorDiaryValue(keys.containers, JSON.stringify(next));
        });
      } catch (error) {
        reportError(AppError.fromError(error), 'persistContainers');
      }
    },
    [userId],
  );

  const addContainer = useCallback(
    (name: string) => {
      const container: Container = {
        id: generateSecureId('container'),
        name,
        createdAt: Date.now(),
      };
      let next: Container[] = [];
      setContainers((previous) => (next = [container, ...previous]));
      void persistContainers(next);
    },
    [persistContainers],
  );

  const deleteContainer = useCallback(
    (id: string) => {
      let nextContainers: Container[] = [];
      setContainers(
        (previous) => (nextContainers = previous.filter((container) => container.id !== id)),
      );
      void persistContainers(nextContainers);
      // State updater functions may be replayed by React's development
      // checks. Build the persistence payload from the store's current ref,
      // rather than relying on an updater side effect, so the database and UI
      // always receive the same container-unlinked entries.
      const nextEntries = entriesRef.current.map((entry) =>
        entry.containerId === id ? { ...entry, containerId: undefined } : entry,
      );
      entriesRef.current = nextEntries;
      setEntries(nextEntries);
      void persistEntries(nextEntries);
    },
    [entriesRef, persistContainers, persistEntries, setEntries],
  );

  return {
    guidingStars,
    setGuidingStars,
    selectedStars,
    setSelectedStars,
    materials,
    setMaterials,
    containers,
    setContainers,
    saveGuidingStars,
    saveSelectedStars,
    addMaterial,
    deleteMaterial,
    addContainer,
    deleteContainer,
  };
};
