import { beforeEach, expect, it } from 'vitest';
import { clear, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { cognition } from '../tests/fixtures/avatarOntology';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { inspectAvatarMemoryHealth, readAvatarPendingInbox } from './avatarDecayScheduler';
import { readAvatarOntology } from './avatarOntologyStore';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ isUnlocked: true, masterPassword: null });
});

it('keeps an unreviewed candidate after more than 24 hours without mutating its evidence', async () => {
  const candidate = cognition({
    id: 'old-candidate', lineageId: 'old-candidate', status: 'candidate',
    confirmedAt: undefined, createdAt: new Date(0).toISOString(),
  });
  const graph = { ontologySchemaVersion: 2 as const, revision: 0, objects: [candidate], edges: [] };
  await set(AVATAR_ONTOLOGY_KEY, graph);
  const afterThirtyDays = 30 * 86400000;
  expect((await readAvatarPendingInbox()).map((item) => item.id)).toEqual(['old-candidate']);
  expect((await inspectAvatarMemoryHealth(afterThirtyDays)).expiredCandidateIds).toEqual([]);
  expect((await readAvatarOntology()).objects).toEqual([candidate]);
});
