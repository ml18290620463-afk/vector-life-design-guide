import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { DiaryStorageKeys as K } from './diaryStorage';
import { useAppStore } from '../stores/appStore';
import { SecurityService } from './securityService';
import { changeFutureProtection, BACKUP_RESTORE_JOB } from './vaultTransaction';
import {
  exportVaultBackup,
  exportVaultBackupFile,
  importVaultBackup,
  recoverBackupRestore,
  type VaultBackup,
} from './vaultBackup';
import { decryptVaultBackupFile, isEncryptedVaultBackup } from './vaultBackupFile';
import { saveNowDraft, loadNowDraft } from './nowDraftRepository';
import { createEmptyDraft } from '../features/now/state/nowRules';
import { saveGoal, saveFutureAction, readFutureSnapshot } from './futureRepository';

const password = '备份原密码-123';
const cache = 'vector:avatar:atomic-memories:v1';
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
afterEach(() => vi.restoreAllMocks());
async function protect(pwd = password) {
  const salt = 'backup-test-salt';
  await changeFutureProtection(pwd, await SecurityService.hashPassword(pwd, salt), salt);
  useAppStore.setState({ masterPassword: pwd, isUnlocked: true });
}
async function fixture() {
  await set(K.entries, [
    { id: 'e1', title: '记录', content: '私人经历', tags: [], createdAt: 1, isLocked: false },
  ]);
  await saveNowDraft({ ...createEmptyDraft(), text: '私人草稿' }, 0);
  const goal = await saveGoal({
    title: '改善沟通',
    status: 'active',
    measurement: { kind: 'narrative' },
    tags: [],
  });
  await saveFutureAction({ title: '先确认范围', status: 'pending', goalId: goal.id });
  localStorage.setItem(
    cache,
    JSON.stringify([{ id: 'memory', statement: '私人理解', status: 'confirmed' }]),
  );
  await protect();
  const entries = await get(K.entries);
  await set(
    K.entries,
    await Promise.all(
      entries.map(async (e: { content: string }) => ({
        ...e,
        content: await SecurityService.encrypt(e.content, password),
        isEncrypted: true,
      })),
    ),
  );
  const file = await exportVaultBackupFile('test');
  if (!isEncryptedVaultBackup(file)) throw new Error('Expected encrypted file');
  return file;
}
it('restores all protected domains in an empty browser storage and repeated merge is idempotent', async () => {
  const file = await fixture();
  expect(JSON.stringify(file)).not.toMatch(/私人|entryCount|passwordHash/);
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await importVaultBackup(backup, 'merge', undefined, password);
  await importVaultBackup(backup, 'merge', undefined, password);
  expect(await get(K.entries)).toHaveLength(1);
  expect((await get(K.entries))[0].isEncrypted).toBe(true);
  expect(await SecurityService.decrypt((await get(K.entries))[0].content, password)).toBe(
    '私人经历',
  );
  expect((await loadNowDraft()).draft?.text).toBe('私人草稿');
  expect((await readFutureSnapshot()).state.goals).toHaveLength(1);
  expect((await readFutureSnapshot()).actions).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(cache)!)).toHaveLength(1);
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
  useAppStore.setState({ masterPassword: null, isUnlocked: false });
  await expect(loadNowDraft()).rejects.toThrow('解锁');
}, 30_000);
it('preserves a protected destination password while importing a differently encrypted file', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await protect('本机密码-456');
  const hash = await get(K.passwordHash);
  await importVaultBackup(backup, 'merge', undefined, password);
  expect(await get(K.passwordHash)).toBe(hash);
  expect(await SecurityService.decrypt((await get(K.entries))[0].content, '本机密码-456')).toBe(
    '私人经历',
  );
}, 30_000);
it('rejects wrong passwords, damaged ciphertext, authenticated header changes and unsupported versions without writes', async () => {
  const file = await fixture();
  const before = await get(K.entries);
  await expect(decryptVaultBackupFile(file, 'wrong')).rejects.toThrow('未导入');
  await expect(decryptVaultBackupFile({ ...file, ciphertext: 'AAAA' }, password)).rejects.toThrow(
    '未导入',
  );
  await expect(
    decryptVaultBackupFile({ ...file, salt: btoa('1234567890123456') }, password),
  ).rejects.toThrow('未导入');
  await expect(
    decryptVaultBackupFile({ ...file, schemaVersion: 2 } as never, password),
  ).rejects.toThrow('不支持');
  expect(await get(K.entries)).toEqual(before);
}, 30_000);
it('rejects conflicting entry content atomically before replacing any destination domain', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  backup.entries[0].content = '冲突内容';
  backup.vault.data.entries = backup.entries;
  const before = await get(K.entries),
    future = await get(K.future);
  await expect(importVaultBackup(backup, 'merge', undefined, password)).rejects.toThrow('编号冲突');
  expect(await get(K.entries)).toEqual(before);
  expect(await get(K.future)).toEqual(future);
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
}, 30_000);
it('keeps an encrypted recovery job after local cache failure and retries only after unlock', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  const original = localStorage.setItem.bind(localStorage);
  let failCache = true;
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === cache && failCache) throw new Error('disk full');
    return original(key, value);
  });
  await expect(importVaultBackup(backup, 'replace', undefined, password)).rejects.toThrow(
    '数据已导入',
  );
  const job = await get(BACKUP_RESTORE_JOB);
  expect(job.format).toBe('vector-private-v1');
  expect(JSON.stringify(job)).not.toContain('私人理解');
  failCache = false;
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await recoverBackupRestore();
  expect(await get(BACKUP_RESTORE_JOB)).toEqual(job);
  useAppStore.setState({ isUnlocked: true, masterPassword: password });
  await recoverBackupRestore();
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
  expect(JSON.parse(localStorage.getItem(cache)!)[0].statement).toBe('私人理解');
}, 30_000);
it('boots a locked vault with no recovery job and blocks legacy plaintext export', async () => {
  await protect();
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await expect(recoverBackupRestore()).resolves.toBeUndefined();
  await expect(exportVaultBackup('test')).rejects.toThrow('解锁');
});
