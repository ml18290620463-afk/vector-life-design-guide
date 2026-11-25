/* eslint-disable max-lines -- Backup restore keeps the preview and commit checks in one reviewed flow. */
import { recoverBackupRestore } from './vaultBackupRecovery';
export { recoverBackupRestore } from './vaultBackupRecovery';
import {
  normalizeAvatarBackupPayload,
  readLegacyAvatarBackupCaches,
} from './avatarOntologyMigration';
import { plaintextEntries } from './vaultBackupEntries';
import {
  avatarBackupKeys,
  exportAvatarCheckpoint,
  prepareAvatarCheckpointRestore,
  assignAvatarCheckpoint,
} from './avatarOntologyBackupCheckpoint';
import type { AvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import { withAvatarSession } from './avatarOntologySessionGuard';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { validateAvatarOntology } from './avatarOntologyValidation';
import { mergeAvatarOntologyBackup } from './avatarOntologyBackup';
import {
  canonical,
  materialRows,
  mergeRows,
  validateBackupEntries,
  validateBackupLinks,
  rows,
  scalarDomain,
  strings,
  type Row,
} from './vaultBackupNormalization';
import { accountLocalStorage } from './accountScope';
import {
  normalizeFutureDrafts,
  type FutureDraft,
  type FutureDraftSnapshot,
} from './futureDraftRepository';
import { PAST_PROCESSING_KEY } from './pastProcessingCache';
import { PRIVATE_DRAFT_KEY, FUTURE_DRAFT_KEY } from './privateDraftKey';
import { normalizeNowDraft, loadNowDraft, type DraftSnapshot } from './nowDraftRepository';
import type { NowDraft } from '../features/now/types/now';
import type { DiaryEntry } from '../types';
import type { FutureState } from '../types/future';
import {
  DiaryStorageKeys as K,
  getMaterialsStorageKey,
  getSelectedStarsStorageKey,
} from './diaryStorage';
import { stateFrom } from './futureRepository';
import {
  rawVaultTransaction,
  preparedVaultTransaction,
  BACKUP_RESTORE_JOB,
} from './vaultTransaction';
import { SecurityService } from './securityService';
import { useAppStore } from '../stores/appStore';
import { encryptVaultBackupFile } from './vaultBackupFile';
import { recoverSourceDeletion } from './sourceDeletion';
import {
  DELETION_TOMBSTONES_KEY,
  hashDeletedId,
  mergeDeletionTombstones,
  tombstoneBlocksEntry,
  readDeletionTombstones,
  blockedOntologyRows,
  type DeletionTombstone,
} from './deletionTombstone';
import { storedArray, withLegacyValue } from './vaultLegacyRead';
import { decodeEntries, type UnreadableEntry } from './readableEntries';
import { materialReferencesForBackup, summarizeVaultBackupContent } from './vaultBackupSummary';
import type { MaterialReferenceSummary } from '../lib/materialPersistence';

const domainsFor = (userId?: string) => ({
  entries: K.entries,
  principles: K.principles,
  links: K.patternPrincipleLinks,
  actions: K.actions,
  guidingStars: K.guidingStars,
  containers: K.containers,
  materials: getMaterialsStorageKey(userId),
  selectedStars: getSelectedStarsStorageKey(userId),
});
const domains = domainsFor();
const cacheKeys = [PAST_PROCESSING_KEY, 'user_custom_anchors'] as const;
const RESTORE_JOB = BACKUP_RESTORE_JOB;
export interface VaultBackup {
  type: 'vector-vault-backup';
  schemaVersion: 2 | 3;
  version: string;
  exportedAt: string;
  entryCount: number;
  entries: DiaryEntry[];
  vault: {
    data: Record<keyof typeof domains, unknown[]>;
    future: FutureState;
    draft?: NowDraft | null;
    futureDrafts?: Record<string, FutureDraft>;
    ontology?: AvatarOntologySnapshot;
    migrationCheckpoint?: AvatarMigrationCheckpoint;
    deletionTombstones?: DeletionTombstone[];
    caches: Record<string, unknown[]>;
  };
}
const mergeValues = (name: string, current: unknown[], incoming: unknown[]) =>
  name === PAST_PROCESSING_KEY
    ? []
    : scalarDomain(name)
      ? [...new Set([...current, ...incoming])]
      : mergeRows(current, incoming);
export function validateVaultBackup(value: unknown): asserts value is VaultBackup {
  const b = value as VaultBackup;
  if (
    !b ||
    b.type !== 'vector-vault-backup' ||
    ![2, 3].includes(b.schemaVersion) ||
    !b.vault?.data ||
    !b.vault.caches ||
    !Array.isArray(b.entries) ||
    b.entryCount !== b.entries.length
  )
    throw new Error('完整备份格式无效');
  for (const name of Object.keys(domains) as (keyof typeof domains)[]) {
    if (scalarDomain(name)) strings(b.vault.data[name]);
    else rows(b.vault.data[name]);
  }
  if (canonical(b.entries) !== canonical(b.vault.data.entries)) throw new Error('备份记录不一致');
  validateBackupEntries(b.entries);
  if (b.vault.ontology !== undefined) validateAvatarOntology(b.vault.ontology);
  readDeletionTombstones(b.vault.deletionTombstones);
  stateFrom(b.vault.future);
  if (b.vault.draft) normalizeNowDraft(b.vault.draft);
  normalizeFutureDrafts(b.vault.futureDrafts);
  for (const key of cacheKeys) {
    if (key === PAST_PROCESSING_KEY && b.vault.caches[key] === undefined) continue;
    if (scalarDomain(key)) strings(b.vault.caches[key]);
    else rows(b.vault.caches[key]);
  }
  validateBackupLinks(b.entries, b.vault.data.actions as Row[], b.vault.future);
}
async function snapshotVaultBackup(
  version: string,
  userId?: string,
  allowProtected = false,
  allowUnreadableEntries = false,
) {
  const domains = domainsFor(userId);
  await loadNowDraft();
  await recoverSourceDeletion();
  await recoverBackupRestore();
  return preparedVaultTransaction(
    [
      ...Object.values(domains),
      K.future,
      K.passwordHash,
      PRIVATE_DRAFT_KEY,
      FUTURE_DRAFT_KEY,
      ...avatarBackupKeys,
      DELETION_TOMBSTONES_KEY,
    ],
    async (v) => {
      if (!allowProtected && (v[K.passwordHash] || accountLocalStorage.getItem(K.passwordHash)))
        throw new Error('完整备份暂不支持加密资料库，未导出任何文件');
      const data = Object.fromEntries(
        Object.entries(domains).map(([name, key]) => [name, storedArray(v[key], key) ?? []]),
      ) as VaultBackup['vault']['data'];
      data.materials = materialRows(data.materials);
      const decoded = await decodeEntries(
        data.entries as DiaryEntry[],
        useAppStore.getState().masterPassword,
      );
      if (decoded.unreadableEntries.length && !allowUnreadableEntries)
        throw new Error(`有 ${decoded.unreadableEntries.length} 条记录无法解密，未导出任何文件`);
      data.entries = decoded.entries;
      if (decoded.unreadableEntries.length) {
        const readableIds = new Set(decoded.entries.map((entry) => entry.id));
        const future = stateFrom(withLegacyValue(v[K.future], K.future));
        future.events = future.events.filter(
          (event) => !event.sourceEntryId || readableIds.has(event.sourceEntryId),
        );
      }
      const caches = Object.fromEntries(
        cacheKeys.map((key) => [key, JSON.parse(accountLocalStorage.getItem(key) ?? '[]')]),
      );
      const result: VaultBackup = {
        type: 'vector-vault-backup',
        schemaVersion: 3,
        version,
        exportedAt: new Date().toISOString(),
        entryCount: data.entries.length,
        entries: data.entries as DiaryEntry[],
        vault: {
          data,
          deletionTombstones: readDeletionTombstones(v[DELETION_TOMBSTONES_KEY]),
          migrationCheckpoint: await exportAvatarCheckpoint(v),
          ...(v[AVATAR_ONTOLOGY_KEY] !== undefined
            ? { ontology: structuredClone(v[AVATAR_ONTOLOGY_KEY]) as AvatarOntologySnapshot }
            : {}),
          future: (() => {
            const future = stateFrom(withLegacyValue(v[K.future], K.future));
            if (decoded.unreadableEntries.length)
              future.events = future.events.filter(
                (event) =>
                  !event.sourceEntryId ||
                  (data.entries as DiaryEntry[]).some((entry) => entry.id === event.sourceEntryId),
              );
            return future;
          })(),
          caches: { ...caches, ...readLegacyAvatarBackupCaches() },
          futureDrafts: (v[FUTURE_DRAFT_KEY] as FutureDraftSnapshot | undefined)?.drafts ?? {},
          draft: (v[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined)?.draft ?? null,
        },
      };
      result.vault = {
        ...result.vault,
        ...(await normalizeAvatarBackupPayload(
          result.vault,
          useAppStore.getState().masterPassword,
        )),
      };
      validateVaultBackup(result);
      return {
        backup: result,
        skippedEntries: decoded.unreadableEntries,
        protectedVault: Boolean(v[K.passwordHash] ?? accountLocalStorage.getItem(K.passwordHash)),
      };
    },
    true,
  );
}
/** Legacy plaintext API deliberately rejects a protected vault. UI uses the file API. */
export async function exportVaultBackup(version: string, userId?: string) {
  return (await snapshotVaultBackup(version, userId)).backup;
}
export async function exportVaultBackupFile(version: string, userId?: string) {
  return withAvatarSession(async (assertCurrent) => {
    const session = useAppStore.getState();
    const { backup, protectedVault } = await snapshotVaultBackup(version, userId, true);
    assertCurrent();
    const result = protectedVault
      ? await encryptVaultBackupFile(backup, session.masterPassword ?? '')
      : backup;
    assertCurrent();
    return result;
  });
}
/** Explicitly produces a usable copy of readable records after damage. The source vault is never changed. */
export async function exportRecoverableVaultBackupFile(version: string, userId?: string) {
  return withAvatarSession(async (assertCurrent) => {
    const session = useAppStore.getState();
    const { backup, protectedVault, skippedEntries } = await snapshotVaultBackup(
      version,
      userId,
      true,
      true,
    );
    assertCurrent();
    const file = protectedVault
      ? await encryptVaultBackupFile(backup, session.masterPassword ?? '')
      : backup;
    assertCurrent();
    return { file, skippedEntries } as {
      file: VaultBackup | Awaited<ReturnType<typeof encryptVaultBackupFile>>;
      skippedEntries: UnreadableEntry[];
    };
  });
}
export interface VaultRecoveryDrill {
  mode: 'merge' | 'replace';
  canRestore: boolean;
  importedCount: number;
  totalAfter: number;
  conflicts: string[];
  resurrectionCount: number;
  dataCounts: Record<string, number>;
  materialReferences: MaterialReferenceSummary;
  externalReferenceLimitations: string;
}

/** Computes a restore result in memory only. It does not create restore jobs or write any vault key. */
export async function drillVaultBackupRestore(
  backup: VaultBackup,
  mode: 'merge' | 'replace' = 'merge',
  userId?: string,
  backupPassword?: string,
): Promise<VaultRecoveryDrill> {
  backup = structuredClone(backup);
  validateVaultBackup(backup);
  backup.vault = {
    ...backup.vault,
    ...(await normalizeAvatarBackupPayload(backup.vault, backupPassword ?? null)),
  };
  const localDomains = domainsFor(userId);
  return preparedVaultTransaction(
    [
      ...Object.values(localDomains),
      K.passwordHash,
      PRIVATE_DRAFT_KEY,
      FUTURE_DRAFT_KEY,
      ...avatarBackupKeys,
      DELETION_TOMBSTONES_KEY,
    ],
    async (v) => {
      const current = await decodeEntries(
        (storedArray(v[K.entries], K.entries) as DiaryEntry[]) ?? [],
        useAppStore.getState().masterPassword,
      );
      const conflicts = current.unreadableEntries.map(
        (entry) => `本机记录无法读取：${entry.id}（${entry.reason}）`,
      );
      const deleted = new Map(
        readDeletionTombstones(v[DELETION_TOMBSTONES_KEY]).map((item) => [item.entityIdHash, item]),
      );
      const resurrected = (
        await Promise.all(
          backup.entries.map(async (entry) => ({
            entry,
            tombstone: deleted.get(await hashDeletedId(entry.id)),
          })),
        )
      ).filter(({ entry, tombstone }) => tombstoneBlocksEntry(tombstone, entry));
      if (resurrected.length)
        conflicts.push(`备份含 ${resurrected.length} 条已删除的旧记录，恢复前须单独确认`);
      const blockedGraphRows = await blockedOntologyRows(backup.vault.ontology, [...deleted.values()]);
      if (blockedGraphRows.length)
        conflicts.push(`备份含 ${blockedGraphRows.length} 条已删除的旧认知资料，恢复前须单独确认`);
      try {
        mergeAvatarOntologyBackup(v[AVATAR_ONTOLOGY_KEY], backup.vault.ontology, mode);
        await prepareAvatarCheckpointRestore(
          v,
          backup.vault,
          mode,
          backupPassword,
          useAppStore.getState().masterPassword ?? backupPassword ?? null,
        );
      } catch (error) {
        conflicts.push(error instanceof Error ? error.message : '认知资料无法恢复');
      }
      const byId = new Map(current.entries.map((entry) => [entry.id, entry]));
      for (const entry of backup.entries) {
        const old = byId.get(entry.id);
        if (old && canonical(old) !== canonical(entry)) conflicts.push(`记录编号冲突：${entry.id}`);
      }
      const oldDraft = v[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined;
      const oldFutureDraft = v[FUTURE_DRAFT_KEY] as FutureDraftSnapshot | undefined;
      const incomingFutureDrafts = normalizeFutureDrafts(backup.vault.futureDrafts);
      const localFutureDrafts = normalizeFutureDrafts(oldFutureDraft?.drafts);
      const draftConflicts = Object.keys(incomingFutureDrafts).filter(
        (key) =>
          localFutureDrafts[key] &&
          canonical(localFutureDrafts[key]) !== canonical(incomingFutureDrafts[key]),
      );
      if (mode === 'merge' && draftConflicts.length) conflicts.push('本机和备份存在不同规划草稿');

      if (
        mode === 'merge' &&
        backup.vault.draft &&
        oldDraft?.draft &&
        canonical(backup.vault.draft) !== canonical(oldDraft.draft)
      )
        conflicts.push('本机和备份都存在不同草稿');
      const totalAfter =
        mode === 'replace'
          ? backup.entries.length
          : new Set([
              ...current.entries.map((entry) => entry.id),
              ...backup.entries.map((entry) => entry.id),
            ]).size;
      return {
        mode,
        canRestore: conflicts.length === 0,
        importedCount: backup.entries.length,
        totalAfter,
        conflicts,
        resurrectionCount: resurrected.length + blockedGraphRows.length,
        dataCounts: Object.fromEntries(
          Object.entries(backup.vault.data).map(([key, rows]) => [key, rows.length]),
        ),
        materialReferences: materialReferencesForBackup(backup),
        externalReferenceLimitations:
          '演练不会访问外部链接、本机媒体或网络资源，也不会写入当前资料库。内嵌素材可随备份恢复；网页链接仅保存地址。',
      };
    },
    true,
  );
}
export async function importVaultBackup(
  backup: VaultBackup,
  mode: 'merge' | 'replace' = 'merge',
  userId?: string,
  backupPassword?: string,
  confirmResurrection = false,
) {
  backup = structuredClone(backup);
  const { summary, protection } = await withAvatarSession(async (assertCurrent) => {
    const domains = domainsFor(userId);
    validateVaultBackup(backup);
    backup.vault = {
      ...backup.vault,
      ...(await normalizeAvatarBackupPayload(backup.vault, backupPassword ?? null)),
    };
    assertCurrent();
    await recoverSourceDeletion();
    await recoverBackupRestore();
    const hasProtection = await rawVaultTransaction(
      [K.passwordHash],
      (v) => Boolean(v[K.passwordHash] ?? accountLocalStorage.getItem(K.passwordHash)),
      true,
    );
    const protection =
      !hasProtection && backupPassword
        ? await (async () => {
            const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
            return {
              password: backupPassword,
              salt,
              hash: await SecurityService.hashPassword(backupPassword, salt),
              onlyIfUnprotected: true as const,
            };
          })()
        : undefined;
    const summary = await preparedVaultTransaction(
      [
        ...Object.values(domains),
        K.future,
        K.backup,
        K.passwordHash,
        K.initializedFlag,
        K.semanticEmbeddings,
        PRIVATE_DRAFT_KEY,
        FUTURE_DRAFT_KEY,
        RESTORE_JOB,
        ...avatarBackupKeys,
        DELETION_TOMBSTONES_KEY,
      ],
      async (v) => {
        assertCurrent();
        const localTombstones = readDeletionTombstones(v[DELETION_TOMBSTONES_KEY]);
        const deleted = new Map(localTombstones.map((item) => [item.entityIdHash, item]));
        const resurrected = (
          await Promise.all(
            backup.entries.map(async (entry) => ({
              entry,
              tombstone: deleted.get(await hashDeletedId(entry.id)),
            })),
          )
        ).filter(({ entry, tombstone }) => tombstoneBlocksEntry(tombstone, entry));
        const blockedGraphRows = await blockedOntologyRows(backup.vault.ontology, localTombstones);
        if ((resurrected.length || blockedGraphRows.length) && !confirmResurrection)
          throw new Error(
            `备份含 ${resurrected.length + blockedGraphRows.length} 条删除后留下的旧资料，请在恢复预览中确认后重试`,
          );
        const explicitlyRestored = new Set(
          confirmResurrection ? resurrected.map(({ tombstone }) => tombstone!.entityIdHash) : [],
        );
        if (confirmResurrection) {
          for (const row of backup.vault.ontology?.objects ?? []) {
            if (blockedGraphRows.includes(row.id))
              explicitlyRestored.add(await hashDeletedId(row.id, 'cognitive_object'));
          }
          for (const row of backup.vault.ontology?.edges ?? []) {
            if (blockedGraphRows.includes(row.id))
              explicitlyRestored.add(await hashDeletedId(row.id, 'ontology_edge'));
          }
        }
        v[DELETION_TOMBSTONES_KEY] = mergeDeletionTombstones(
          localTombstones.filter((item) => !explicitlyRestored.has(item.entityIdHash)),
          readDeletionTombstones(backup.vault.deletionTombstones),
        ).filter((item) => !explicitlyRestored.has(item.entityIdHash));
        const ontology = mergeAvatarOntologyBackup(
          v[AVATAR_ONTOLOGY_KEY],
          backup.vault.ontology,
          mode,
        );
        const targetPassword =
          protection?.password ??
          ((v[K.passwordHash] ?? accountLocalStorage.getItem(K.passwordHash))
            ? useAppStore.getState().masterPassword
            : null);
        const checkpoint = await prepareAvatarCheckpointRestore(
          v,
          backup.vault,
          mode,
          backupPassword,
          targetPassword,
        );
        assignAvatarCheckpoint(v, checkpoint, ontology);
        const existingEntries = await plaintextEntries(
          (storedArray(v[K.entries], K.entries) as DiaryEntry[]) ?? [],
          useAppStore.getState().masterPassword,
        );
        const oldDraft = v[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined;
        const oldFutureDraft = v[FUTURE_DRAFT_KEY] as FutureDraftSnapshot | undefined;
        const incomingFutureDrafts = normalizeFutureDrafts(backup.vault.futureDrafts);
        const localFutureDrafts = normalizeFutureDrafts(oldFutureDraft?.drafts);
        const draftConflicts = Object.keys(incomingFutureDrafts).filter(
          (key) =>
            localFutureDrafts[key] &&
            canonical(localFutureDrafts[key]) !== canonical(incomingFutureDrafts[key]),
        );
        if (mode === 'merge' && draftConflicts.length)
          throw new Error('本机和备份存在不同规划草稿，请先保存本机规划后再合并。');

        const incomingDraft = backup.vault.draft;
        if (
          mode === 'merge' &&
          incomingDraft &&
          oldDraft?.draft &&
          canonical(incomingDraft) !== canonical(oldDraft.draft)
        )
          throw new Error('本机和备份都存在不同草稿，请先保存本机草稿为记录后再合并。');
        const nextDraft =
          mode === 'replace' ? (incomingDraft ?? null) : (oldDraft?.draft ?? incomingDraft ?? null);
        const data = {} as VaultBackup['vault']['data'];
        for (const [name, key] of Object.entries(domains)) {
          const incoming =
            name === 'entries'
              ? await plaintextEntries(backup.entries, backupPassword ?? null)
              : backup.vault.data[name as keyof typeof domains];
          data[name as keyof typeof domains] =
            mode === 'replace'
              ? incoming
              : mergeValues(
                  name,
                  name === 'entries'
                    ? existingEntries
                    : name === 'materials'
                      ? materialRows(storedArray(v[key], key) ?? [])
                      : (storedArray(v[key], key) ?? []),
                  incoming,
                );
        }
        const current = stateFrom(withLegacyValue(v[K.future], K.future));
        const future = structuredClone(backup.vault.future);
        if (mode === 'merge') {
          for (const name of [
            'visions',
            'goals',
            'items',
            'events',
            'revisions',
            'closures',
            'receipts',
          ] as const) {
            (future[name] as unknown[]) = mergeRows(
              current[name],
              future[name],
              name === 'receipts' ? 'operationId' : 'id',
            );
          }
        }
        if (mode === 'merge') {
          future.practiceRecords = mergeRows(
            current.practiceRecords ?? [],
            future.practiceRecords ?? [],
          ) as FutureState['practiceRecords'];
          future.goalFeedbackRecords = mergeRows(
            current.goalFeedbackRecords ?? [],
            future.goalFeedbackRecords ?? [],
          ) as FutureState['goalFeedbackRecords'];
          const origins = { ...current.archiveOrigins };
          for (const [key, value] of Object.entries(future.archiveOrigins ?? {})) {
            if (origins[key] && canonical(origins[key]) !== canonical(value))
              throw new Error('资料来源关联冲突，未导入任何数据');
            origins[key] = value;
          }
          future.archiveOrigins = origins;
        }
        future.revision = Math.max(current.revision, future.revision) + 1;
        const caches = Object.fromEntries(
          cacheKeys.map((key) => [
            key,
            mode === 'replace'
              ? (backup.vault.caches[key] ?? [])
              : mergeValues(
                  key,
                  JSON.parse(accountLocalStorage.getItem(key) ?? '[]'),
                  backup.vault.caches[key] ?? [],
                ),
          ]),
        );
        validateVaultBackup({
          ...backup,
          entries: data.entries,
          entryCount: data.entries.length,
          vault: { data, future, caches, ontology },
        });
        if (targetPassword)
          data.entries = await Promise.all(
            (data.entries as DiaryEntry[]).map(async (entry) => ({
              ...entry,
              content: await SecurityService.encrypt(entry.content, targetPassword),
              isEncrypted: true,
              supplements: entry.supplements
                ? await Promise.all(
                    entry.supplements.map(async (supplement) => ({
                      ...supplement,
                      content: await SecurityService.encrypt(supplement.content, targetPassword),
                      isEncrypted: true,
                    })),
                  )
                : undefined,
            })),
          );
        for (const [name, key] of Object.entries(domains))
          v[key] = data[name as keyof typeof domains];
        if (ontology !== undefined) v[AVATAR_ONTOLOGY_KEY] = ontology;
        v[FUTURE_DRAFT_KEY] = {
          revision: (oldFutureDraft?.revision ?? 0) + 1,
          drafts:
            mode === 'replace'
              ? incomingFutureDrafts
              : { ...incomingFutureDrafts, ...localFutureDrafts },
        };
        v[PRIVATE_DRAFT_KEY] = { revision: (oldDraft?.revision ?? 0) + 1, draft: nextDraft };
        v[K.future] = future;
        v[K.backup] = data.entries;
        v[K.initializedFlag] = true;
        v[K.semanticEmbeddings] = undefined;
        v[RESTORE_JOB] = { caches, mirrorKeys: Object.values(domains) };
        const restored = summarizeVaultBackupContent({
          entries: data.entries as DiaryEntry[],
          vault: { data, future, draft: nextDraft, caches, ontology },
        });
        return {
          importedCount: backup.entries.length,
          totalAfter: data.entries.length,
          mode,
          restored,
        };
      },
      false,
      protection,
      assertCurrent,
    );
    return { summary, protection };
  });
  if (protection) useAppStore.setState({ masterPassword: protection.password, isUnlocked: true });
  try {
    await recoverBackupRestore();
  } catch {
    throw new Error('数据已导入，本地缓存待恢复。请重新打开页面后检查，无需重复导入。');
  }
  return summary;
}
