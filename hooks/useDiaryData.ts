import { useState, useEffect, useCallback, useRef } from 'react';
import { del, get, set } from 'idb-keyval';
import { DiaryEntry, Language, Principle, Attachment, Container } from '../types';
import { AppError, reportError } from '../lib/error';
import { getSampleEntries } from '../services/sampleEntries';
import { getStoredString } from '../services/browserStorage';
import {
  DiaryStorageKeys,
  entriesPayloadExceedsMirror,
  getDiaryStorageKeys,
  mirrorDiaryValue,
  readDiaryJson,
  readDiaryString,
  removeDiaryMirror,
} from '../services/diaryStorage';
import { generateSecureId } from '../services/idGenerator';
import {
  mergeMigrationContainers,
  mergeMigrationEntries,
  mergeMigrationPrinciples,
  persistMigrationResult,
  scanLegacyDiaryData,
  delayMigrationStep,
} from '../services/diaryMigration';
import { asLegacyEntry } from '../services/entryCompat';

export type ImportBackupMode = 'merge' | 'replace';

export interface ImportBackupSummary {
  mode: ImportBackupMode;
  importedCount: number;
  totalAfter: number;
}

export interface ScanSummary {
  status: 'success' | 'error';
  finishedAt: number;
  /** Counts of newly merged items in each domain. */
  mergedEntries: number;
  mergedPrinciples: number;
  mergedContainers: number;
  /** Present when status === 'error'. */
  error?: string;
}

const sanitizeEntry = (entry: unknown): DiaryEntry => {
  const safeEntry = asLegacyEntry(entry);
  const now = Date.now();
  return {
    id: safeEntry.id || generateSecureId('rec'),
    title: safeEntry.title || safeEntry.name || 'Trace Record',
    content: safeEntry.content || safeEntry.text || safeEntry.body || '',
    createdAt:
      typeof safeEntry.createdAt === 'number' && !Number.isNaN(safeEntry.createdAt)
        ? safeEntry.createdAt
        : now,
    updatedAt:
      typeof safeEntry.updatedAt === 'number' && !Number.isNaN(safeEntry.updatedAt)
        ? safeEntry.updatedAt
        : now,
    tags: Array.isArray(safeEntry.tags) ? safeEntry.tags : [],
    isLocked: Boolean(safeEntry.isLocked),
    isEncrypted: Boolean(safeEntry.isEncrypted),
    isArchived: Boolean(safeEntry.isArchived),
    migrated: Boolean(safeEntry.migrated),
    archivedToShip: Boolean(safeEntry.archivedToShip),
    containerId: safeEntry.containerId || undefined,
    attachment: safeEntry.attachment || undefined,
    unlockAt:
      typeof safeEntry.unlockAt === 'number' && !Number.isNaN(safeEntry.unlockAt)
        ? safeEntry.unlockAt
        : undefined,
    isSample: Boolean(safeEntry.isSample),
  };
};

const readStoredArray = async <T>(key: string): Promise<T[]> => {
  const idbValue = await get(key).catch(() => undefined);
  if (Array.isArray(idbValue)) return idbValue as T[];

  const localValue = readDiaryJson<T[]>(key);
  return Array.isArray(localValue) ? localValue : [];
};

const readStoredOptionalArray = async <T>(key: string): Promise<T[] | undefined> => {
  const idbValue = await get(key).catch(() => undefined);
  if (Array.isArray(idbValue)) return idbValue as T[];

  const localValue = readDiaryJson<T[]>(key);
  return Array.isArray(localValue) ? localValue : undefined;
};

const readStoredScalar = async (key: string): Promise<string | null> => {
  const idbValue = await get(key).catch(() => undefined);
  if (typeof idbValue === 'string') return idbValue;
  return readDiaryString(key) || null;
};

