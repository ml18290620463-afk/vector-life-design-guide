import { beforeEach, expect, it, vi } from 'vitest';
import { DiaryStorageKeys as K } from '../diaryStorage';
import { SecurityService } from '../securityService';
beforeEach(() => { vi.resetModules(); localStorage.clear(); });
async function setup() {
  const scope = await import('../accountScope');
  scope.initializeAccountScope(crypto.randomUUID());
  const db = await import('../accountIdb');
  const salt = 'test-salt';
  await db.set(K.passwordSalt, salt);
  await db.set(K.passwordHash, await SecurityService.hashPassword('test-password', salt));
  await db.set(K.entries, [{ id: 'a', text: 'private diary' }]);
  return { scope, db, api: await import('./snapshot') };
}
it('encrypts the entire snapshot and rejects wrong passwords, tampering and wrong owners', async () => {
  const { api, scope } = await setup();
  const snapshot = await api.captureSnapshot();
  const sealed = await api.sealSnapshot(snapshot, 'test-password');
  expect(JSON.stringify(sealed)).not.toContain('private diary');
  expect(await api.openSnapshot(sealed, 'test-password')).toEqual(snapshot);
  await expect(api.openSnapshot(sealed, 'wrong')).rejects.toThrow();
  await expect(api.openSnapshot({ ...sealed, ciphertext: 'AAAA' + sealed.ciphertext.slice(4) }, 'test-password')).rejects.toThrow();
  expect(() => api.validateSnapshot({ ...snapshot, owner: crypto.randomUUID() })).toThrow();
  expect(snapshot.owner).toBe(scope.currentAccountId());
});
it('refuses to seal new-password data with an old password', async () => {
  const { api } = await setup();
  await expect(api.sealSnapshot(await api.captureSnapshot(), 'old-password')).rejects.toThrow('密码已变化');
});
it('restores deletions, removes stale mirrors and retains a decryptable recovery copy', async () => {
  const { api, db, scope } = await setup();
  await db.set(K.principles, [{ id: 'old' }]);
  scope.accountLocalStorage.setItem(K.principles, '[{"id":"resurrect"}]');
  scope.accountLocalStorage.setItem(K.backup, 'old backup');
  const before = await api.captureSnapshot();
  const next = structuredClone(before);
  delete next.data[K.principles];
  next.data[K.entries] = [];
  await api.applySnapshot(next, 2, await api.fingerprint(before), 'test-password');
  expect(await db.get(K.principles)).toBeUndefined();
  expect(scope.accountLocalStorage.getItem(K.principles)).toBeNull();
  expect(scope.accountLocalStorage.getItem(K.backup)).toBeNull();
  expect(api.readSyncBase().revision).toBe(2);
  const recovery = await import('./recovery');
  const copies = await recovery.listRecoveryCopies();
  expect(copies).toHaveLength(1);
  expect(await api.openSnapshot(await recovery.readRecoveryCopy(copies[0]), 'test-password')).toEqual(before);
});
it('does not replace edits made since the cloud restore prompt', async () => {
  const { api, db } = await setup();
  const snapshot = await api.captureSnapshot();
  const expected = await api.fingerprint(snapshot);
  await db.set(K.entries, [{ id: 'newer' }]);
  await expect(api.applySnapshot(snapshot, 2, expected, 'test-password')).rejects.toThrow('已变化');
  expect(await db.get(K.entries)).toEqual([{ id: 'newer' }]);
});
it('excludes device secrets and rejects unrecognized snapshot domains', async () => {
  const { api, db } = await setup();
  await db.set(K.deviceKeypair, 'secret key');
  await db.set(K.license, 'license');
  const snapshot = await api.captureSnapshot();
  expect(snapshot.data[K.deviceKeypair]).toBeUndefined();
  expect(snapshot.data[K.license]).toBeUndefined();
  expect(() => api.validateSnapshot({ ...snapshot, data: { ...snapshot.data, unexpected: [] } })).toThrow();
});
