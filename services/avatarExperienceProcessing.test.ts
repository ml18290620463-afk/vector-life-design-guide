import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../types';
import { buildAvatarGrowthPreview } from './avatarIntelligence';
import { clear, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { initializeAvatarOntology, readAvatarOntology } from './avatarOntologyStore';
import { readAIPrivacy } from './aiPrivacy';
import { attestExperienceCandidate } from './avatarExperienceReceipt';
import { AVATAR_V1_KEYS } from './avatarOntologyMigration';

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
  aiVisibility: 'allowed' as const,
  isLocked: false,
});

const preferenceCandidate = (sourceIds: string[]) => ({
  id: `preference-${sourceIds.join('-')}`,
  statement: '我偏好简洁表达',
  nature: 'explicit' as const,
  category: 'recent_state' as const,
  facets: ['preference' as const],
  tags: [],
  contexts: [],
  confidence: 0.7,
  status: 'candidate' as const,
  sensitivity: 'normal' as const,
  createdAt: 100,
  sourceRefs: sourceIds.map((id) => ({ source: 'entry' as const, id, excerpt: '我喜欢简洁的表达。' })),
});

describe('proposeExperienceMemories', () => {
  beforeEach(async () => {
    await clear();
    useAppStore.setState({ masterPassword: null, isUnlocked: true });
    localStorage.clear();
    vi.mocked(previewAvatarGrowth).mockReset();
  });

  it('stages one verified explicit preference without requiring inferred multi-source evidence', async () => {
    await prepare(['entry-a']);

    await proposeExperienceMemories(
      entry('entry-a'),
      { content: '我喜欢简洁的表达。', createdAt: 100 },
      [entry('entry-a')],
      () => false,
      [],
    );

    const graph = await readAvatarOntology();
    expect(graph.objects).toEqual([expect.objectContaining({
      status: 'candidate', domain: 'about_me', category: 'preferences_boundaries',
      privacy: expect.objectContaining({ aiVisible: false }),
      evidenceGate: expect.objectContaining({
        requiresMultiSourceGate: false, isReadyForConfirmation: true,
      }),
    })]);
    expect(graph.edges).toHaveLength(1);
  });

  it('preserves independent preference evidence and deduplicates repeated processing', async () => {
    await prepare(['entry-a', 'entry-b']);

    await proposeExperienceMemories(
      entry('entry-b'),
      { content: '我喜欢简洁的表达。', createdAt: 200 },
      [entry('entry-a'), entry('entry-b')],
      () => false,
    );

    const saved = await readAvatarOntology();
    expect(saved.objects).toEqual([expect.objectContaining({
      statement: '我偏好简洁表达', status: 'candidate', domain: 'about_me',
      privacy: expect.objectContaining({ aiVisible: false }),
    })]);
    expect(saved.edges.map((edge) => edge.toId).sort()).toEqual(['entry-a', 'entry-b']);
    await proposeExperienceMemories(entry('entry-b'), { content: entry('entry-b').content, createdAt: 200 },
      [entry('entry-a'), entry('entry-b')], () => false);
    expect((await readAvatarOntology()).objects).toHaveLength(1);
  });
  it.each([
    { dates: [100], ready: false },
    { dates: [100, 200], ready: false },
    { dates: [100, 86400100], ready: true },
  ])('keeps inferred candidates gated by independent evidence and dates: $dates', async ({ dates, ready }) => {
    const originals = dates.map((createdAt, i) => ({ ...entry(`entry-${i}`), createdAt }));
    await set(K.entries, originals);
    await initializeAvatarOntology();
    vi.mocked(previewAvatarGrowth).mockImplementation(async () => {
      const candidate = {
        ...preferenceCandidate(originals.map((item) => item.id)),
        nature: 'inferred' as const,
        facets: ['cognitive_pattern' as const],
      };
      attestExperienceCandidate(candidate, (await readAIPrivacy()).token);
      return { ...(await buildAvatarGrowthPreview({ messages: [] })), atomicMemoryCandidates: [candidate] };
    });
    await proposeExperienceMemories(originals[0], originals[0], originals, () => false);
    expect((await readAvatarOntology()).objects).toEqual([expect.objectContaining({
      status: 'candidate', domain: 'my_understanding',
      privacy: expect.objectContaining({ aiVisible: false }),
      evidenceGate: expect.objectContaining({
        requiresMultiSourceGate: true, isReadyForConfirmation: ready,
      }),
    })]);
  });

  it.each(['unsent', 'quote', 'supplement'])(
    'rejects %s evidence instead of saving an unsupported candidate',
    async (kind) => {
      await set(K.entries, [entry('entry-a')]);
      await initializeAvatarOntology();
      const candidate = preferenceCandidate(['entry-a']);
      vi.mocked(previewAvatarGrowth).mockResolvedValue({
        ...(await buildAvatarGrowthPreview({ messages: [] })),
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
      await expect(proposeExperienceMemories(
        entry('entry-a'),
        { content: '我喜欢简洁的表达。', createdAt: 100 },
        [entry('entry-a')],
        () => false,
      )).rejects.toThrow('核验');
      expect((await readAvatarOntology()).objects).toEqual([]);
    },
  );
});

async function prepare(ids: string[]) {
  await set(K.entries, ids.map((id) => entry(id)));
  await initializeAvatarOntology();
  vi.mocked(previewAvatarGrowth).mockImplementation(async () => {
    const candidate = preferenceCandidate(ids);
    attestExperienceCandidate(candidate, (await readAIPrivacy()).token);
    return { ...(await buildAvatarGrowthPreview({ messages: [] })), atomicMemoryCandidates: [candidate] };
  });
}
it('pauses legacy accounts before extraction and preserves original bytes', async () => {
  await clear(); localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  vi.mocked(previewAvatarGrowth).mockReset();
  const original = '[{"id":"old","statement":"原文"}]';
  localStorage.setItem(AVATAR_V1_KEYS.atoms, original);
  await expect(proposeExperienceMemories(entry('entry-a'), { content: entry('entry-a').content, createdAt: 100 },
    [entry('entry-a')], () => false)).rejects.toThrow();
  expect(previewAvatarGrowth).not.toHaveBeenCalled();
  expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe(original);
});
