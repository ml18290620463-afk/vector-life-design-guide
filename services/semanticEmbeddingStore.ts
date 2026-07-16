import { get, set } from 'idb-keyval';
import type { DiaryEntry } from '../types';
import { DiaryStorageKeys } from './diaryStorage';

export const SEMANTIC_EMBEDDING_MODEL = 'Xenova/bge-small-zh-v1.5-q8';
export const SEMANTIC_EMBEDDING_SCHEMA_VERSION = 1;

export interface SemanticEmbeddingRecord {
  contentFingerprint: string;
  model: string;
  objectId: string;
  updatedAt: number;
  vector: number[];
}

interface SemanticEmbeddingEnvelope {
  records: SemanticEmbeddingRecord[];
  schemaVersion: number;
}

const normalizeSemanticText = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

export const entryToEmbeddingText = (
  entry: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
): string =>
  normalizeSemanticText(
    `${entry.title}\n${entry.content}\n${entry.tags.map((tag) => tag.replace(/^(心情|事件):/, '')).join(' ')}`,
  ).slice(0, 6000);

export const createEmbeddingFingerprint = (
  entry: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
): string => {
  const value = entryToEmbeddingText(entry);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${SEMANTIC_EMBEDDING_MODEL}:${(hash >>> 0).toString(16)}`;
};

const isValidRecord = (value: unknown): value is SemanticEmbeddingRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SemanticEmbeddingRecord>;
  return (
    record.model === SEMANTIC_EMBEDDING_MODEL &&
    typeof record.objectId === 'string' &&
    typeof record.contentFingerprint === 'string' &&
    typeof record.updatedAt === 'number' &&
    Array.isArray(record.vector) &&
    record.vector.length > 0 &&
    record.vector.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
};

export const loadSemanticEmbeddingRecords = async (): Promise<SemanticEmbeddingRecord[]> => {
  const stored = await get<unknown>(DiaryStorageKeys.semanticEmbeddings);
  if (!stored || typeof stored !== 'object') return [];
  const envelope = stored as Partial<SemanticEmbeddingEnvelope>;
  if (
    envelope.schemaVersion !== SEMANTIC_EMBEDDING_SCHEMA_VERSION ||
    !Array.isArray(envelope.records)
  ) {
    return [];
  }
  return envelope.records.filter(isValidRecord);
};

export const saveSemanticEmbeddingRecords = async (
  records: SemanticEmbeddingRecord[],
): Promise<void> => {
  const envelope: SemanticEmbeddingEnvelope = {
    records,
    schemaVersion: SEMANTIC_EMBEDDING_SCHEMA_VERSION,
  };
  await set(DiaryStorageKeys.semanticEmbeddings, envelope);
};

export const mergeSemanticEmbeddingRecords = (
  current: SemanticEmbeddingRecord[],
  updates: SemanticEmbeddingRecord[],
): SemanticEmbeddingRecord[] => {
  const recordsById = new Map(current.map((record) => [record.objectId, record]));
  for (const update of updates) recordsById.set(update.objectId, update);
  return [...recordsById.values()];
};
