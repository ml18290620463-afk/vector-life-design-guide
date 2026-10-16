import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import type { DiaryEntry } from '../types';
import { appendEntrySupplement, assertEntryUnchanged } from './entryIntegrity';
import { commitArrayDelta } from './vaultTransaction';
import { sanitizeDiaryEntry } from './diaryDataRead';
import { getDiaryStorageKeys } from './diaryStorage';
import { useAppStore } from '../stores/appStore';
import { SecurityService } from './securityService';

const keys = getDiaryStorageKeys('append-test');
const entry: DiaryEntry = {
  id: 'original',
  title: '记录',
  content: '原文',
  createdAt: 10,
  tags: ['工作'],
  isLocked: false,
  nowMaterials: [{ id: 'photo', type: 'image', url: 'data:image/png;base64,a', sort_order: 0 }],
};
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await set(keys.entries, [entry]);
});
describe('record integrity', () => {
  it.each([
    { content: '覆盖' },
    { title: '覆盖' },
    { createdAt: 20 },
    { tags: [] },
    { nowMaterials: [] },
    { supplements: [{ id: 'forged', content: '伪造', createdAt: 1 }] },
  ])('rejects original changes in the transaction: %o', async (change) => {
    await expect(
      commitArrayDelta<DiaryEntry>(
        keys.entries,
        [entry],
        [{ ...entry, ...change }],
        keys.backup,
        sanitizeDiaryEntry,
        assertEntryUnchanged,
      ),
    ).rejects.toThrow('历史记录不可修改');
    expect(await get(keys.entries)).toEqual([entry]);
  });
  it('allows derived links without rewriting evidence', async () => {
    await commitArrayDelta<DiaryEntry>(
      keys.entries,
      [entry],
      [{ ...entry, relatedEntryIds: ['other'] }],
      keys.backup,
      sanitizeDiaryEntry,
      assertEntryUnchanged,
    );
    expect((await get(keys.entries))[0]).toEqual({ ...entry, relatedEntryIds: ['other'] });
  });
  it('preserves concurrent supplements, recording times, retries and reloads', async () => {
    const before = Date.now();
    await Promise.all([
      appendEntrySupplement(keys, entry.id, '后来想起 A', 'a'),
      appendEntrySupplement(keys, entry.id, '后来想起 B', 'b'),
    ]);
    await appendEntrySupplement(keys, entry.id, '后来想起 A', 'a');
    const saved = (await get(keys.entries))[0] as DiaryEntry;
    expect(saved).toMatchObject(entry);
    expect(saved.createdAt).toBe(10);
    expect(saved.supplements).toHaveLength(2);
    expect(saved.supplements!.every((item) => item.createdAt >= before)).toBe(true);
    expect(sanitizeDiaryEntry(saved).supplements).toEqual(saved.supplements);
    expect(await get(keys.backup)).toEqual([saved]);
    await expect(appendEntrySupplement(keys, entry.id, '覆盖 A', 'a')).rejects.toThrow(
      '补充已保存',
    );
    await expect(
      commitArrayDelta<DiaryEntry>(
        keys.entries,
        [saved],
        [{ ...saved, supplements: [] }],
        keys.backup,
        sanitizeDiaryEntry,
        assertEntryUnchanged,
      ),
    ).rejects.toThrow('历史记录不可修改');
  });
  it('rejects inaccessible records', async () => {
    await set(keys.entries, [{ ...entry, isLocked: true }]);
    await expect(appendEntrySupplement(keys, entry.id, '补充', 'a')).rejects.toThrow(
      '请先解锁记录',
    );
  });
  it('requires the correct password before appending to an encrypted record', async () => {
    const original = await SecurityService.encrypt('原文', 'right-password');
    await set(keys.entries, [{ ...entry, content: original, isEncrypted: true }]);
    await expect(appendEntrySupplement(keys, entry.id, '补充', 'wrong', 'wrong-password')).rejects.toThrow('密令不正确');
    expect(((await get(keys.entries)) as DiaryEntry[])[0].supplements).toBeUndefined();
    await appendEntrySupplement(keys, entry.id, '补充', 'right', 'right-password');
    const saved = ((await get(keys.entries)) as DiaryEntry[])[0];
    expect(saved.content).toBe(original);
    expect(saved.supplements?.[0].isEncrypted).toBe(true);
    expect(await SecurityService.decrypt(saved.supplements![0].content, 'right-password')).toBe('补充');
  });
});
