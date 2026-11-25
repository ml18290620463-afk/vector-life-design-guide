import { beforeEach, describe, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { SecurityService } from './securityService';
import { changeFutureProtection } from './vaultTransaction';
import {
  AVATAR_MIGRATION_SNAPSHOT_KEY as snapshotKey,
  AVATAR_MIGRATION_RESULT_KEY as resultKey,
} from './avatarOntologyKey';
import { convertAvatarV1Snapshot } from './avatarOntologyMigration';
import {
  decodeAvatarMigrationCheckpoint,
  reencryptAvatarMigrationCheckpoint,
} from './avatarOntologyMigrationCheckpoint';
import { encryptVaultBackupFile } from './vaultBackupFile';

const password = 'original-secret';
const nextPassword = 'replacement-secret';
const raw = { sessions: null, understandings: null, atoms: '[]', relations: null, tags: null };
async function checkpoint() {
  return {
    snapshot: await encryptVaultBackupFile(
      { version: 1, accountId: null, capturedAt: '2026-11-24T00:00:00.000Z', raw },
      password,
    ),
    result: await encryptVaultBackupFile(convertAvatarV1Snapshot(raw), password),
  };
}
async function seed() {
  const value = await checkpoint();
  await set(snapshotKey, value.snapshot);
  await set(resultKey, value.result);
  await set(K.passwordHash, await SecurityService.hashPassword(password, 'old-salt'));
  await set(K.passwordSalt, 'old-salt');
  return value;
}
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: password, isUnlocked: true });
});
describe('encrypted migration archive transport and rotation', () => {
  it('rebinds an explicitly restored archive while preserving exact raw bytes', async () => {
    const source = await checkpoint();
    const next = await reencryptAvatarMigrationCheckpoint(
      source,
      password,
      nextPassword,
      'target-account',
    );
    expect(
      (await decodeAvatarMigrationCheckpoint(next, nextPassword, 'target-account')).snapshot.raw,
    ).toEqual(raw);
    await expect(decodeAvatarMigrationCheckpoint(next, password)).rejects.toThrow();
    await expect(decodeAvatarMigrationCheckpoint(next, nextPassword, null)).rejects.toThrow(
      '校验失败',
    );
    expect((await decodeAvatarMigrationCheckpoint(source, password, null)).snapshot.raw).toEqual(
      raw,
    );
  });
  it('rotates both archives and credentials together', async () => {
    await seed();
    const hash = await SecurityService.hashPassword(nextPassword, 'new-salt');
    await changeFutureProtection(nextPassword, hash, 'new-salt');
    const next = { snapshot: await get(snapshotKey), result: await get(resultKey) };
    expect((await decodeAvatarMigrationCheckpoint(next, nextPassword, null)).snapshot.raw).toEqual(
      raw,
    );
    expect(await get(K.passwordHash)).toBe(hash);
    expect(await get(K.passwordSalt)).toBe('new-salt');
    await expect(decodeAvatarMigrationCheckpoint(next, password)).rejects.toThrow();
  });
  it('blocks password removal without changing the archive or credentials', async () => {
    const original = await seed();
    const hash = await get(K.passwordHash);
    await expect(changeFutureProtection(null)).rejects.toThrow('不能移除密码');
    expect(await get(snapshotKey)).toEqual(original.snapshot);
    expect(await get(resultKey)).toEqual(original.result);
    expect(await get(K.passwordHash)).toBe(hash);
  });
  it('rejects missing or corrupted paired results before committing credentials', async () => {
    const original = await seed();
    const hash = await get(K.passwordHash);
    for (const bad of [undefined, await encryptVaultBackupFile({ invalid: true }, password)]) {
      await set(resultKey, bad);
      await expect(changeFutureProtection(nextPassword, 'new-hash', 'new-salt')).rejects.toThrow();
      expect(await get(K.passwordHash)).toBe(hash);
      expect(await get(snapshotKey)).toEqual(original.snapshot);
      expect(await get(resultKey)).toEqual(bad);
    }
  });
  it('blocks locked rotation without touching recovery material', async () => {
    const original = await seed();
    useAppStore.setState({ isUnlocked: false });
    await expect(changeFutureProtection(nextPassword, 'new-hash', 'new-salt')).rejects.toThrow(
      '解锁',
    );
    expect(await get(snapshotKey)).toEqual(original.snapshot);
    expect(await get(resultKey)).toEqual(original.result);
  });
});
