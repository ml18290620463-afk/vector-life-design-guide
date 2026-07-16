import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../types';
import { rankNeuralSemanticMatches } from './neuralSemanticRecall';
import {
  createEmbeddingFingerprint,
  SEMANTIC_EMBEDDING_MODEL,
  type SemanticEmbeddingRecord,
} from './semanticEmbeddingStore';

const buildEntry = (id: string, createdAt: number): DiaryEntry => ({
  id,
  title: id,
  content: `${id} content`,
  createdAt,
  tags: [],
  isLocked: false,
});

const buildRecord = (entry: DiaryEntry, vector: number[]): SemanticEmbeddingRecord => ({
  contentFingerprint: createEmbeddingFingerprint(entry),
  model: SEMANTIC_EMBEDDING_MODEL,
  objectId: entry.id,
  updatedAt: 1,
  vector,
});

describe('rankNeuralSemanticMatches', () => {
  it('ranks valid cached vectors by cosine similarity', () => {
    const related = buildEntry('related', 1);
    const unrelated = buildEntry('unrelated', 2);

    expect(
      rankNeuralSemanticMatches(
        [1, 0],
        [unrelated, related],
        [buildRecord(unrelated, [0, 1]), buildRecord(related, [0.98, 0.1])],
        3,
        0.5,
      ),
    ).toEqual(['related']);
  });

  it('ignores vectors whose source content has changed', () => {
    const changed = buildEntry('changed', 1);
    const staleRecord = buildRecord(changed, [1, 0]);
    changed.content = 'new content invalidates the vector';

    expect(rankNeuralSemanticMatches([1, 0], [changed], [staleRecord], 3, 0.5)).toEqual([]);
  });
});
