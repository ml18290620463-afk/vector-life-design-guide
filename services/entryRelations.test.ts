import { describe, expect, it } from 'vitest';
import type { DiaryEntry, ExperienceFeedbackOutcome } from '../types';
import { sanitizeDiaryEntry } from './diaryDataRead';
import {
  buildExperienceEdges,
  confirmExperienceEdge,
  resetExperienceEdge,
  updateRelatedEntryIds,
} from './entryRelations';

const makeEntry = (
  id: string,
  outcome?: ExperienceFeedbackOutcome,
  principleId = 'principle-1',
): DiaryEntry => ({
  id,
  title: id,
  content: `content ${id}`,
  createdAt: 1,
  tags: ['work'],
  isLocked: false,
  principleFeedback: outcome ? [{ principleId, outcome, createdAt: 1 }] : undefined,
});

describe('experience edge layer', () => {
  it('creates sameTheme edges for semantic candidates without confirmed feedback', () => {
    expect(buildExperienceEdges(makeEntry('source'), [makeEntry('past')], 10)).toEqual([
      expect.objectContaining({
        targetEntryId: 'past',
        kind: 'sameTheme',
        source: 'local-semantic',
      }),
    ]);
  });

  it('creates supports edges when both records validate the same principle', () => {
    expect(
      buildExperienceEdges(makeEntry('source', 'helpful'), [makeEntry('past', 'partial')], 10)[0],
    ).toMatchObject({ kind: 'supports', confidence: 1, source: 'user-confirmed' });
  });

  it('creates contradicts edges when the same principle is validated and invalidated', () => {
    expect(
      buildExperienceEdges(makeEntry('source', 'helpful'), [makeEntry('past', 'unhelpful')], 10)[0],
    ).toMatchObject({ kind: 'contradicts', source: 'user-confirmed' });
  });

  it('does not infer support or contradiction without feedback for the same principle', () => {
    const edge = buildExperienceEdges(
      makeEntry('source', 'helpful', 'principle-1'),
      [makeEntry('past', 'unhelpful', 'principle-2')],
      10,
    )[0];
    expect(edge.kind).toBe('sameTheme');
  });

  it('updates typed edges while preserving the legacy related ids', () => {
    const source = makeEntry('source', 'helpful');
    const past = makeEntry('past', 'helpful');
    const updated = updateRelatedEntryIds([source, past], source.id, [past.id], 10)[0];
    expect(updated.relatedEntryIds).toEqual(['past']);
    expect(updated.experienceEdges?.[0]).toMatchObject({ targetEntryId: 'past', kind: 'supports' });
  });

  it('lets the user confirm a semantic edge and preserves it across reranking', () => {
    const source = makeEntry('source');
    const past = makeEntry('past');
    const semantic = updateRelatedEntryIds([source, past], source.id, [past.id], 10)[0];
    const confirmed = confirmExperienceEdge(semantic, past.id, 'contradicts', 20);
    const reranked = updateRelatedEntryIds([confirmed, past], source.id, [past.id], 30)[0];

    expect(confirmed.experienceEdges?.[0]).toEqual({
      targetEntryId: 'past', kind: 'contradicts', confidence: 1, createdAt: 20, source: 'user-confirmed',
    });
    expect(reranked.experienceEdges?.[0]).toEqual(confirmed.experienceEdges?.[0]);
  });

  it('lets the user correct a confirmed relationship', () => {
    const source = makeEntry('source');
    const supported = confirmExperienceEdge(source, 'past', 'supports', 10);
    const contradicted = confirmExperienceEdge(supported, 'past', 'contradicts', 20);

    expect(contradicted.experienceEdges).toEqual([
      { targetEntryId: 'past', kind: 'contradicts', confidence: 1, createdAt: 20, source: 'user-confirmed' },
    ]);
  });

  it('resets a confirmed judgment to semantic while retaining the legacy relation', () => {
    const confirmed = confirmExperienceEdge(makeEntry('source'), 'past', 'supports', 10);
    const reset = resetExperienceEdge(confirmed, 'past', 20);

    expect(reset.relatedEntryIds).toEqual(['past']);
    expect(reset.experienceEdges).toEqual([
      { targetEntryId: 'past', kind: 'sameTheme', confidence: 0.7, createdAt: 20, source: 'local-semantic' },
    ]);
  });

  it('sanitizes malformed edges and deduplicates target ids', () => {
    const sanitized = sanitizeDiaryEntry({
      ...makeEntry('source'),
      experienceEdges: [
        { targetEntryId: 'past', kind: 'sameTheme', confidence: 2, createdAt: 10, source: 'local-semantic' },
        { targetEntryId: 'past', kind: 'supports', confidence: 1, createdAt: 11, source: 'user-confirmed' },
        { targetEntryId: 'bad', kind: 'unknown', confidence: 1, createdAt: 10, source: 'local-semantic' },
        { targetEntryId: 'source', kind: 'sameTheme', confidence: 1, createdAt: 10, source: 'local-semantic' },
      ],
    });
    expect(sanitized.experienceEdges).toEqual([
      { targetEntryId: 'past', kind: 'sameTheme', confidence: 1, createdAt: 10, source: 'local-semantic' },
    ]);
  });
});
