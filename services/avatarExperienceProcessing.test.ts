import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../types';
import { readAvatarAtomicMemories } from './avatarMemory';

vi.mock('../features/now/api/avatar', () => ({
  previewAvatarGrowth: vi.fn(),
}));

import { previewAvatarGrowth } from '../features/now/api/avatar';
import { proposeExperienceMemories } from './avatarExperienceProcessing';

const entry = (id: string, content = '我喜欢简洁的表达。'): DiaryEntry => ({
  id,
  title: '',
  content,
  createdAt: 100,
  tags: [],
  isLocked: false,
});

const preferenceCandidate = (sourceIds: string[]) => ({
  id: `preference-${sourceIds.join('-')}`,
  statement: '我偏好简洁表达',
  nature: 'explicit' as const,
  category: 'recent_state' as const,
  facets: ['preference'] as const,
  tags: [],
  contexts: [],
  confidence: 0.7,
  status: 'candidate' as const,
  sensitivity: 'normal' as const,
  createdAt: 100,
  sourceRefs: sourceIds.map((id) => ({ source: 'entry' as const, id })),
});

describe('proposeExperienceMemories', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(previewAvatarGrowth).mockReset();
  });

  it('keeps a preference in one past record as evidence rather than proposing a durable memory', async () => {
    vi.mocked(previewAvatarGrowth).mockResolvedValue({
      atomicMemoryCandidates: [preferenceCandidate(['entry-a'])],
    });

    await proposeExperienceMemories(
      entry('entry-a'),
      { content: '我喜欢简洁的表达。', createdAt: 100 },
      [entry('entry-a')],
      () => false,
      [],
    );

    expect(readAvatarAtomicMemories()).toEqual([]);
  });

  it('allows a durable preference candidate only after independent past evidence exists', async () => {
    vi.mocked(previewAvatarGrowth).mockResolvedValue({
      atomicMemoryCandidates: [preferenceCandidate(['entry-a', 'entry-b'])],
    });

    await proposeExperienceMemories(
      entry('entry-b'),
      { content: '我喜欢简洁的表达。', createdAt: 200 },
      [entry('entry-a'), entry('entry-b')],
      () => false,
    );

    expect(readAvatarAtomicMemories()).toEqual([
      expect.objectContaining({
        statement: '我偏好简洁表达',
        status: 'candidate',
        sourceRefs: expect.arrayContaining([
          expect.objectContaining({ id: 'entry-a' }),
          expect.objectContaining({ id: 'entry-b' }),
        ]),
      }),
    ]);
  });
  it.each(['unsent', 'quote', 'supplement'])(
    'rejects %s evidence instead of saving an unsupported candidate',
    async (kind) => {
      const candidate = preferenceCandidate(['entry-a']);
      vi.mocked(previewAvatarGrowth).mockResolvedValue({
        atomicMemoryCandidates: [
          {
            ...candidate,
            facets: ['value'],
            sourceRefs: [
              {
                source: 'entry',
                id: kind === 'unsent' ? 'invented' : 'entry-a',
                ...(kind === 'quote' ? { excerpt: '原文不存在的内容' } : {}),
                ...(kind === 'supplement' ? { supplementId: 'invented' } : {}),
              },
            ],
          },
        ],
      });
      await proposeExperienceMemories(
        entry('entry-a'),
        { content: '我喜欢简洁的表达。', createdAt: 100 },
        [entry('entry-a')],
        () => false,
      );
      expect(readAvatarAtomicMemories()).toEqual([]);
    },
  );
});
