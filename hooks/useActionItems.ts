import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionItem } from '../types';
import { sanitizeActionItem, readStoredArray } from '../services/diaryDataRead';
import { generateSecureId } from '../services/idGenerator';
import { getDiaryStorageKeys } from '../services/diaryStorage';
import { commitArrayDelta, subscribeVault, VaultLockedError } from '../services/vaultTransaction';

export const useActionItems = (userId: string | undefined) => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const actionsRef = useRef<ActionItem[]>([]);
  const [actionsLoadError, setActionsLoadError] = useState<string | null>(null);
  const readFailure = useRef<string | null>('行动尚未读取，请稍后重试');

  useEffect(() => {
    readFailure.current = '行动尚未读取，请稍后重试';
    actionsRef.current = [];
    setActions([]);
    let cancelled = false;
    let generation = 0;
    const refresh = () => {
      const id = ++generation;
      void readStoredArray<ActionItem>(getDiaryStorageKeys(userId).actions)
        .then((storedActions) => {
          if (cancelled || id !== generation) return;
          const sanitized = storedActions.flatMap((action) => sanitizeActionItem(action) ?? []);
          actionsRef.current = sanitized;
          setActions(sanitized);
          readFailure.current = null;
          setActionsLoadError(null);
        })
        .catch((error: unknown) => {
          if (cancelled || id !== generation) return;
          const message = error instanceof Error ? error.message : '行动读取失败，请重新加载';
          actionsRef.current = [];
          setActions([]);
          readFailure.current = message;
          // Locked data is expected before the unified login. Keep writes blocked,
          // but do not let this state replace the login screen with a fatal error.
          // The vault session subscription reloads actions after authentication.
          setActionsLoadError(error instanceof VaultLockedError ? null : message);
        });
    };
    refresh();
    const unsubscribe = subscribeVault(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  const persistActions = useCallback(
    async (nextActions: ActionItem[]) => {
      if (readFailure.current) throw new Error(readFailure.current);
      const key = getDiaryStorageKeys(userId).actions;
      const committed = await commitArrayDelta<ActionItem>(
        key,
        actionsRef.current,
        nextActions,
        undefined,
        sanitizeActionItem,
      );
      actionsRef.current = committed;
      setActions(committed);
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
        revision: 1,
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
          action.id === updatedAction.id
            ? { ...updatedAction, revision: (action.revision ?? 0) + 1, updatedAt: Date.now() }
            : action,
        ),
      );
    },
    [persistActions],
  );

  const recordActionResult = useCallback(
    async (actionId: string, resultEntryId: string) => {
      const target = actionsRef.current.find((action) => action.id === actionId);
      if (!target) throw new Error('关联行动已不存在，记录仍已保存。');
      if (target.resultEntryId === resultEntryId && target.status === 'completed') return;
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
                revision: (action.revision ?? 0) + 1,
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

  return { actions, actionsLoadError, addAction, updateAction, recordActionResult, resetActions };
};
