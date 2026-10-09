import { describe, expect, it } from 'vitest';
import type { Principle } from '../types';
import {
  currentPrinciples,
  historicalEvolutionPrinciples,
  isPrincipleRevisionKind,
} from './principleRevision';

const principle = (id: string, text = id): Principle => ({
  id,
  text,
  year: 2026,
  createdAt: 1,
  showOnHome: false,
});

describe('principle revisions', () => {
  it('uses a correction successor as the only current principle', () => {
    const original = principle('original', '遇事先忍耐');
    const correction = {
      ...principle('correction', '先确认边界再回应'),
      supersedesPrincipleId: original.id,
      revisionKind: 'correction' as const,
      revisedAt: 2,
    };

    expect(currentPrinciples([original, correction]).map((item) => item.id)).toEqual([
      'correction',
    ]);
    expect(historicalEvolutionPrinciples([original, correction])).toEqual([]);
  });

  it('keeps an evolution predecessor only as explicitly historical context', () => {
    const original = principle('original', '冲突时先自己消化');
    const evolution = {
      ...principle('evolution', '先确认感受和边界，再决定是否沟通'),
      supersedesPrincipleId: original.id,
      revisionKind: 'evolution' as const,
      revisedAt: 2,
    };

    expect(currentPrinciples([original, evolution]).map((item) => item.id)).toEqual(['evolution']);
    expect(historicalEvolutionPrinciples([original, evolution])).toEqual([
      { principle: original, successor: evolution },
    ]);
  });

  it('preserves principles as current when replacement metadata is incomplete or invalid', () => {
    const original = principle('original');
    const cases: Principle[][] = [
      [original, { ...principle('missing-kind'), supersedesPrincipleId: original.id }],
      [
        original,
        {
          ...principle('missing-original'),
          supersedesPrincipleId: 'does-not-exist',
          revisionKind: 'correction',
        },
      ],
      [
        original,
        {
          ...principle('invalid-kind'),
          supersedesPrincipleId: original.id,
          revisionKind: 'other' as unknown as 'correction',
        },
      ],
    ];

    for (const items of cases) {
      expect(currentPrinciples(items).map((item) => item.id)).toContain(original.id);
    }
    expect(isPrincipleRevisionKind('evolution')).toBe(true);
    expect(isPrincipleRevisionKind('other')).toBe(false);
  });
});
