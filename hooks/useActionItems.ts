import { useCallback, useEffect, useRef, useState } from 'react';
import { set } from 'idb-keyval';
import type { ActionItem } from '../types';
import { sanitizeActionItem, readStoredArray } from '../services/diaryDataRead';
import { generateSecureId } from '../services/idGenerator';
import { getDiaryStorageKeys, mirrorDiaryValue } from '../services/diaryStorage';

export const useActionItems = (userId: string | undefined) => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const actionsRef = useRef<ActionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void readStoredArray<ActionItem>(getDiaryStorageKeys(userId).actions).then((storedActions) => {
      if (cancelled) return;
      const sanitized = storedActions.flatMap((action) => sanitizeActionItem(action) ?? []);
      actionsRef.current = sanitized;
      setActions(sanitized);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persistActions = useCallback(
    async (nextActions: ActionItem[]) => {
      const key = getDiaryStorageKeys(userId).actions;
      actionsRef.current = nextActions;
      setActions(nextActions);
      await set(key, nextActions).catch((error) => {
        console.warn('IndexedDB set failed for actions, falling back to localStorage', error);
        mirrorDiaryValue(key, JSON.stringify(nextActions));
      });
    },
    [userId],
  );

  const addAction = useCallback(
    async (data: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ActionItem> => {
      const now = Date.now();
      const action: ActionItem = {
        ...data,
        id: generateSecureId('action'),
        createdAt: now,
        updatedAt: now,
      };
      await persistActions([action, ...actionsRef.current]);
      return action;
    },
    [persistActions],
  );

  const updateAction = useCallback(
    async (updatedAction: ActionItem) => {
      await persistActions(
        actionsRef.current.map((action) =>
          action.id === updatedAction.id ? { ...updatedAction, updatedAt: Date.now() } : action,
        ),
      );
    },
    [persistActions],
  );

  const recordActionResult = useCallback(
    async (actionId: string, resultEntryId: string) => {
      const now = Date.now();
      await persistActions(
        actionsRef.current.map((action) =>
          action.id === actionId
            ? {
                ...action,
                status: 'completed' as const,
                resultEntryId,
                completedAt: now,
                reviewedAt: now,
                updatedAt: now,
              }
            : action,
        ),
      );
    },
    [persistActions],
  );

  const resetActions = useCallback(() => {
    actionsRef.current = [];
    setActions([]);
  }, []);

  return { actions, addAction, updateAction, recordActionResult, resetActions };
};
