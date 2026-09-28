import { get } from 'idb-keyval';
import { Container, DiaryEntry, Principle } from '../types';
import { getStoredString } from './browserStorage';
import { DIARY_LEGACY_KEYS, getDiaryStorageKeys, mirrorDiaryValue } from './diaryStorage';
import { asLegacyEntry, getEntryTimestamp } from './entryCompat';
import { vaultTransaction } from './vaultTransaction';
import { storedArray } from './vaultLegacyRead';

export interface DiaryMigrationResult {
  /** Captured before scanning; a subsequent wipe invalidates the entire result. */
  scanEpoch?: number;
  entries: DiaryEntry[];
  principles: Principle[];
  containers: Container[];
  passwordHash: string | null;
  passwordSalt: string | null;
}

interface ScanOptions {
  onProgress?: (progress: number) => void;
  delayMs?: number;
}

export const delayMigrationStep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const migrationEpochKey = (userId?: string) =>
  `${getDiaryStorageKeys(userId).entries}:migration-epoch`;

export const getLegacyStorageKeys = (userId: string | undefined) => {
  const keys: string[] = [...DIARY_LEGACY_KEYS];
  if (userId) {
    keys.push(
      `vector_data_${userId}`,
      `vector_principles_${userId}`,
      `vector_pwd_hash_${userId}`,
      `vector_pwd_salt_${userId}`,
      `vector_containers_${userId}`,
    );
  }
  return keys;
};

const parseLocalValue = (raw: string | null) => {
  if (!raw) return null;
  if (!raw.startsWith('[') && !raw.startsWith('{')) return raw;

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('旧版数据格式无效，迁移未完成，请检查备份');
  }
};

const normalizeLegacyEntry = (item: unknown, sourceId: string): DiaryEntry => {
  if (!item || typeof item !== 'object' || Array.isArray(item))
    throw new Error('旧版记录格式无效，迁移未完成');
  const entry = asLegacyEntry(item);
  // A missing legacy ID/date must not produce a new record on every scan.
  const timestamp = getEntryTimestamp(entry) || 0;
  return {
    id: entry.id || sourceId,
    title: entry.title || entry.name || entry.subject || 'Legacy Record',
    content: entry.content || entry.text || entry.body || entry.details || '',
    createdAt: timestamp,
    updatedAt: entry.updatedAt || timestamp,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    isLocked: entry.isLocked ?? false,
    isEncrypted: entry.isEncrypted ?? false,
    isArchived: entry.isArchived ?? false,
    migrated: entry.migrated ?? false,
    archivedToShip: entry.archivedToShip ?? false,
  };
};

const collectLegacyValue = (key: string, value: unknown, result: DiaryMigrationResult) => {
  if (!value) return;

  const lowerKey = key.toLowerCase();
  if (Array.isArray(value)) {
    if (
      lowerKey.includes('data') ||
      lowerKey.includes('entries') ||
      lowerKey.includes('journal') ||
      lowerKey.includes('records') ||
      lowerKey.includes('notes') ||
      lowerKey.includes('vault') ||
      lowerKey.includes('diary')
    ) {
      result.entries.push(
        ...value.map((item, index) =>
          normalizeLegacyEntry(item, `legacy:${encodeURIComponent(key)}:${index}`),
        ),
      );
    } else if (lowerKey.includes('principles')) {
      result.principles.push(...value);
    } else if (lowerKey.includes('containers')) {
      result.containers.push(...value);
    }
    return;
  }

  if (typeof value === 'string') {
    if (lowerKey.includes('pwd_hash') || lowerKey.includes('hash')) {
      result.passwordHash = result.passwordHash || value;
    } else if (lowerKey.includes('pwd_salt') || lowerKey.includes('salt')) {
      result.passwordSalt = result.passwordSalt || value;
    }
    return;
  }

  if (typeof value === 'object') {
    const entry = asLegacyEntry(value);
    if (entry.id || entry.title || entry.content || entry.text) {
      result.entries.push(normalizeLegacyEntry(entry, `legacy:${encodeURIComponent(key)}:0`));
    }
  }
};

export const dedupeMigrationResult = (result: DiaryMigrationResult): DiaryMigrationResult => {
  const uniqueEntriesMap = new Map<string, DiaryEntry>();
  result.entries.forEach((item) => {
    if (item && item.id && !uniqueEntriesMap.has(item.id)) uniqueEntriesMap.set(item.id, item);
  });

  // Identical text on different dates can describe distinct experiences.
  const entries = Array.from(uniqueEntriesMap.values());

  const principles = Array.from(
    new Map(
      result.principles.filter((item) => item && item.id).map((item) => [item.id, item]),
    ).values(),
  );
  const containers = Array.from(
    new Map(
      result.containers.filter((item) => item && item.id).map((item) => [item.id, item]),
    ).values(),
  );

  return {
    ...(result.scanEpoch === undefined ? {} : { scanEpoch: result.scanEpoch }),
    entries,
    principles,
    containers,
    passwordHash: result.passwordHash,
    passwordSalt: result.passwordSalt,
  };
};

