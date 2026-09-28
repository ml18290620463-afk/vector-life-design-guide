import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as idb from 'idb-keyval';
import {
  getLegacyStorageKeys,
  mergeMigrationEntries,
  scanLegacyDiaryData,
  persistMigrationResult,
} from './diaryMigration';
import { DiaryStorageKeys as K } from './diaryStorage';
import { wipeVault } from './vaultWipe';

vi.mock('idb-keyval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('idb-keyval')>();
  return { ...actual, get: vi.fn(actual.get) };
});

const entry = (id: string) => ({
  id,
  title: id,
  content: 'same-content',
  createdAt: 1,
  tags: [],
  isLocked: false,
});
const migration = () => ({
  entries: [entry('legacy')],
  principles: [],
  containers: [],
  passwordHash: null,
  passwordSalt: null,
});

describe('diaryMigration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await idb.clear();
    localStorage.clear();
  });

  it('includes user-specific legacy keys', () => {
    expect(getLegacyStorageKeys('alice')).toContain('vector_data_alice');
    expect(getLegacyStorageKeys('alice')).toContain('vector_pwd_salt_alice');
  });

  it('scans and deduplicates legacy localStorage entries', async () => {
    localStorage.setItem(
      'vector_data_guest',
      JSON.stringify([
        { id: 'a', title: 'A', content: 'same-content' },
        { id: 'b', title: 'B', content: 'same-content' },
        { id: 'c', title: 'C', content: 'unique-content' },
      ]),
    );

    const result = await scanLegacyDiaryData(undefined);

    expect(result.entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('collects password metadata from legacy keys', async () => {
    await idb.set('vector_pwd_hash_user-1', 'hash');
    await idb.set('vector_pwd_salt_user-1', 'salt');

    const result = await scanLegacyDiaryData('user-1');

    expect(result.passwordHash).toBe('hash');
    expect(result.passwordSalt).toBe('salt');
  });

  it('gives ID-less records stable identities without collapsing identical experiences', async () => {
    localStorage.setItem(
      'vector_data_guest',
      JSON.stringify([{ content: '同一天同样的记录' }, { content: '同一天同样的记录' }]),
    );
    const first = await scanLegacyDiaryData(undefined);
    await persistMigrationResult(undefined, first);
    const second = await scanLegacyDiaryData(undefined);
    expect(second.entries).toEqual(first.entries);
    await persistMigrationResult(undefined, second);
    expect(await idb.get(K.entries)).toHaveLength(2);
  });

  it('does not attach an unrelated migration salt to an existing unsalted password', async () => {
    await idb.set(K.passwordHash, 'current-hash');
    await persistMigrationResult(undefined, {
      ...migration(),
      passwordHash: 'legacy-hash',
      passwordSalt: 'legacy-salt',
    });
    expect(await idb.get(K.passwordHash)).toBe('current-hash');
    expect(await idb.get(K.passwordSalt)).toBeUndefined();
  });

  it('keeps migrated entries ahead of existing entries when merging', () => {
    expect(
      mergeMigrationEntries(
        [{ id: 'new', title: 'New', content: '', createdAt: 1, tags: [], isLocked: false }],
        [{ id: 'old', title: 'Old', content: '', createdAt: 1, tags: [], isLocked: false }],
      ).map((entry) => entry.id),
    ).toEqual(['new', 'old']);
  });

  it('keeps current records and commits migration and initialization together', async () => {
    await idb.set(K.entries, [entry('current'), { ...entry('legacy'), content: 'newer edit' }]);
    await persistMigrationResult(undefined, migration());
    expect(await idb.get(K.entries)).toEqual([
      { ...entry('legacy'), content: 'newer edit' },
      entry('current'),
    ]);
    expect(await idb.get(K.backup)).toEqual(await idb.get(K.entries));
    expect(await idb.get(K.initializedFlag)).toBe(true);
    await persistMigrationResult(undefined, migration());
    expect(await idb.get(K.entries)).toHaveLength(2);
  });

  it('rejects unreadable legacy storage instead of reporting success', async () => {
    localStorage.setItem('vector_data_guest', '[broken');
    await expect(scanLegacyDiaryData(undefined)).rejects.toThrow('迁移未完成');
    expect(await idb.get(K.initializedFlag)).toBeUndefined();
    vi.mocked(idb.get).mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(scanLegacyDiaryData(undefined)).rejects.toThrow('storage unavailable');
  });

  it('rolls back all domains when an existing domain is corrupt', async () => {
    await idb.set(K.entries, [entry('current')]);
    await idb.set(K.containers, { invalid: true });
    await expect(persistMigrationResult(undefined, migration())).rejects.toThrow('格式无效');
    expect(await idb.get(K.entries)).toEqual([entry('current')]);
    expect(await idb.get(K.backup)).toBeUndefined();
    expect(await idb.get(K.initializedFlag)).toBeUndefined();
    expect(localStorage.getItem(K.entries)).toBeNull();
  });

  it('seeds once under concurrent initialization and never re-seeds an explicit empty vault', async () => {
    const empty = { ...migration(), entries: [] };
    await Promise.all([
      persistMigrationResult(undefined, empty, [entry('sample-a')]),
      persistMigrationResult(undefined, empty, [entry('sample-b')]),
    ]);
    expect(await idb.get(K.entries)).toHaveLength(1);
    await idb.set(K.entries, []);
    await persistMigrationResult(undefined, empty, [entry('sample-c')]);
    expect(await idb.get(K.entries)).toEqual([]);
  });

  it('clears user-specific legacy records and secrets so a scan cannot resurrect them', async () => {
    for (const key of [
      'vector_data_alice',
      'vector_principles_alice',
      'vector_pwd_hash_alice',
      'vector_pwd_salt_alice',
    ]) {
      await idb.set(key, key.includes('pwd') ? 'secret' : [entry('deleted')]);
      localStorage.setItem(
        key,
        key.includes('pwd') ? 'secret' : JSON.stringify([entry('deleted')]),
      );
    }
    await wipeVault('alice');
    expect(await scanLegacyDiaryData('alice')).toEqual({
      ...migration(),
      entries: [],
      scanEpoch: 1,
    });
    expect(await idb.get(K.initializedFlag)).toBe(true);
  });

  it('rejects a scan captured before a wipe without restoring records or credentials', async () => {
    await idb.set('vector_data_alice', [entry('deleted')]);
    await idb.set('vector_pwd_hash_alice', 'old-secret');
    const stale = await scanLegacyDiaryData('alice');
    await wipeVault('alice');
    await expect(persistMigrationResult('alice', stale, [entry('sample')])).rejects.toThrow(
      '已清空',
    );
    expect(await idb.get(K.entries)).toEqual([]);
    expect(await idb.get(K.backup)).toEqual([]);
    expect(await idb.get(K.passwordHash)).toBeUndefined();
    expect(localStorage.getItem(K.entries)).toBeNull();
    const fresh = await scanLegacyDiaryData('alice');
    await persistMigrationResult('alice', fresh, [entry('sample')]);
    expect(await idb.get(K.entries)).toEqual([]);
  });
});
