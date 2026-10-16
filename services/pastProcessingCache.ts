import type { DiaryEntry } from '../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { getStoredString, setStoredJson } from './browserStorage';

export const PAST_PROCESSING_KEY = 'vector:past:processing:v1';
const VERSION = 1;
interface ProcessingReceipt {
  id: string;
  parentId?: string;
  fingerprint: string;
  version: number;
}
export const pastRecordFingerprint = (entry: DiaryEntry) =>
  bytesToHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify([
          entry.title,
          entry.content,
          entry.tags,
          entry.createdAt,
          entry.nowMaterials,
          entry.supplements,
        ]),
      ),
    ),
  );
let cachedRaw: string | null = null;
let cachedReceipts: ProcessingReceipt[] = [];
let cachedById = new Map<string, ProcessingReceipt>();
const readReceipts = (): ProcessingReceipt[] => {
  const raw = getStoredString(PAST_PROCESSING_KEY);
  if (raw === cachedRaw) return cachedReceipts;
  cachedRaw = raw;
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : [];
  } catch {
    value = [];
  }
  cachedReceipts = Array.isArray(value)
    ? value.filter(
        (row): row is ProcessingReceipt =>
          row &&
          typeof row.id === 'string' &&
          typeof row.fingerprint === 'string' &&
          typeof row.version === 'number',
      )
    : [];
  cachedById = new Map(cachedReceipts.map((receipt) => [receipt.id, receipt]));
  return cachedReceipts;
};
export const wasPastRecordProcessed = (id: string, fingerprint: string) => {
  readReceipts();
  const row = cachedById.get(id);
  return row?.fingerprint === fingerprint && row.version === VERSION;
};
export const markPastRecordProcessed = (id: string, fingerprint: string, parentId?: string) => {
  const next = [
    ...readReceipts().filter((row) => row.id !== id),
    { id, fingerprint, parentId, version: VERSION },
  ];
  return setStoredJson(PAST_PROCESSING_KEY, next);
};
export const forgetPastProcessing = (ids: string[]) => {
  const removed = new Set(ids);
  return setStoredJson(
    PAST_PROCESSING_KEY,
    readReceipts().filter(
      (row) => !removed.has(row.id) && !(row.parentId && removed.has(row.parentId)),
    ),
  );
};
