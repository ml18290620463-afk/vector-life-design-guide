import { beforeEach, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { wipeVault } from './vaultWipe';
import { AVATAR_V1_KEYS } from './avatarLegacyTypes';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from './avatarOntologyKey';
import { useAppStore } from '../stores/appStore';

beforeEach(async () => {
  localStorage.clear();
  await clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
it('explicit vault wipe removes v2 graph, encrypted migration archives and every legacy mirror', async () => {
  const keys = [
    AVATAR_ONTOLOGY_KEY,
    AVATAR_MIGRATION_SNAPSHOT_KEY,
    AVATAR_MIGRATION_RESULT_KEY,
    ...Object.values(AVATAR_V1_KEYS),
  ];
  for (const key of keys) {
    await set(key, { protectedPayload: 'must be removed' });
    localStorage.setItem(key, 'historical mirror');
  }
  await set('unrelated-preference', 'preserved');
  await wipeVault();
  for (const key of keys) {
    expect(await get(key), key).toBeUndefined();
    expect(localStorage.getItem(key), key).toBeNull();
  }
  expect(await get('unrelated-preference')).toBe('preserved');
});
