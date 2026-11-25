import { beforeEach, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { cognition, evidenceGraph } from '../tests/fixtures/avatarOntology';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { DiaryStorageKeys as K } from './diaryStorage';
import { initializeAvatarOntology, readAvatarOntology } from './avatarOntologyStore';
import { reviewArchiveCognition } from './avatarOntologyArchive';
import type { DiaryEntry } from '../types';

const entries: DiaryEntry[] = [1, 2].map((day) => ({
  id: `entry-${day}`, title: '', content: '我会提前准备', tags: [],
  createdAt: Date.UTC(2026, 0, day), aiVisibility: 'allowed', isLocked: false,
}));
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
});
async function seed(count = 2) {
  const object = cognition({ status: 'candidate', confirmedAt: undefined });
  const graph = evidenceGraph([object], entries.slice(0, count));
  await set(K.entries, entries);
  await set(AVATAR_ONTOLOGY_KEY, graph);
  return { object, graph };
}
it('confirms with live independent evidence and the explicit visibility choice', async () => {
  const { graph, object } = await seed();
  await reviewArchiveCognition(graph, object, 'confirmed', false);
  expect((await readAvatarOntology()).objects[0]).toMatchObject({
    status: 'confirmed', privacy: { aiVisible: false },
  });
});
it('does not confirm an inference with only one independent experience', async () => {
  const { graph, object } = await seed(1);
  await expect(reviewArchiveCognition(graph, object, 'confirmed', true)).rejects.toThrow();
  expect(await readAvatarOntology()).toEqual(graph);
});
it('rejects a stale review without changing the updated graph', async () => {
  const { graph, object } = await seed();
  const newer = { ...graph, revision: graph.revision + 1 };
  await set(AVATAR_ONTOLOGY_KEY, newer);
  await expect(reviewArchiveCognition(graph, object, 'confirmed', true)).rejects.toThrow('已更新');
  expect(await readAvatarOntology()).toEqual(newer);
});
it('rechecks source privacy before confirming', async () => {
  const { graph, object } = await seed();
  await set(K.entries, entries.map((entry) => ({ ...entry, aiVisibility: 'private' })));
  await expect(reviewArchiveCognition(graph, object, 'confirmed', true)).rejects.toThrow();
  expect(await readAvatarOntology()).toEqual(graph);
});
it('rejection preserves original records and evidence while disabling use', async () => {
  const { graph, object } = await seed();
  await reviewArchiveCognition(graph, object, 'rejected', true);
  const saved = await readAvatarOntology();
  expect(saved.objects[0]).toMatchObject({ status: 'rejected', privacy: { aiVisible: false } });
  expect(saved.edges).toEqual(graph.edges);
  expect(await get(K.entries)).toEqual(entries);
});
it('confirms a staged revision through the review action and writes its lineage', async () => {
  const previous = cognition({
    id: 'prior', lineageId: 'prior', statement: '我总是先行动',
    evidenceGate: {
      requiresMultiSourceGate: true, independentExperienceCount: 2,
      distinctUserMessageCount: 0, distinctDateCount: 2,
      distinctSessionCount: 0, isReadyForConfirmation: true,
    },
  });
  const candidate = cognition({
    id: 'revised', lineageId: 'revised', statement: '我会提前准备',
    status: 'candidate', confirmedAt: undefined,
    pendingRevision: { previousObjectId: 'prior', reason: '后来改变了做法' },
  });
  const graph = evidenceGraph([previous, candidate], entries);
  await set(K.entries, entries);
  await set(AVATAR_ONTOLOGY_KEY, graph);
  await reviewArchiveCognition(graph, candidate, 'confirmed', true);
  const saved = await readAvatarOntology();
  expect(saved.objects.find((item) => item.id === 'prior')?.status).toBe('superseded');
  expect(saved.objects.find((item) => item.id === 'revised')).toMatchObject({
    status: 'confirmed', lineageId: 'prior', version: 2,
  });
  expect(saved.objects.find((item) => item.id === 'revised')?.pendingRevision).toBeUndefined();
  expect(saved.edges).toContainEqual(expect.objectContaining({
    type: 'SUPERSEDES', fromId: 'revised', toId: 'prior', revisionReason: '后来改变了做法',
  }));
});
