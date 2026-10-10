import type { DiaryEntry } from '../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { getStoredJson, setStoredJson } from './browserStorage';

export const PAST_PROCESSING_KEY = 'vector:past:processing:v1';
const VERSION = 1;
interface ProcessingReceipt {
  id: string;
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
        ]),
      ),
    ),
  );
const readReceipts = (): ProcessingReceipt[] => {
  const value = getStoredJson<unknown>(PAST_PROCESSING_KEY);
  return Array.isArray(value)
    ? value.filter(
        (row): row is ProcessingReceipt =>
          row &&
          typeof row.id === 'string' &&
          typeof row.fingerprint === 'string' &&
          typeof row.version === 'number',
      )
    : [];
};
export const wasPastRecordProcessed = (id: string, fingerprint: string) =>
  readReceipts().some(
    (row) => row.id === id && row.fingerprint === fingerprint && row.version === VERSION,
  );
export const markPastRecordProcessed = (id: string, fingerprint: string) =>
  setStoredJson(PAST_PROCESSING_KEY, [
    ...readReceipts().filter((row) => row.id !== id),
    { id, fingerprint, version: VERSION },
  ]);
export const forgetPastProcessing = (ids: string[]) =>
  setStoredJson(
    PAST_PROCESSING_KEY,
    readReceipts().filter((row) => !ids.includes(row.id)),
  );