export const useDiaryData = (userId: string | undefined, language: Language = 'zh') => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [passwordHash, setPasswordHash] = useState<string | null>(null);
  const [passwordSalt, setPasswordSalt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guidingStars, setGuidingStars] = useState<string[]>([]);
  const [selectedStars, setSelectedStars] = useState<string[]>([]);
  const [materials, setMaterials] = useState<Attachment[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [syncStatus, setSyncStatus] = useState<
    'synced' | 'local-only' | 'error' | 'merging' | 'mirror-skipped'
  >('local-only');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanSummary, setLastScanSummary] = useState<ScanSummary | null>(null);
  const activeLoadIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadId = ++activeLoadIdRef.current;
    const isStale = () => cancelled || activeLoadIdRef.current !== loadId;

    const loadData = async () => {
      const keys = getDiaryStorageKeys(userId);

      try {
        setLoading(true);

        let currentEntries = await readStoredOptionalArray<DiaryEntry>(keys.entries);
        const isInitialized = getStoredString(keys.initializedFlag);

        if (!isInitialized) {
          console.log('Vector Vault: Starting deep migration scan...');
          const migrationResult = await scanLegacyDiaryData(userId);
          await persistMigrationResult(userId, migrationResult);
          if (migrationResult.entries.length > 0) currentEntries = migrationResult.entries;

          mirrorDiaryValue(keys.initializedFlag, 'true');
          console.log(
            `Vector Vault: Migration complete. Merged ${migrationResult.entries.length} entries.`,
          );
        }

        if (!currentEntries) {
          currentEntries = await readStoredOptionalArray<DiaryEntry>(keys.entries);
        }

        if (!currentEntries || currentEntries.length === 0) {
          const backup = await readStoredOptionalArray<DiaryEntry>(keys.backup);
          if (backup && backup.length > 0) currentEntries = backup;
        }

        if ((!currentEntries || currentEntries.length === 0) && !isInitialized) {
          // Phase 4 §4.a-1 — seed two sample reflections so the user
          // sees the value proposition the first time they land in the
          // Dashboard (instead of an empty grid). Lifecycle option C:
          // these are auto-pruned by `addEntry` once the user writes
          // their first real (non-sample) entry. See
          // `services/sampleEntries.ts` for the full rationale.
          currentEntries = getSampleEntries(language);
          await set(keys.entries, currentEntries).catch(() => {});
          mirrorDiaryValue(keys.entries, JSON.stringify(currentEntries));
        }

        const currentPrinciples = await readStoredArray<Principle>(keys.principles);
        const currentPasswordHash = await readStoredScalar(keys.passwordHash);
        const currentPasswordSalt = await readStoredScalar(keys.passwordSalt);

        // One-shot migration: prior versions mirrored the password hash and
        // salt to localStorage. Move any leftover values into IndexedDB and
        // wipe the mirror copies so an XSS payload can no longer harvest
        // them.
        const passwordHashMirror = readDiaryString(keys.passwordHash);
        if (passwordHashMirror) {
          if (!currentPasswordHash) {
            await set(keys.passwordHash, passwordHashMirror).catch(() => {});
          }
          removeDiaryMirror(keys.passwordHash);
        }
        const passwordSaltMirror = readDiaryString(keys.passwordSalt);
        if (passwordSaltMirror) {
          if (!currentPasswordSalt) {
            await set(keys.passwordSalt, passwordSaltMirror).catch(() => {});
          }
          removeDiaryMirror(keys.passwordSalt);
        }
        const currentGuidingStars = await readStoredArray<string>(keys.guidingStars);
        const currentSelectedStars = await readStoredArray<string>(keys.selectedStars);
        const currentMaterials = await readStoredArray<Attachment>(keys.materials);
        const currentContainers = await readStoredArray<Container>(keys.containers);

        if (isStale()) return;

        setEntries((currentEntries || []).map(sanitizeEntry));
        setPrinciples(currentPrinciples);
        setPasswordHash(currentPasswordHash);
        setPasswordSalt(currentPasswordSalt);
        setGuidingStars(currentGuidingStars);
        setSelectedStars(currentSelectedStars);
        setMaterials(currentMaterials);
        setContainers(currentContainers);
      } catch (error) {
        if (isStale()) return;

        reportError(AppError.fromError(error), 'loadData');
        // If the IDB read pipeline crashed entirely, fall back to the
        // same first-day sample reflections so the user still has
        // something to look at (better than an empty error screen).
        setEntries(getSampleEntries(language));
        setPrinciples([]);
        setPasswordHash(null);
        setPasswordSalt(null);
        setGuidingStars([]);
        setSelectedStars([]);
        setMaterials([]);
        setContainers([]);
      } finally {
        if (!isStale()) {
          setLoading(false);
          setSyncStatus('local-only');
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [userId, language]);

  const persistEntries = useCallback(
    async (newEntries: DiaryEntry[]) => {
      const keys = getDiaryStorageKeys(userId);
      setEntries(newEntries);
      try {
        let payload: string | null = null;
        let mirrorSkipped = false;
        await set(keys.entries, newEntries).catch((err) => {
          console.warn('IndexedDB set failed, falling back to localStorage', err);
          payload ??= JSON.stringify(newEntries);
          if (entriesPayloadExceedsMirror(payload.length)) {
            mirrorSkipped = true;
          } else {
            mirrorDiaryValue(keys.entries, payload);
          }
        });
        await set(keys.backup, newEntries).catch(() => {});
        if (mirrorSkipped) {
          setSyncStatus('mirror-skipped');
        } else if (payload !== null) {
          // We had to use the localStorage fallback at least once; flag the
          // session as local-only so callers know IDB is degraded.
          setSyncStatus('local-only');
        }
      } catch (error) {
        reportError(AppError.fromError(error), 'persistEntries');
        setSyncStatus('error');
      }
    },
    [userId],
  );

  const persistPrinciples = useCallback(
    async (newPrinciples: Principle[]) => {
      const keys = getDiaryStorageKeys(userId);
      setPrinciples(newPrinciples);
      try {
        await set(keys.principles, newPrinciples).catch((err) => {
          console.warn('IndexedDB set failed for principles, falling back to localStorage', err);
          mirrorDiaryValue(keys.principles, JSON.stringify(newPrinciples));
        });
      } catch (error) {
        console.error('Failed to save principles', error);
      }
    },
    [userId],
  );

  const savePasswordHash = async (hash: string) => {
    const keys = getDiaryStorageKeys(userId);
    setPasswordHash(hash);
    try {
      await set(keys.passwordHash, hash);
    } catch (error) {
      // Sensitive material must NEVER fall back to localStorage. We surface
      // a sync error and keep the in-memory value so the user can still
      // operate this session, but persistence has failed.
      reportError(AppError.fromError(error), 'savePasswordHash');
      setSyncStatus('error');
    }
    // Defensive: remove any pre-existing mirror written by older versions.
    removeDiaryMirror(keys.passwordHash);
  };

  const savePasswordSalt = async (salt: string) => {
    const keys = getDiaryStorageKeys(userId);
    setPasswordSalt(salt);
    try {
      await set(keys.passwordSalt, salt);
    } catch (error) {
      reportError(AppError.fromError(error), 'savePasswordSalt');
      setSyncStatus('error');
    }
    removeDiaryMirror(keys.passwordSalt);
  };

  const clearPasswordHash = async () => {
    const keys = getDiaryStorageKeys(userId);
    setPasswordHash(null);
    setPasswordSalt(null);
    await del(keys.passwordHash);
    await del(keys.passwordSalt);
    removeDiaryMirror(keys.passwordHash);
    removeDiaryMirror(keys.passwordSalt);
  };

  const saveGuidingStars = async (stars: string[]) => {
    const keys = getDiaryStorageKeys(userId);
    setGuidingStars(stars);
    await set(keys.guidingStars, stars).catch(() => {
      mirrorDiaryValue(keys.guidingStars, JSON.stringify(stars));
    });
  };

  const saveSelectedStars = async (stars: string[]) => {
    const keys = getDiaryStorageKeys(userId);
    setSelectedStars(stars);
    await set(keys.selectedStars, stars).catch(() => {
      mirrorDiaryValue(keys.selectedStars, JSON.stringify(stars));
    });
  };

  const addMaterial = useCallback(
    async (material: Attachment) => {
      const keys = getDiaryStorageKeys(userId);
      // Functional updater + reference capture: avoids the stale-closure
      // window where a quick second tap would read an out-of-date
      // `materials` snapshot and lose the previous addition (the bug
      // tracked in EVALUATION §7 / Phase 2 follow-up F1.4).
      let nextMaterials: Attachment[] = [];
      setMaterials((prev) => {
        nextMaterials = [material, ...prev];
        return nextMaterials;
      });
      await set(keys.materials, nextMaterials).catch(() => {
        console.warn('Failed to save materials to IndexedDB');
      });
    },
    [userId],
  );

  const deleteMaterial = useCallback(
    async (index: number) => {
      const keys = getDiaryStorageKeys(userId);
      let nextMaterials: Attachment[] = [];
      setMaterials((prev) => {
        nextMaterials = prev.filter((_, currentIndex) => currentIndex !== index);
        return nextMaterials;
      });
      await set(keys.materials, nextMaterials).catch(() => {
        console.warn('Failed to save materials to IndexedDB');
      });
    },
    [userId],
  );

  const persistContainersArray = useCallback(
    async (newContainers: Container[]) => {
      const keys = getDiaryStorageKeys(userId);
      try {
        await set(keys.containers, newContainers).catch((err) => {
          console.warn('IndexedDB set failed for containers, falling back to localStorage', err);
          mirrorDiaryValue(keys.containers, JSON.stringify(newContainers));
        });
      } catch (error) {
        reportError(AppError.fromError(error), 'persistContainers');
      }
    },
    [userId],
  );

  const addContainer = useCallback(
    (name: string) => {
      const c: Container = { id: generateSecureId('container'), name, createdAt: Date.now() };
      let next: Container[] = [];
      setContainers((prev) => (next = [c, ...prev]));
      void persistContainersArray(next);
    },
    [persistContainersArray],
  );

  const deleteContainer = useCallback(
    (id: string) => {
      let nextContainers: Container[] = [];
      setContainers((prev) => (nextContainers = prev.filter((c) => c.id !== id)));
      void persistContainersArray(nextContainers);
      let nextEntries: DiaryEntry[] = [];
      setEntries(
        (prev) =>
          (nextEntries = prev.map((e) =>
            e.containerId === id ? { ...e, containerId: undefined } : e,
          )),
      );
      void persistEntries(nextEntries);
    },
    [persistContainersArray, persistEntries],
  );

  // Phase 4.5 §A — `data.id` is optional; when omitted (the legacy
  // editor path), we mint one. The letter-delivery sweep pre-mints
  // an id so it can record `PendingLetter.replyEntryId` atomically.
  const addEntry = useCallback(
    async (data: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'> & { id?: string }) => {
      const now = Date.now();
      const newEntry: DiaryEntry = {
        createdAt: now,
        updatedAt: now,
        isLocked: false,
        isArchived: false,
        migrated: false,
        archivedToShip: false,
        ...data,
        id: data.id ?? generateSecureId(),
      };
      // Phase 4 §4.a-1 — first real entry prunes seeded samples
      // (option C in services/sampleEntries.ts). isSample additions
      // (e.g. future re-seed flow) leave samples alone.
      const baseEntries = newEntry.isSample ? entries : entries.filter((e) => !e.isSample);
      persistEntries([newEntry, ...baseEntries]);
    },
    [entries, persistEntries],
  );

  const updateEntry = useCallback(
    async (updatedEntry: DiaryEntry) => {
      const now = Date.now();
      const nextEntries = entries.map((entry) =>
        entry.id === updatedEntry.id ? { ...updatedEntry, updatedAt: now } : entry,
      );
      persistEntries(nextEntries);
    },
    [entries, persistEntries],
  );

  const bulkUpdateEntries = useCallback(
    async (updatedEntries: DiaryEntry[]) => {
      const now = Date.now();
      const updatedEntriesMap = new Map(
        updatedEntries.map((entry) => [entry.id, { ...entry, updatedAt: now }]),
      );
      const nextEntries = entries.map((entry) => updatedEntriesMap.get(entry.id) || entry);
      persistEntries(nextEntries);
    },
    [entries, persistEntries],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      persistEntries(entries.filter((entry) => entry.id !== id));
    },
    [entries, persistEntries],
  );

  const archiveEntry = useCallback(
    async (id: string) => {
      const now = Date.now();
      const nextEntries = entries.map((entry) =>
        entry.id === id
          ? { ...entry, isArchived: true, archivedToShip: true, updatedAt: now }
          : entry,
      );
      persistEntries(nextEntries);
    },
    [entries, persistEntries],
  );

  const unarchiveEntry = useCallback(
    async (id: string) => {
      const now = Date.now();
      const nextEntries = entries.map((entry) =>
        entry.id === id
          ? { ...entry, isArchived: false, archivedToShip: false, updatedAt: now }
          : entry,
      );
      persistEntries(nextEntries);
    },
    [entries, persistEntries],
  );

  const addPrinciple = useCallback(
    async (text: string, year: number, showOnHome: boolean = true) => {
      const newPrinciple: Principle = {
        id: generateSecureId(),
        text,
        year,
        createdAt: Date.now(),
        showOnHome,
      };
      persistPrinciples([newPrinciple, ...principles]);
    },
    [principles, persistPrinciples],
  );

  const deletePrinciple = useCallback(
    async (id: string) => {
      persistPrinciples(principles.filter((principle) => principle.id !== id));
    },
    [principles, persistPrinciples],
  );

  const updatePrinciple = useCallback(
    async (updatedPrinciple: Principle) => {
      persistPrinciples(
        principles.map((principle) =>
          principle.id === updatedPrinciple.id ? updatedPrinciple : principle,
        ),
      );
    },
    [principles, persistPrinciples],
  );

  const triggerScan = useCallback(async (): Promise<ScanSummary> => {
    try {
      const keys = getDiaryStorageKeys(userId);
      setIsScanning(true);
      setScanProgress(5);
      console.log('Vector Vault: Starting manual deep migration scan...');

      const migrationResult = await scanLegacyDiaryData(userId, {
        delayMs: 30,
        onProgress: setScanProgress,
      });

      setScanProgress(90);

      let mergedEntriesCount = 0;
      let mergedPrinciplesCount = 0;
      let mergedContainersCount = 0;

      if (migrationResult.entries.length > 0) {
        const mergedEntries = mergeMigrationEntries(migrationResult.entries, entries);
        mergedEntriesCount = Math.max(0, mergedEntries.length - entries.length);
        await set(keys.entries, mergedEntries).catch(() => {});
        mirrorDiaryValue(keys.entries, JSON.stringify(mergedEntries));
        setEntries(mergedEntries);
      }

      if (migrationResult.principles.length > 0) {
        const mergedPrinciples = mergeMigrationPrinciples(migrationResult.principles, principles);
        mergedPrinciplesCount = Math.max(0, mergedPrinciples.length - principles.length);
        await set(keys.principles, mergedPrinciples).catch(() => {});
        mirrorDiaryValue(keys.principles, JSON.stringify(mergedPrinciples));
        setPrinciples(mergedPrinciples);
      }

      if (migrationResult.containers.length > 0) {
        const mergedContainers = mergeMigrationContainers(migrationResult.containers, containers);
        mergedContainersCount = Math.max(0, mergedContainers.length - containers.length);
        await set(keys.containers, mergedContainers).catch(() => {});
        mirrorDiaryValue(keys.containers, JSON.stringify(mergedContainers));
        setContainers(mergedContainers);
      }

      if (migrationResult.passwordHash) {
        // Sensitive: never mirror password hash to localStorage.
        await set(keys.passwordHash, migrationResult.passwordHash).catch(() => {});
        removeDiaryMirror(keys.passwordHash);
        setPasswordHash(migrationResult.passwordHash);
      }

      if (migrationResult.passwordSalt) {
        await set(keys.passwordSalt, migrationResult.passwordSalt).catch(() => {});
        removeDiaryMirror(keys.passwordSalt);
        setPasswordSalt(migrationResult.passwordSalt);
      }

      mirrorDiaryValue(keys.initializedFlag, 'true');
      setScanProgress(100);
      console.log(
        `Vector Vault: Manual scan complete. Merged ${migrationResult.entries.length} entries.`,
      );

      await delayMigrationStep(1000);
      setIsScanning(false);
      setScanProgress(0);

      const summary: ScanSummary = {
        status: 'success',
        finishedAt: Date.now(),
        mergedEntries: mergedEntriesCount,
        mergedPrinciples: mergedPrinciplesCount,
        mergedContainers: mergedContainersCount,
      };
      setLastScanSummary(summary);
      return summary;
    } catch (error) {
      reportError(AppError.fromError(error), 'triggerScan');
      setIsScanning(false);
      setScanProgress(0);
      const summary: ScanSummary = {
        status: 'error',
        finishedAt: Date.now(),
        mergedEntries: 0,
        mergedPrinciples: 0,
        mergedContainers: 0,
        error: error instanceof Error ? error.message : 'unknown',
      };
      setLastScanSummary(summary);
      return summary;
    }
  }, [userId, entries, principles, containers]);

  const importBackup = useCallback(
    async (
      incoming: DiaryEntry[],
      mode: ImportBackupMode = 'merge',
    ): Promise<ImportBackupSummary> => {
      const sanitized = incoming.map(sanitizeEntry);
      const next = mode === 'replace' ? sanitized : mergeMigrationEntries(sanitized, entries);
      await persistEntries(next);
      return {
        mode,
        importedCount: sanitized.length,
        totalAfter: next.length,
      };
    },
    [entries, persistEntries],
  );

  const wipeData = useCallback(async () => {
    const keys = getDiaryStorageKeys(userId);

    setEntries([]);
    setPrinciples([]);
    setGuidingStars([]);
    setSelectedStars([]);
    setPasswordHash(null);
    setPasswordSalt(null);
    setMaterials([]);
    setContainers([]);

    const storageKeys = [
      keys.entries,
      keys.principles,
      keys.passwordHash,
      keys.passwordSalt,
      keys.guidingStars,
      keys.selectedStars,
      keys.materials,
      keys.containers,
      keys.backup,
    ];

    for (const key of storageKeys) {
      removeDiaryMirror(key);
      await del(key);
    }

    removeDiaryMirror(DiaryStorageKeys.initializedFlag);
  }, [userId]);

  return {
    entries,
    principles,
    addEntry,
    updateEntry,
    bulkUpdateEntries,
    deleteEntry,
    archiveEntry,
    unarchiveEntry,
    addPrinciple,
    deletePrinciple,
    updatePrinciple,
    importBackup,
    wipeData,
    passwordHash,
    passwordSalt,
    savePasswordHash,
    savePasswordSalt,
    clearPasswordHash,
    guidingStars,
    saveGuidingStars,
    selectedStars,
    saveSelectedStars,
    materials,
    addMaterial,
    deleteMaterial,
    containers,
    addContainer,
    deleteContainer,
    loading,
    syncStatus,
    isScanning,
    scanProgress,
    triggerScan,
    lastScanSummary,
  };
};
