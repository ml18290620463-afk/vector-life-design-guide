import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { loadNowDraft, saveNowDraft } from './nowDraftRepository';
import { PRIVATE_DRAFT_KEY } from './privateDraftKey';
import { createEmptyDraft } from '../features/now/state/nowRules';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { exportVaultBackup, importVaultBackup } from './vaultBackup';

beforeEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
const draft = () => ({ ...createEmptyDraft(), text: '需要可靠保存的私人草稿' });
describe('protected drafts and backup recovery', () => {
  it('migrates legacy data only after commit and keeps a stable submission ID', async () => {
    const legacy = { ...draft(), submission_id: undefined };
    localStorage.setItem('now_draft', JSON.stringify(legacy));
    const loaded = await loadNowDraft();
    expect(loaded.draft?.text).toBe(legacy.text);
    expect(loaded.draft?.submission_id).toBeTruthy();
    expect(localStorage.getItem('now_draft')).toBeNull();
    expect((await loadNowDraft()).draft?.submission_id).toBe(loaded.draft?.submission_id);
  });
  it('rejects stale writes even after a discard tombstone', async () => {
    const first = await saveNowDraft(draft(), 0);
    await expect(saveNowDraft(draft(), 0)).rejects.toThrow('另一页面');
    await saveNowDraft(null, first.revision);
    await expect(saveNowDraft(draft(), first.revision)).rejects.toThrow('另一页面');
    expect((await loadNowDraft()).draft).toBeNull();
  });
  it('preserves malformed legacy material instead of silently overwriting it', async () => {
    const raw = JSON.stringify({ ...draft(), materials: [null] });
    localStorage.setItem('now_draft', raw);
    await expect(loadNowDraft()).rejects.toThrow('格式');
    expect(localStorage.getItem('now_draft')).toBe(raw);
    expect(await get(PRIVATE_DRAFT_KEY)).toBeUndefined();
  });
  it('keeps a legacy draft when the vault is locked', async () => {
    localStorage.setItem('now_draft', JSON.stringify(draft()));
    await set(K.passwordHash, 'protected-vault');
    useAppStore.setState({ isUnlocked: false });
    await expect(loadNowDraft()).rejects.toThrow('解锁');
    expect(localStorage.getItem('now_draft')).toContain('私人草稿');
    expect(await get(PRIVATE_DRAFT_KEY)).toBeUndefined();
  });
  it('round trips drafts and rejects a merge conflict without altering local data', async () => {
    const original = await saveNowDraft(draft(), 0);
    const backup = await exportVaultBackup('test');
    expect(backup.vault.draft).toEqual(original.draft);
    const changed = await saveNowDraft(
      { ...original.draft!, text: '另一份草稿' },
      original.revision,
    );
    await expect(importVaultBackup(backup, 'merge')).rejects.toThrow('不同草稿');
    expect((await loadNowDraft()).draft?.text).toBe('另一份草稿');
    await importVaultBackup(backup, 'replace');
    const restored = await loadNowDraft();
    expect(restored.draft).toEqual(original.draft);
    expect(restored.revision).toBeGreaterThan(changed.revision);
    await expect(saveNowDraft(draft(), changed.revision)).rejects.toThrow('另一页面');
  });
});
