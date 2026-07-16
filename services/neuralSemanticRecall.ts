import type { DiaryEntry } from '../types';
import { cosineSimilarity } from './localSemanticIndex';
import { embedTextsLocally } from './semanticEmbeddingClient';
import {
  createEmbeddingFingerprint,
  entryToEmbeddingText,
  loadSemanticEmbeddingRecords,
  mergeSemanticEmbeddingRecords,
  saveSemanticEmbeddingRecords,
  SEMANTIC_EMBEDDING_MODEL,
  type SemanticEmbeddingRecord,
} from './semanticEmbeddingStore';

const QUERY_INSTRUCTION = '为这个句子生成表示以用于检索相关文章：';
const EMBEDDING_BATCH_SIZE = 16;
const DEFAULT_MINIMUM_SIMILARITY = 0.52;

const isIndexableEntry = (entry: DiaryEntry): boolean =>
  !entry.isSample &&
  !entry.isArchived &&
  (!entry.unlockAt || entry.unlockAt <= Date.now()) &&
  `${entry.title}${entry.content}`.trim().length > 0;

const embedInBatches = async (texts: string[]): Promise<number[][]> => {
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    vectors.push(...(await embedTextsLocally(batch)));
  }
  return vectors;
};

export const rankNeuralSemanticMatches = (
  queryVector: number[],
  candidates: DiaryEntry[],
  records: SemanticEmbeddingRecord[],
  limit = 3,
  minimumSimilarity = DEFAULT_MINIMUM_SIMILARITY,
): string[] => {
  const recordsById = new Map(records.map((record) => [record.objectId, record]));
  return candidates
    .flatMap((entry) => {
      const record = recordsById.get(entry.id);
      if (!record || record.contentFingerprint !== createEmbeddingFingerprint(entry)) return [];
      return [{ entry, similarity: cosineSimilarity(queryVector, record.vector) }];
    })
    .filter(({ similarity }) => similarity >= minimumSimilarity)
    .sort(
      (first, second) =>
        second.similarity - first.similarity || second.entry.createdAt - first.entry.createdAt,
    )
    .slice(0, limit)
    .map(({ entry }) => entry.id);
};

export const searchNeuralRelatedEntryIds = async (
  query: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
  entries: DiaryEntry[],
  limit = 3,
): Promise<string[]> => {
  const candidates = entries.filter(isIndexableEntry);
  if (candidates.length === 0) return [];

  const currentRecords = await loadSemanticEmbeddingRecords();
  const recordsById = new Map(currentRecords.map((record) => [record.objectId, record]));
  const staleSources = candidates.filter((entry) => {
    const existing = recordsById.get(entry.id);
    return !existing || existing.contentFingerprint !== createEmbeddingFingerprint(entry);
  });
  const queryVectorPromise = embedTextsLocally([
    `${QUERY_INSTRUCTION}${entryToEmbeddingText(query)}`,
  ]).then(([vector]) => {
    if (!vector) throw new Error('Local query embedding was empty');
    return vector;
  });
  const staleVectorsPromise = embedInBatches(staleSources.map(entryToEmbeddingText));
  const [queryVector, staleVectors] = await Promise.all([queryVectorPromise, staleVectorsPromise]);

  const now = Date.now();
  const updates = staleSources.map<SemanticEmbeddingRecord>((entry, index) => ({
    contentFingerprint: createEmbeddingFingerprint(entry),
    model: SEMANTIC_EMBEDDING_MODEL,
    objectId: entry.id,
    updatedAt: now,
    vector: staleVectors[index]!,
  }));
  const activeIds = new Set(candidates.map((entry) => entry.id));
  const nextRecords = mergeSemanticEmbeddingRecords(
    currentRecords.filter((record) => activeIds.has(record.objectId)),
    updates,
  );
  await saveSemanticEmbeddingRecords(nextRecords);

  return rankNeuralSemanticMatches(queryVector, candidates, nextRecords, limit);
};

export const findNeuralRelatedEntryIds = async (
  entryId: string,
  query: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
  entries: DiaryEntry[],
  limit = 3,
): Promise<string[]> => {
  const candidates = entries.filter((entry) => entry.id !== entryId && isIndexableEntry(entry));
  if (candidates.length === 0) return [];

  const currentRecords = await loadSemanticEmbeddingRecords();
  const recordsById = new Map(currentRecords.map((record) => [record.objectId, record]));
  const indexSources: Array<Pick<DiaryEntry, 'id' | 'title' | 'content' | 'tags'>> = [
    { ...query, id: entryId },
    ...candidates,
  ];
  const staleSources = indexSources.filter((source) => {
    const existing = recordsById.get(source.id);
    return !existing || existing.contentFingerprint !== createEmbeddingFingerprint(source);
  });

  const queryVectorPromise = embedTextsLocally([
    `${QUERY_INSTRUCTION}${entryToEmbeddingText(query)}`,
  ]).then(([vector]) => {
    if (!vector) throw new Error('Local query embedding was empty');
    return vector;
  });
  const staleVectorsPromise = embedInBatches(staleSources.map(entryToEmbeddingText));
  const [queryVector, staleVectors] = await Promise.all([queryVectorPromise, staleVectorsPromise]);

  const now = Date.now();
  const updates = staleSources.map<SemanticEmbeddingRecord>((source, index) => ({
    contentFingerprint: createEmbeddingFingerprint(source),
    model: SEMANTIC_EMBEDDING_MODEL,
    objectId: source.id,
    updatedAt: now,
    vector: staleVectors[index]!,
  }));
  const activeIds = new Set(indexSources.map((source) => source.id));
  const nextRecords = mergeSemanticEmbeddingRecords(
    currentRecords.filter((record) => activeIds.has(record.objectId)),
    updates,
  );
  await saveSemanticEmbeddingRecords(nextRecords);

  return rankNeuralSemanticMatches(queryVector, candidates, nextRecords, limit);
};
