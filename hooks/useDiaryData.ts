import { useState, useEffect, useCallback, useRef } from 'react';
import { get, set } from 'idb-keyval';
import type {
  Attachment,
  Container,
  DiaryEntry,
  Language,
  PatternPrincipleLink,
  PatternPrincipleLinkStatus,
  PatternPrincipleRelation,
  Principle,
  PrincipleApplication,
} from '../types';
import { AppError, reportError } from '../lib/error';
import { getSampleEntries } from '../services/sampleEntries';
import { getStoredString } from '../services/browserStorage';
import {
  DiaryStorageKeys,
  getDiaryStorageKeys,
  mirrorDiaryValue,
  readDiaryString,
  removeDiaryMirror,
} from '../services/diaryStorage';
import { generateSecureId } from '../services/idGenerator';
import {
  mergeMigrationEntries,
  persistMigrationResult,
  scanLegacyDiaryData,
  delayMigrationStep,
} from '../services/diaryMigration';
import {
  readStoredArray,
  readStoredOptionalArray,
  readStoredScalar,
  sanitizeDiaryEntry,
  sanitizePatternPrincipleLink,
  sanitizePrinciple,
} from '../services/diaryDataRead';
import {
  applyPrincipleFeedbackToLinks,
  DEFAULT_PRINCIPLE_CONFIDENCE,
} from '../services/experienceFeedback';
import { updateRelatedEntryIds } from '../services/entryRelations';
import {
  pruneAvatarAtomicMemoriesBySourceIds,
  invalidateAvatarEvidence,
  readAvatarUnderstandings,
  writeAvatarUnderstanding,
} from '../services/avatarMemory';
import { extractPastPatterns } from '../services/pastPatternExtraction';
import { useActionItems } from './useActionItems';
import { commitArrayDelta, subscribeVault, vaultTransaction } from '../services/vaultTransaction';
import { stateFrom } from '../services/futureRepository';
import { deleteSourceEntries, recoverSourceDeletion } from '../services/sourceDeletion';
import { recoverBackupRestore } from '../services/vaultBackup';
import { wipeVault, recoverVaultWipe } from '../services/vaultWipe';
import { useDiaryProtection } from './useDiaryProtection';
import { useDiaryCollections } from './useDiaryCollections';

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

const makePatternPrincipleLink = (
  patternId: string,
  principleId: string,
  relation: PatternPrincipleRelation = 'adjust',
  status: PatternPrincipleLinkStatus = 'confirmed',
): PatternPrincipleLink => {
  const now = Date.now();
  return {
    id: generateSecureId('pattern-principle-link'),
    patternId,
    principleId,
    relation,
    status,
    createdBy: 'user',
    createdAt: now,
    updatedAt: now,
  };
};

const linksFromLegacySourcePatternIds = (sourcePrinciples: Principle[]): PatternPrincipleLink[] =>
  sourcePrinciples.flatMap((principle) =>
    [...new Set(principle.sourcePatternIds ?? [])]
      .filter((patternId) => patternId.trim().length > 0)
      .map((patternId) => makePatternPrincipleLink(patternId, principle.id, 'adjust', 'confirmed')),
  );

const mergePatternPrincipleLinks = (
  storedLinks: PatternPrincipleLink[],
  legacyLinks: PatternPrincipleLink[],
): PatternPrincipleLink[] => {
  const byPair = new Map<string, PatternPrincipleLink>();
  legacyLinks.forEach((link) => {
    byPair.set(`${link.patternId}:${link.principleId}`, link);
  });
  storedLinks.forEach((link) => {
    byPair.set(`${link.patternId}:${link.principleId}`, link);
  });
  return [...byPair.values()].sort((a, b) => b.updatedAt - a.updatedAt);
};

const updateAvatarPatternCandidates = (nextEntries: DiaryEntry[]) => {
  const existing = readAvatarUnderstandings();
  extractPastPatterns(nextEntries, existing).forEach((pattern) => {
    writeAvatarUnderstanding(pattern);
  });
};

