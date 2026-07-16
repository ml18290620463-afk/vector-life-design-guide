import { useCallback } from 'react';
import { AppState, type Attachment, type DiaryEntry } from '../types';
import type { MobileMainTab } from '../features/mobile/types';
import { isMobileExperience } from '../lib/previewMode';
import { generateSecureId } from '../services/idGenerator';

type EntryPayload = Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>;

type UseEntrySurfaceActionsOptions = {
  addEntry: (data: EntryPayload & { id?: string }) => Promise<DiaryEntry>;
  handleMobileTabChange: (tab: MobileMainTab) => void;
  setAppState: (state: AppState) => void;
  setSelectedEntry: (entry: DiaryEntry | null) => void;
};

export const useEntrySurfaceActions = ({
  addEntry,
  handleMobileTabChange,
  setAppState,
  setSelectedEntry,
}: UseEntrySurfaceActionsOptions) => {
  const persistNowRecord = useCallback(
    async (payload: EntryPayload) => {
      const id = generateSecureId();
      return addEntry({ ...payload, id });
    },
    [addEntry],
  );

  const createMaterialEntry = useCallback(
    (material: Attachment, isArchived: boolean) => {
      void addEntry({
        title: material.name,
        content: `[Attachment: ${material.name}]`,
        tags: ['upload', 'material', material.type],
        attachment: material,
        isArchived,
      });
    },
    [addEntry],
  );

  const selectEntry = useCallback(
    (entry: DiaryEntry) => {
      if (entry.unlockAt && entry.unlockAt > Date.now()) return;
      setSelectedEntry(entry);
      setAppState(AppState.VIEWER);
    },
    [setAppState, setSelectedEntry],
  );

  const backToDashboard = useCallback(() => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
    } else {
      setAppState(AppState.ARCHIVE);
    }
    setSelectedEntry(null);
  }, [handleMobileTabChange, setAppState, setSelectedEntry]);

  return {
    handleBackToDashboard: backToDashboard,
    handleCreateMaterialEntry: createMaterialEntry,
    handleMintEntry: persistNowRecord,
    handlePersistNowRecord: persistNowRecord,
    handleSelectEntry: selectEntry,
  };
};
