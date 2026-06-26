import { useCallback, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../constants/config';
import type { NowDraft } from '../types/now';
import { createEmptyDraft } from '../state/nowRules';

const readDraft = (): NowDraft => {
  if (typeof window === 'undefined') return createEmptyDraft();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.nowDraft);
    if (!raw) return createEmptyDraft();
    const parsed = JSON.parse(raw) as NowDraft;
    if (!parsed.record_time || !parsed.display_time) return createEmptyDraft();
    return {
      text: parsed.text ?? '',
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      mood_tags: Array.isArray(parsed.mood_tags) ? parsed.mood_tags : [],
      event_tags: Array.isArray(parsed.event_tags) ? parsed.event_tags : [],
      record_time: parsed.record_time,
      display_time: parsed.display_time,
      updated_at: parsed.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return createEmptyDraft();
  }
};

export const useNowDraft = () => {
  const [draft, setDraftState] = useState<NowDraft>(() => readDraft());

  const setDraft = useCallback((updater: NowDraft | ((draft: NowDraft) => NowDraft)) => {
    setDraftState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...next, updated_at: new Date().toISOString() };
    });
  }, []);

  const saveDraft = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEYS.nowDraft, JSON.stringify(draft));
  }, [draft]);

  const discardDraft = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEYS.nowDraft);
    setDraftState(createEmptyDraft());
  }, []);

  const resetAfterSend = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEYS.nowDraft);
    setDraftState(createEmptyDraft());
  }, []);

  return useMemo(
    () => ({ draft, setDraft, saveDraft, discardDraft, resetAfterSend }),
    [discardDraft, draft, resetAfterSend, saveDraft, setDraft],
  );
};