export const useDiaryData = (userId: string | undefined, language: Language = 'zh') => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [patternPrincipleLinks, setPatternPrincipleLinks] = useState<PatternPrincipleLink[]>([]);
  const {
    passwordHash,
    setPasswordHash,
    passwordSalt,
    setPasswordSalt,
    syncStatus,
    setSyncStatus,
    savePasswordHash,
    savePasswordSalt,
    clearPasswordHash,
  } = useDiaryProtection(userId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanSummary, setLastScanSummary] = useState<ScanSummary | null>(null);
  const activeLoadIdRef = useRef(0);
  const entriesRef = useRef<DiaryEntry[]>([]);
  const principlesRef = useRef<Principle[]>([]);
  const linksRef = useRef<PatternPrincipleLink[]>([]);
  principlesRef.current = principles;
  linksRef.current = patternPrincipleLinks;
  const { actions, actionsLoadError, addAction, updateAction, recordActionResult, resetActions } =
    useActionItems(userId);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const persistEntries = useCallback(
    async (newEntries: DiaryEntry[]) => {
      const keys = getDiaryStorageKeys(userId);
      try {
        const saved = await commitArrayDelta<DiaryEntry>(
          keys.entries,
          entriesRef.current,
          newEntries,
          keys.backup,
          sanitizeDiaryEntry,
        );
        entriesRef.current = saved;
        setEntries(saved);
        removeDiaryMirror(keys.entries);
        removeDiaryMirror(keys.backup);
      } catch (error) {
        setSyncStatus('error');
        throw error;
      }
    },
    [setSyncStatus, userId],
  );

  const {
    guidingStars,
    setGuidingStars,
    selectedStars,
    setSelectedStars,
    materials,
    setMaterials,
    containers,
    setContainers,
    saveGuidingStars,
    saveSelectedStars,
    addMaterial,
    deleteMaterial,
    addContainer,
    deleteContainer,
  } = useDiaryCollections(userId, persistEntries, setEntries, entriesRef);

  useEffect(() => {
    let cancelled = false;
    const loadId = ++activeLoadIdRef.current;
    const isStale = () => cancelled || activeLoadIdRef.current !== loadId;

    const loadData = async () => {
      const keys = getDiaryStorageKeys(userId);

      try {
        setLoading(true);
        setLoadError(null);
        await recoverVaultWipe();
        await recoverSourceDeletion();
        await recoverBackupRestore();

        let currentEntries = await readStoredOptionalArray<DiaryEntry>(keys.entries);
        const isInitialized =
          (await get(keys.initializedFlag)) || getStoredString(keys.initializedFlag);
        if (isStale()) return;

        if (!isInitialized) {
          console.log('Vector Vault: Starting deep migration scan...');
          const migrationResult = await scanLegacyDiaryData(userId);
          if (isStale()) return;
          const migrated = await persistMigrationResult(
            userId,
            migrationResult,
            getSampleEntries(language),
          );
          currentEntries = migrated.entries;
          console.log(
            `Vector Vault: Migration complete. Merged ${migrationResult.entries.length} entries.`,
          );
        }

        if (!currentEntries) {
          currentEntries = await readStoredOptionalArray<DiaryEntry>(keys.entries);
        }

        if (!currentEntries) {
          const backup = await readStoredOptionalArray<DiaryEntry>(keys.backup);
          if (backup && backup.length > 0) currentEntries = backup;
        }

        const currentPrinciples = await readStoredArray<Principle>(keys.principles);
        const sanitizedPrinciples = currentPrinciples.map(sanitizePrinciple);
        const currentPatternPrincipleLinks = (
          await readStoredArray<PatternPrincipleLink>(keys.patternPrincipleLinks)
        )
          .map(sanitizePatternPrincipleLink)
          .filter((link): link is PatternPrincipleLink => Boolean(link));
        const currentPasswordHash = await readStoredScalar(keys.passwordHash);
        const currentPasswordSalt = await readStoredScalar(keys.passwordSalt);

        // One-shot migration: prior versions mirrored the password hash and
        // salt to localStorage. Move any leftover values into IndexedDB and
        // wipe the mirror copies so an XSS payload can no longer harvest
        // them.
        const passwordHashMirror = readDiaryString(keys.passwordHash);
        if (passwordHashMirror) {
          if ((await get(keys.passwordHash)) === undefined) {
            await set(keys.passwordHash, passwordHashMirror);
          }
          removeDiaryMirror(keys.passwordHash);
        }
        const passwordSaltMirror = readDiaryString(keys.passwordSalt);
        if (passwordSaltMirror) {
          if ((await get(keys.passwordSalt)) === undefined) {
            await set(keys.passwordSalt, passwordSaltMirror);
          }
          removeDiaryMirror(keys.passwordSalt);
        }
        const currentGuidingStars = await readStoredArray<string>(keys.guidingStars);
        const currentSelectedStars = await readStoredArray<string>(keys.selectedStars);
        const currentMaterials = await readStoredArray<Attachment>(keys.materials);
        const currentContainers = await readStoredArray<Container>(keys.containers);

        if (isStale()) return;

        setEntries((currentEntries || []).map(sanitizeDiaryEntry));
        setPrinciples(sanitizedPrinciples);
        setPatternPrincipleLinks(
          mergePatternPrincipleLinks(
            currentPatternPrincipleLinks,
            linksFromLegacySourcePatternIds(sanitizedPrinciples),
          ),
        );
        setPasswordHash(currentPasswordHash);
        setPasswordSalt(currentPasswordSalt);
        setGuidingStars(currentGuidingStars);
        setSelectedStars(currentSelectedStars);
        setMaterials(currentMaterials);
        setContainers(currentContainers);
        setSyncStatus('local-only');
      } catch (error) {
        if (isStale()) return;

        reportError(AppError.fromError(error), 'loadData');
        // Fail closed: a failed protection read must not unlock an apparently empty vault.
        setLoadError('资料库读取失败，未打开或覆盖数据。请重新加载后重试。');
        setEntries([]);
        setPrinciples([]);
        setPatternPrincipleLinks([]);
        setSyncStatus('error');
        setGuidingStars([]);
        setSelectedStars([]);
        setMaterials([]);
        setContainers([]);
      } finally {
        if (!isStale()) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [
    language,
    setContainers,
    setGuidingStars,
    setMaterials,
    setPasswordHash,
    setPasswordSalt,
    setSelectedStars,
    setSyncStatus,
    userId,
  ]);

  useEffect(() => {
    let live = true;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      try {
        await recoverVaultWipe();
        await recoverSourceDeletion();
        await recoverBackupRestore();
        const keys = getDiaryStorageKeys(userId);
        const data = await vaultTransaction(
          [
            keys.entries,
            keys.principles,
            keys.patternPrincipleLinks,
            keys.guidingStars,
            keys.selectedStars,
            keys.materials,
            keys.containers,
          ],
          (values) => values,
          true,
        );
        if (!live || request !== generation) return;
        if (Array.isArray(data[keys.entries])) {
          const next = (data[keys.entries] as DiaryEntry[]).map(sanitizeDiaryEntry);
          entriesRef.current = next;
          setEntries(next);
        }
        if (Array.isArray(data[keys.principles]))
          setPrinciples((data[keys.principles] as Principle[]).map(sanitizePrinciple));
        if (Array.isArray(data[keys.patternPrincipleLinks]))
          setPatternPrincipleLinks(data[keys.patternPrincipleLinks] as PatternPrincipleLink[]);
        if (Array.isArray(data[keys.guidingStars]))
          setGuidingStars(data[keys.guidingStars] as string[]);
        if (Array.isArray(data[keys.selectedStars]))
          setSelectedStars(data[keys.selectedStars] as string[]);
        if (Array.isArray(data[keys.materials])) setMaterials(data[keys.materials] as Attachment[]);
        if (Array.isArray(data[keys.containers]))
          setContainers(data[keys.containers] as Container[]);
      } catch (error) {
        if (live) {
          setSyncStatus('error');
          reportError(AppError.fromError(error), 'refreshVault');
        }
      }
    };
    const unsubscribe = subscribeVault(() => {
      void refresh();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [setContainers, setGuidingStars, setMaterials, setSelectedStars, setSyncStatus, userId]);


  const persistPrinciples = useCallback(
    async (next: Principle[]) => {
      const saved = await commitArrayDelta(
        getDiaryStorageKeys(userId).principles,
        principlesRef.current,
        next,
        undefined,
        sanitizePrinciple,
      );
      principlesRef.current = saved;
      setPrinciples(saved);
    },
    [userId],
  );

  const persistPatternPrincipleLinks = useCallback(
    async (next: PatternPrincipleLink[]) => {
      const saved = await commitArrayDelta(
        getDiaryStorageKeys(userId).patternPrincipleLinks,
        linksRef.current,
        next,
      );
      linksRef.current = saved;
      setPatternPrincipleLinks(saved);
    },
    [userId],
  );


  // `data.id` is optional so Now can pre-mint ids for record/material
  // flows while ordinary callers can still let the store mint one.
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
      const existing = data.id
        ? entriesRef.current.find((entry) => entry.id === data.id)
        : undefined;
      if (existing) return existing;
      const baseEntries = newEntry.isSample
        ? entriesRef.current
        : entriesRef.current.filter((e) => !e.isSample);
      const nextEntries = [newEntry, ...baseEntries];
      await persistEntries(nextEntries);
      updateAvatarPatternCandidates(nextEntries);
      return newEntry;
    },
    [persistEntries],
  );

  const updateEntry = useCallback(
    async (updatedEntry: DiaryEntry) => {
      const now = Date.now();
      const nextEntries = entries.map((entry) =>
        entry.id === updatedEntry.id ? { ...updatedEntry, updatedAt: now } : entry,
      );
      const previous = entries.find((entry) => entry.id === updatedEntry.id);
      if (previous && previous.content !== updatedEntry.content)
        invalidateAvatarEvidence(updatedEntry.id);
      await persistEntries(nextEntries);
      updateAvatarPatternCandidates(nextEntries);
    },
    [entries, persistEntries],
  );

  const updateEntryRelatedIds = useCallback(
    async (entryId: string, relatedEntryIds: string[]) => {
      await persistEntries(updateRelatedEntryIds(entriesRef.current, entryId, relatedEntryIds));
    },
    [persistEntries],
  );

  const bulkUpdateEntries = useCallback(
    async (updatedEntries: DiaryEntry[]) => {
      const now = Date.now();
      const updatedEntriesMap = new Map(
        updatedEntries.map((entry) => [entry.id, { ...entry, updatedAt: now }]),
      );
      const nextEntries = entries.map((entry) => updatedEntriesMap.get(entry.id) || entry);
      await persistEntries(nextEntries);
    },
    [entries, persistEntries],
  );

  const deleteEntries = useCallback(
    async (ids: string[], retainDerivedKnowledge = false, retainGoalProgress?: boolean) => {
      if (!ids.length) return;
      const linked = await vaultTransaction(
        [DiaryStorageKeys.future],
        (v) =>
          stateFrom(v[DiaryStorageKeys.future]).events.some(
            (e) => e.status === 'valid' && e.sourceEntryId && ids.includes(e.sourceEntryId),
          ),
        true,
      );
      const retain =
        retainGoalProgress ??
        (linked
          ? window.confirm(
              '是否保留这些记录已计入的目标进度？\n\n确定：保留进度并解除记录关联。取消：撤回相应进度。',
            )
          : false);
      await deleteSourceEntries(ids, retainDerivedKnowledge, retain);
      const keys = getDiaryStorageKeys(userId);
      const values = await vaultTransaction(
        [keys.entries, keys.principles, keys.patternPrincipleLinks],
        (v) => v,
        true,
      );
      entriesRef.current = values[keys.entries] as DiaryEntry[];
      setEntries(entriesRef.current);
      setPrinciples(values[keys.principles] as Principle[]);
      setPatternPrincipleLinks(values[keys.patternPrincipleLinks] as PatternPrincipleLink[]);
    },
    [userId],
  );

  const deleteEntry = useCallback(
    async (id: string, retainDerivedKnowledge = false, retainGoalProgress?: boolean) => {
      await deleteEntries([id], retainDerivedKnowledge, retainGoalProgress);
    },
    [deleteEntries],
  );

  const archiveEntry = useCallback(
    async (id: string) => {
      const now = Date.now();
      const nextEntries = entries.map((entry) =>
        entry.id === id
          ? { ...entry, isArchived: true, archivedToShip: true, updatedAt: now }
          : entry,
      );
      await persistEntries(nextEntries);
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
      await persistEntries(nextEntries);
    },
    [entries, persistEntries],
  );

  const addPrinciple = useCallback(
    async (
      text: string,
      year: number,
      showOnHome: boolean = true,
      derivedFromEntryIds: string[] = [],
      application?: PrincipleApplication,
      sourcePatternIds: string[] = [],
      tags: string[] = [],
    ) => {
      const newPrinciple: Principle = {
        id: generateSecureId(),
        text,
        tags:
          tags.length > 0 ? [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))] : undefined,
        year,
        createdAt: Date.now(),
        showOnHome,
        derivedFromEntryIds:
          derivedFromEntryIds.length > 0 ? [...new Set(derivedFromEntryIds)] : undefined,
        application,
        sourcePatternIds: sourcePatternIds.length > 0 ? [...new Set(sourcePatternIds)] : undefined,
        confidence: DEFAULT_PRINCIPLE_CONFIDENCE,
        recallCount: 0,
        helpfulCount: 0,
        partialCount: 0,
        unhelpfulCount: 0,
      };
      const uniquePatternIds = [
        ...new Set(sourcePatternIds.map((id) => id.trim()).filter(Boolean)),
      ];
      const nextPrinciples = [
        {
          ...newPrinciple,
          sourcePatternIds: uniquePatternIds.length ? uniquePatternIds : undefined,
        },
        ...principles,
      ];
      const existingPairs = new Set(
        patternPrincipleLinks.map((link) => `${link.patternId}:${link.principleId}`),
      );
      const nextLinks = [
        ...uniquePatternIds
          .filter((patternId) => !existingPairs.has(`${patternId}:${newPrinciple.id}`))
          .map((patternId) => makePatternPrincipleLink(patternId, newPrinciple.id)),
        ...patternPrincipleLinks,
      ];
      await persistPrinciples(nextPrinciples);
      if (uniquePatternIds.length > 0) await persistPatternPrincipleLinks(nextLinks);
    },
    [patternPrincipleLinks, persistPatternPrincipleLinks, principles, persistPrinciples],
  );

  const deletePrinciple = useCallback(
    async (id: string) => {
      await persistPrinciples(principles.filter((principle) => principle.id !== id));
      pruneAvatarAtomicMemoriesBySourceIds([id], false);
      const now = Date.now();
      const nextLinks = patternPrincipleLinks.map((link) =>
        link.principleId === id ? { ...link, status: 'inactive' as const, updatedAt: now } : link,
      );
      if (nextLinks.some((link, index) => link !== patternPrincipleLinks[index])) {
        await persistPatternPrincipleLinks(nextLinks);
      }
    },
    [patternPrincipleLinks, persistPatternPrincipleLinks, principles, persistPrinciples],
  );

  const addPatternPrincipleLink = useCallback(
    async (
      patternId: string,
      principleId: string,
      relation: PatternPrincipleRelation = 'adjust',
      status: PatternPrincipleLinkStatus = 'confirmed',
    ) => {
      const safePatternId = patternId.trim();
      const safePrincipleId = principleId.trim();
      if (!safePatternId || !safePrincipleId) return;
      const pairKey = `${safePatternId}:${safePrincipleId}`;
      const now = Date.now();
      const existing = patternPrincipleLinks.find(
        (link) => `${link.patternId}:${link.principleId}` === pairKey,
      );
      const nextLinks = existing
        ? patternPrincipleLinks.map((link) =>
            link.id === existing.id
              ? { ...link, relation, status, updatedAt: now, createdBy: link.createdBy ?? 'user' }
              : link,
          )
        : [
            makePatternPrincipleLink(safePatternId, safePrincipleId, relation, status),
            ...patternPrincipleLinks,
          ];
      await persistPatternPrincipleLinks(nextLinks);
    },
    [patternPrincipleLinks, persistPatternPrincipleLinks],
  );

  const updatePatternPrincipleLink = useCallback(
    async (updatedLink: PatternPrincipleLink) => {
      const sanitized = sanitizePatternPrincipleLink({ ...updatedLink, updatedAt: Date.now() });
      if (!sanitized) return;
      await persistPatternPrincipleLinks(
        patternPrincipleLinks.map((link) => (link.id === sanitized.id ? sanitized : link)),
      );
    },
    [patternPrincipleLinks, persistPatternPrincipleLinks],
  );

  const removePatternPrincipleLink = useCallback(
    async (id: string) => {
      const now = Date.now();
      await persistPatternPrincipleLinks(
        patternPrincipleLinks.map((link) =>
          link.id === id ? { ...link, status: 'inactive', updatedAt: now } : link,
        ),
      );
    },
    [patternPrincipleLinks, persistPatternPrincipleLinks],
  );

  const updatePrinciple = useCallback(
    async (updatedPrinciple: Principle) => {
      const previousPrinciple = principles.find(
        (principle) => principle.id === updatedPrinciple.id,
      );
      await persistPrinciples(
        principles.map((principle) =>
          principle.id === updatedPrinciple.id ? updatedPrinciple : principle,
        ),
      );
      if (previousPrinciple) {
        const outcome =
          (updatedPrinciple.helpfulCount ?? 0) > (previousPrinciple.helpfulCount ?? 0)
            ? 'helpful'
            : (updatedPrinciple.partialCount ?? 0) > (previousPrinciple.partialCount ?? 0)
              ? 'partial'
              : (updatedPrinciple.unhelpfulCount ?? 0) > (previousPrinciple.unhelpfulCount ?? 0)
                ? 'unhelpful'
                : null;
        if (outcome) {
          const nextLinks = applyPrincipleFeedbackToLinks(
            patternPrincipleLinks,
            updatedPrinciple.id,
            outcome,
            updatedPrinciple.lastFeedbackAt ?? Date.now(),
          );
          if (nextLinks.some((link, index) => link !== patternPrincipleLinks[index])) {
            await persistPatternPrincipleLinks(nextLinks);
          }
        }
      }
    },
    [patternPrincipleLinks, persistPatternPrincipleLinks, principles, persistPrinciples],
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

      const migrated = await persistMigrationResult(userId, migrationResult);
      setEntries(migrated.entries.map(sanitizeDiaryEntry));
      setPrinciples(migrated.principles.map(sanitizePrinciple));
      setContainers(migrated.containers);

      if (typeof migrated.passwordHash === 'string') {
        removeDiaryMirror(keys.passwordHash);
        setPasswordHash(migrated.passwordHash);
      }
      if (typeof migrated.passwordSalt === 'string') {
        removeDiaryMirror(keys.passwordSalt);
        setPasswordSalt(migrated.passwordSalt);
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
        mergedEntries: migrated.mergedEntries,
        mergedPrinciples: migrated.mergedPrinciples,
        mergedContainers: migrated.mergedContainers,
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
  }, [setContainers, setPasswordHash, setPasswordSalt, userId]);

  const importBackup = useCallback(
    async (
      incoming: DiaryEntry[],
      mode: ImportBackupMode = 'merge',
    ): Promise<ImportBackupSummary> => {
      const sanitized = incoming.map(sanitizeDiaryEntry);
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
    await wipeVault(userId);

    setEntries([]);
    setPrinciples([]);
    setPatternPrincipleLinks([]);
    setGuidingStars([]);
    setSelectedStars([]);
    setPasswordHash(null);
    setPasswordSalt(null);
    setMaterials([]);
    setContainers([]);
    resetActions();
  }, [
    resetActions,
    setContainers,
    setGuidingStars,
    setMaterials,
    setPasswordHash,
    setPasswordSalt,
    setSelectedStars,
    userId,
  ]);

  return {
    entries,
    principles,
    patternPrincipleLinks,
    addEntry,
    updateEntry,
    updateEntryRelatedIds,
    bulkUpdateEntries,
    deleteEntry,
    deleteEntries,
    archiveEntry,
    unarchiveEntry,
    addPrinciple,
    deletePrinciple,
    addPatternPrincipleLink,
    updatePatternPrincipleLink,
    removePatternPrincipleLink,
    updatePrinciple,
    actions,
    addAction,
    updateAction,
    recordActionResult,
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
    loadError: loadError ?? actionsLoadError,
    syncStatus,
    isScanning,
    scanProgress,
    triggerScan,
    lastScanSummary,
  };
};
