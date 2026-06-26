import { get, set } from 'idb-keyval';
import { Container, DiaryEntry, Principle } from '../types';
import { getStoredString } from './browserStorage';
import { DIARY_LEGACY_KEYS, getDiaryStorageKeys, mirrorDiaryValue } from './diaryStorage';
import { asLegacyEntry, getEntryTimestamp } from './entryCompat';
import { generateSecureId } from './idGenerator';

export interface DiaryMigrationResult {
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
    return null;
  }
};

const normalizeLegacyEntry = (item: unknown): DiaryEntry => {
  const entry = asLegacyEntry(item);
  const timestamp = getEntryTimestamp(entry) || Date.now();
  return {
    id: entry.id || generateSecureId('v1'),
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
      result.entries.push(...value.map(normalizeLegacyEntry));
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
      result.entries.push(normalizeLegacyEntry(entry));
    }
  }
};

export const dedupeMigrationResult = (result: DiaryMigrationResult): DiaryMigrationResult => {
  const uniqueEntriesMap = new Map<string, DiaryEntry>();
  result.entries.forEach((item) => {
    if (item && item.id && !uniqueEntriesMap.has(item.id)) uniqueEntriesMap.set(item.id, item);
  });

  const contentSet = new Set<string>();
  const entries = Array.from(uniqueEntriesMap.values()).filter((item) => {
    if (!item.content) return true;
    const hash = item.content.trim().substring(0, 100);
    if (contentSet.has(hash)) return false;
    contentSet.add(hash);
    return true;
  });

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
    entries: [],
    principles: [],
    containers: [],
    passwordHash: null,
    passwordSalt: null,
  };
  const legacyKeys = getLegacyStorageKeys(userId);

  for (let index = 0; index < legacyKeys.length; index += 1) {
    const key = legacyKeys[index];
    try {
      const localValue = getStoredString(key);
      const idbValue = await get(key).catch(() => undefined);
      const value = idbValue ?? parseLocalValue(localValue);
      collectLegacyValue(key, value, result);
    } catch (error) {
      console.warn(`Scan error for ${key}:`, error);
    }

    options.onProgress?.(Math.floor(5 + (index / legacyKeys.length) * 10));
    if (options.delayMs) await delayMigrationStep(options.delayMs);
  }

  return dedupeMigrationResult(result);
};

export const persistMigrationResult = async (
  userId: string | undefined,
  result: DiaryMigrationResult,
) => {
  const keys = getDiaryStorageKeys(userId);

  if (result.entries.length > 0) {
    await set(keys.entries, result.entries).catch(() => {});
    mirrorDiaryValue(keys.entries, JSON.stringify(result.entries));
  }

  if (result.principles.length > 0) {
    await set(keys.principles, result.principles).catch(() => {});
    mirrorDiaryValue(keys.principles, JSON.stringify(result.principles));
  }

  if (result.containers.length > 0) {
    await set(keys.containers, result.containers).catch(() => {});
    mirrorDiaryValue(keys.containers, JSON.stringify(result.containers));
  }

  if (result.passwordHash) {
    // Sensitive: never mirror password hash to localStorage.
    await set(keys.passwordHash, result.passwordHash).catch(() => {});
  }

  if (result.passwordSalt) {
    await set(keys.passwordSalt, result.passwordSalt).catch(() => {});
  }
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
