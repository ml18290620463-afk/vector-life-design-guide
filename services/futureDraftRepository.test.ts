import { beforeEach, describe, expect, it } from 'vitest';
import { clear, set } from 'idb-keyval';
import { loadFutureDrafts, saveFutureDraft } from './futureDraftRepository';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { exportVaultBackup, importVaultBackup } from './vaultBackup';
import { wipeVault } from './vaultWipe';

beforeEach(async () => {
  localStorage.clear();
  await clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
const draft = (title = '阅读第一章') => ({
  fields: { title, aiVisibility: 'private' },
  updatedAt: 100,
});
describe('future draft durability', () => {
  it('retains distinct forms and rejects stale writes after cleanup', async () => {
    await saveFutureDraft('action:new', draft(), 0);
    await saveFutureDraft('goal:new', draft('完成阅读'), 1);
    await saveFutureDraft('action:new', null, 2);
    await expect(saveFutureDraft('action:new', draft(), 1)).rejects.toThrow('其他页面');
    const snapshot = await loadFutureDrafts();
    expect(snapshot.drafts['goal:new'].fields.title).toBe('完成阅读');
    expect(snapshot.drafts['action:new']).toBeUndefined();
  });
  it('round trips backups and refuses a conflicting merge', async () => {
    await saveFutureDraft('action:new', draft(), 0);
    const backup = await exportVaultBackup('test');
    await saveFutureDraft('action:new', draft('新的草稿'), 1);
    await expect(importVaultBackup(backup, 'merge')).rejects.toThrow();
    expect((await loadFutureDrafts()).drafts['action:new'].fields.title).toBe('新的草稿');
    await importVaultBackup(backup, 'replace');
    expect((await loadFutureDrafts()).drafts['action:new'].fields.title).toBe('阅读第一章');
    await expect(saveFutureDraft('action:new', draft(), 2)).rejects.toThrow('其他页面');
  });
  it('refuses access while locked', async () => {
    await set(K.passwordHash, 'protected');
    useAppStore.setState({ isUnlocked: false });
    await expect(loadFutureDrafts()).rejects.toThrow('解锁');
  });
  it('wipes drafts and advisory backup metadata together', async () => {
    await saveFutureDraft('action:new', draft(), 0);
    localStorage.setItem('vector:backup-status:v1:local', '{"generatedAt":100}');
    await wipeVault();
    expect((await loadFutureDrafts()).drafts).toEqual({});
    expect(localStorage.getItem('vector:backup-status:v1:local')).toBeNull();
  });
});
