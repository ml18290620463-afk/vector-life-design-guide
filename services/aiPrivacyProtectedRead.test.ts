import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { aiPrivacyToken, assertAIPrivacyUnchanged, readAIPrivacy } from './aiPrivacy';
import { DiaryStorageKeys as K } from './diaryStorage';
import { SecurityService } from './securityService';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { VaultLockedError } from './vaultTransaction';
import type { ActionItem } from '../types';

const password = 'Privacy-read-test-123!';
const actions: ActionItem[] = [
  {
    id: 'action',
    title: '允许的行动',
    status: 'active',
    createdAt: 1,
    aiVisibility: 'allowed',
    aiConsentAt: 1,
  },
];
async function protect() {
  const salt = 'privacy-read-salt';
  await set(K.passwordHash, await SecurityService.hashPassword(password, salt));
  await set(K.passwordSalt, salt);
  await set(K.actions, {
    format: 'vector-private-v1',
    ciphertext: await SecurityService.encrypt(JSON.stringify(actions), password),
  });
  useAppStore.setState({ isUnlocked: true, masterPassword: password });
}
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ isUnlocked: true, masterPassword: null });
});
afterEach(() => vi.restoreAllMocks());
it('reads encrypted action consent without exposing or replacing the stored envelope', async () => {
  await protect();
  const before = await get(K.actions);
  expect((await readAIPrivacy()).token).toBe(aiPrivacyToken([], undefined, actions));
  expect(await get(K.actions)).toEqual(before);
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
});
it('blocks locked permission reads', async () => {
  await protect();
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await expect(readAIPrivacy()).rejects.toBeInstanceOf(VaultLockedError);
});
it('rejects lock-unlock ABA during decryption', async () => {
  await protect();
  const decrypt = SecurityService.decrypt.bind(SecurityService);
  vi.spyOn(SecurityService, 'decrypt').mockImplementationOnce(async (...args) => {
    useAppStore.setState({ isUnlocked: false });
    useAppStore.setState({ isUnlocked: true });
    return decrypt(...args);
  });
  await expect(readAIPrivacy()).rejects.toBeInstanceOf(VaultLockedError);
});
it('rejects a permission update during decryption instead of returning stale consent', async () => {
  await protect();
  const decrypt = SecurityService.decrypt.bind(SecurityService);
  vi.spyOn(SecurityService, 'decrypt').mockImplementationOnce(async (...args) => {
    await set(K.entries, [{ id: 'concurrent-revocation', aiVisibility: 'private' }]);
    return decrypt(...args);
  });
  await expect(readAIPrivacy()).rejects.toThrow('同时发生了更新');
});
it('reads a fresh passwordless account without initializing Avatar', async () => {
  expect(await readAIPrivacy()).toEqual({
    entries: [],
    token: aiPrivacyToken([]),
    cognitiveContext: [],
  });
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
});

it('leaves legacy candidates byte-for-byte intact during passwordless permission checks', async () => {
  const keys = ['vector:avatar:atomic-memories:v1', 'vector:avatar:understandings:v1'];
  const original = '[ { "id": "expired-candidate", "status": "pending", "createdAt": 1 } ]';
  for (const key of keys) localStorage.setItem(key, original);
  await readAIPrivacy();
  await readAIPrivacy();
  for (const key of keys) expect(localStorage.getItem(key)).toBe(original);
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
});
it('rejects a malformed ontology instead of issuing a permission token', async () => {
  await set(AVATAR_ONTOLOGY_KEY, { ontologySchemaVersion: 2, objects: [] });
  await expect(readAIPrivacy()).rejects.toThrow();
});
it('invalidates an in-flight token when an allowed source is revised, locked or revoked', async () => {
  const entry = {
    id: 'source', title: '原题', content: '原文', tags: ['工作'], createdAt: 1,
    aiVisibility: 'allowed' as const, aiConsentAt: 1, isLocked: false,
  };
  for (const changed of [
    { ...entry, content: '修订后的原文' },
    { ...entry, isLocked: true },
    { ...entry, aiVisibility: 'private' as const },
  ]) {
    await set(K.entries, [entry]);
    const before = (await readAIPrivacy()).token;
    await set(K.entries, [changed]);
    await expect(assertAIPrivacyUnchanged(before)).rejects.toThrow('权限已变化');
    const next = await readAIPrivacy();
    expect(next.token).not.toBe(before);
  }
});
