import { beforeEach, describe, expect, it } from 'vitest';
import { clear } from 'idb-keyval';
import type { DiaryEntry } from '../types';
import {
  createEmbeddingFingerprint,
  loadSemanticEmbeddingRecords,
  mergeSemanticEmbeddingRecords,
  saveSemanticEmbeddingRecords,
  SEMANTIC_EMBEDDING_MODEL,
  type SemanticEmbeddingRecord,
} from './semanticEmbeddingStore';

const entry: Pick<DiaryEntry, 'title' | 'content' | 'tags'> = {
  title: '一次沟通',
  content: '会前确认目标，讨论更顺利。',
  tags: ['事件:职业发展'],
};

const record = (objectId: string, vector: number[]): SemanticEmbeddingRecord => ({
  contentFingerprint: `${SEMANTIC_EMBEDDING_MODEL}:${objectId}`,
  model: SEMANTIC_EMBEDDING_MODEL,
  objectId,
  updatedAt: 1,
  vector,
});

describe('semanticEmbeddingStore', () => {
  beforeEach(async () => {
    await clear();
  });

  it('fingerprints normalized semantic content deterministically', () => {
    expect(createEmbeddingFingerprint(entry)).toBe(
      createEmbeddingFingerprint({ ...entry, content: '  会前确认目标，讨论更顺利。  ' }),
    );
    expect(createEmbeddingFingerprint(entry)).not.toBe(
      createEmbeddingFingerprint({ ...entry, content: '改为会后再确认目标。' }),
    );
  });

  it('stores derived vectors separately from diary data', async () => {
    await saveSemanticEmbeddingRecords([record('entry-1', [1, 0])]);

    await expect(loadSemanticEmbeddingRecords()).resolves.toEqual([record('entry-1', [1, 0])]);
  });

  it('replaces stale records by object id', () => {
    const merged = mergeSemanticEmbeddingRecords(
      [record('entry-1', [1, 0]), record('entry-2', [0, 1])],
      [record('entry-1', [0.9, 0.1])],
    );

    expect(merged).toEqual([record('entry-1', [0.9, 0.1]), record('entry-2', [0, 1])]);
  });
});
