import { getStoredJson, setStoredJson } from '../../../services/browserStorage';
import { CONFIG, STORAGE_KEYS } from '../constants/config';
import type { NowRecord } from '../types/now';

export const readCustomAnchors = (): string[] => {
  const parsed = getStoredJson<unknown>(STORAGE_KEYS.customAnchors);
  return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
};

export const writeCustomAnchors = (anchors: string[]): boolean =>
  setStoredJson(STORAGE_KEYS.customAnchors, anchors);

export const queuePendingRecord = (record: Omit<NowRecord, 'id' | 'sync_status'>): boolean => {
  if (!CONFIG.ENABLE_OFFLINE_QUEUE) return false;
  const parsed = getStoredJson<unknown>(STORAGE_KEYS.pendingRecords);
  const pending = Array.isArray(parsed) ? parsed : [];
  return setStoredJson(STORAGE_KEYS.pendingRecords, [...pending, record]);
};