export const scanLegacyDiaryData = async (
  userId: string | undefined,
  options: ScanOptions = {},
): Promise<DiaryMigrationResult> => {
  const result: DiaryMigrationResult = {
    scanEpoch: (await get<number>(migrationEpochKey(userId))) ?? 0,
    entries: [],
    principles: [],
    containers: [],
    passwordHash: null,
    passwordSalt: null,
  };
  const legacyKeys = getLegacyStorageKeys(userId);

  for (let index = 0; index < legacyKeys.length; index += 1) {
    const key = legacyKeys[index];
    const idbValue = await get(key);
    const value = idbValue === undefined ? parseLocalValue(localStorage.getItem(key)) : idbValue;
    collectLegacyValue(key, value, result);

    options.onProgress?.(Math.floor(5 + (index / legacyKeys.length) * 10));
    if (options.delayMs) await delayMigrationStep(options.delayMs);
  }

  return dedupeMigrationResult(result);
};

export const persistMigrationResult = async (
  userId: string | undefined,
  result: DiaryMigrationResult,
  samples: DiaryEntry[] = [],
) => {
  const keys = getDiaryStorageKeys(userId);
  const epochKey = migrationEpochKey(userId);
  const committed = await vaultTransaction(
    [
      epochKey,
      keys.entries,
      keys.backup,
      keys.principles,
      keys.containers,
      keys.passwordHash,
      keys.passwordSalt,
      keys.initializedFlag,
    ],
    (values) => {
      if (result.scanEpoch !== undefined && result.scanEpoch !== (values[epochKey] ?? 0))
        throw new Error('扫描期间资料库已清空，已取消旧数据迁移。请重新扫描。');
      const existingEntries =
        storedArray<DiaryEntry>(values[keys.entries], keys.entries) ??
        storedArray<DiaryEntry>(values[keys.backup], keys.backup);
      const existingPrinciples =
        storedArray<Principle>(values[keys.principles], keys.principles) ?? [];
      const existingContainers =
        storedArray<Container>(values[keys.containers], keys.containers) ?? [];
      let entries = mergeMigrationEntries(result.entries, existingEntries ?? []);
      const principles = mergeMigrationPrinciples(result.principles, existingPrinciples);
      const containers = mergeMigrationContainers(result.containers, existingContainers);
      const initialized = values[keys.initializedFlag] ?? getStoredString(keys.initializedFlag);
      // Explicitly empty vaults (including wiped vaults) must not be re-seeded.
      if (!initialized && existingEntries === undefined && !entries.length) entries = samples;
      const existingHash = values[keys.passwordHash] ?? getStoredString(keys.passwordHash);
      const existingSalt = values[keys.passwordSalt] ?? getStoredString(keys.passwordSalt);
      // A legacy hash without a salt is valid; never pair it with another vault's salt.
      const hasCredentials = existingHash != null || existingSalt != null;
      const passwordHash = hasCredentials ? existingHash : result.passwordHash;
      const passwordSalt = hasCredentials ? existingSalt : result.passwordSalt;
      values[keys.entries] = entries;
      values[keys.backup] = entries;
      values[keys.principles] = principles;
      values[keys.containers] = containers;
      if (passwordHash) values[keys.passwordHash] = passwordHash;
      if (passwordSalt) values[keys.passwordSalt] = passwordSalt;
      values[keys.initializedFlag] = true;
      return {
        entries,
        principles,
        containers,
        passwordHash,
        passwordSalt,
        mergedEntries: entries.filter(
          (e) => !e.isSample && !existingEntries?.some((old) => old.id === e.id),
        ).length,
        mergedPrinciples: principles.length - existingPrinciples.length,
        mergedContainers: containers.length - existingContainers.length,
      };
    },
  );
  // Mirrors are optional caches; only mirror a fully committed transaction.
  mirrorDiaryValue(keys.entries, JSON.stringify(committed.entries));
  mirrorDiaryValue(keys.backup, JSON.stringify(committed.entries));
  mirrorDiaryValue(keys.principles, JSON.stringify(committed.principles));
  mirrorDiaryValue(keys.containers, JSON.stringify(committed.containers));
  mirrorDiaryValue(keys.initializedFlag, 'true');
  return committed;
};

export const mergeMigrationEntries = (
  migratedEntries: DiaryEntry[],
  existingEntries: DiaryEntry[],
) =>
  Array.from(
    new Map([...migratedEntries, ...existingEntries].map((entry) => [entry.id, entry])).values(),
  );

export const mergeMigrationPrinciples = (
  migratedPrinciples: Principle[],
  existingPrinciples: Principle[],
) =>
  Array.from(
    new Map([...migratedPrinciples, ...existingPrinciples].map((item) => [item.id, item])).values(),
  );

export const mergeMigrationContainers = (
  migratedContainers: Container[],
  existingContainers: Container[],
) =>
  Array.from(
    new Map([...migratedContainers, ...existingContainers].map((item) => [item.id, item])).values(),
  );
