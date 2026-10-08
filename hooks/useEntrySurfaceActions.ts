import { useCallback } from 'react';
import { AppState, type DiaryEntry } from '../types';
import type { MobileMainTab } from '../features/mobile/types';
import { isMobileExperience } from '../lib/previewMode';
import { generateSecureId } from '../services/idGenerator';

type EntryPayload = Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'> & { id?: string };

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
      const id = payload.id ?? generateSecureId();
      return addEntry({ ...payload, id });
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

  const backToPast = useCallback(() => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
    } else {
      setAppState(AppState.PAST);
    }
    setSelectedEntry(null);
  }, [handleMobileTabChange, setAppState, setSelectedEntry]);

  return {
    handleBackToPast: backToPast,
    handleMintEntry: persistNowRecord,
    handlePersistNowRecord: persistNowRecord,
    handleSelectEntry: selectEntry,
  };
};
