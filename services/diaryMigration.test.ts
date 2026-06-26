import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as idb from 'idb-keyval';
import { getLegacyStorageKeys, mergeMigrationEntries, scanLegacyDiaryData } from './diaryMigration';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
}));

describe('diaryMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(idb.get).mockResolvedValue(undefined);
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

    expect(result.entries.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('collects password metadata from legacy keys', async () => {
    vi.mocked(idb.get).mockImplementation((key: IDBValidKey) => {
      if (key === 'vector_pwd_hash_user-1') return Promise.resolve('hash');
      if (key === 'vector_pwd_salt_user-1') return Promise.resolve('salt');
      return Promise.resolve(undefined);
    });

    const result = await scanLegacyDiaryData('user-1');

    expect(result.passwordHash).toBe('hash');
    expect(result.passwordSalt).toBe('salt');
  });

  it('keeps migrated entries ahead of existing entries when merging', () => {
    expect(
      mergeMigrationEntries(
        [{ id: 'new', title: 'New', content: '', createdAt: 1, tags: [], isLocked: false }],
        [{ id: 'old', title: 'Old', content: '', createdAt: 1, tags: [], isLocked: false }],
      ).map((entry) => entry.id),
    ).toEqual(['new', 'old']);
  });
});
