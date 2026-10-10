import { PAST_PROCESSING_KEY } from './pastProcessingCache';
import { PRIVATE_DRAFT_KEY } from './privateDraftKey';
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
  vaultTransaction,
  rawVaultTransaction,
  preparedVaultTransaction,
  BACKUP_RESTORE_JOB,
  VaultLockedError,
} from './vaultTransaction';
import { SecurityService } from './securityService';
import { useAppStore } from '../stores/appStore';
import { encryptVaultBackupFile } from './vaultBackupFile';
import { recoverSourceDeletion } from './sourceDeletion';
import { storedArray, withLegacyValue } from './vaultLegacyRead';
import { decodeEntries, type UnreadableEntry } from './readableEntries';
import {
  summarizeMaterialReferences,
  type MaterialReferenceSummary,
} from '../lib/materialPersistence';

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
const memoryKeys = [
  'vector:avatar:atomic-memories:v1',
  'vector:avatar:memory-relations:v1',
  'vector:avatar:memory-tags:v1',
] as const;
const cacheKeys = [
  PAST_PROCESSING_KEY,
  ...memoryKeys,
  'vector:avatar:understandings:v1',
  'vector:avatar:sessions:v1',
  'user_custom_anchors',
] as const;
const RESTORE_JOB = BACKUP_RESTORE_JOB;
type Row = { id: string; [key: string]: unknown };
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
    caches: Record<string, unknown[]>;
  };
}
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
function rows(value: unknown, key = 'id'): asserts value is Row[] {
  if (
    !Array.isArray(value) ||
    value.some((r) => !r || typeof r[key] !== 'string' || !r[key]) ||
    new Set(value.map((r) => r[key])).size !== value.length
  )
    throw new Error('备份包含无效或重复编号');
}
function strings(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    throw new Error('备份标签格式无效');
}
const scalarDomain = (name: string) =>
  ['guidingStars', 'selectedStars', 'user_custom_anchors'].includes(name);
const mergeValues = (name: string, current: unknown[], incoming: unknown[]) =>
  name === PAST_PROCESSING_KEY
    ? []
    : scalarDomain(name)
      ? [...new Set([...current, ...incoming])]
      : mergeRows(current, incoming, name === 'vector:avatar:memory-tags:v1' ? 'name' : 'id');
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
  for (const e of b.entries)
    if (
      typeof e.content !== 'string' ||
      typeof e.title !== 'string' ||
      !Number.isFinite(e.createdAt) ||
      !Array.isArray(e.tags)
    )
      throw new Error('记录格式无效');
  stateFrom(b.vault.future);
  if (b.vault.draft) normalizeNowDraft(b.vault.draft);
  for (const key of cacheKeys) {
    if (key === PAST_PROCESSING_KEY && b.vault.caches[key] === undefined) continue;
    if (
      b.schemaVersion === 2 &&
      memoryKeys.some((name) => name === key) &&
      b.vault.caches[key] === undefined
    )
      continue;
    if (scalarDomain(key)) strings(b.vault.caches[key]);
    else rows(b.vault.caches[key], key === 'vector:avatar:memory-tags:v1' ? 'name' : 'id');
  }
  const entries = new Set(b.entries.map((e) => e.id));
  const actions = b.vault.data.actions as Row[];
  const goalIds = new Set(b.vault.future.goals.map((g) => g.id));
  for (const a of actions)
    if (
      typeof a.title !== 'string' ||
      !['pending', 'active', 'completed', 'abandoned'].includes(String(a.status)) ||
      (a.goalId && !goalIds.has(String(a.goalId)))
    )
      throw new Error('行动关联无效');
  for (const e of b.vault.future.events)
    if (
      (e.sourceEntryId && !entries.has(e.sourceEntryId)) ||
      (e.sourceActionId && !actions.some((a) => a.id === e.sourceActionId))
    )
      throw new Error('成果来源缺失');
}
/** A persisted restore decision repairs the legacy local caches after a crash. */
let recovery: Promise<void> | undefined;
export function recoverBackupRestore(): Promise<void> {
  if (recovery) return recovery;
  recovery = (async () => {
    if (!(await rawVaultTransaction([RESTORE_JOB], (v) => Boolean(v[RESTORE_JOB]), true))) return;
    // Boot must reach the unlock screen before an encrypted recovery job can run.
    const session = useAppStore.getState();
    const protectedVault = await rawVaultTransaction(
      [K.passwordHash],
      (v) => v[K.passwordHash] ?? localStorage.getItem(K.passwordHash),
      true,
    );
    if (protectedVault && (!session.isUnlocked || !session.masterPassword)) return;
    await vaultTransaction([RESTORE_JOB], (v) => {
      const job = v[RESTORE_JOB] as
        | { caches: Record<string, unknown[]>; mirrorKeys: string[] }
        | undefined;
      if (!job) return;
      for (const key of cacheKeys) localStorage.setItem(key, JSON.stringify(job.caches[key] ?? []));
      for (const key of job.mirrorKeys) localStorage.removeItem(key);
      localStorage.removeItem(K.backup);
      v[RESTORE_JOB] = undefined;
    });
  })().finally(() => {
    recovery = undefined;
  });
  return recovery;
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
    [...Object.values(domains), K.future, K.passwordHash, PRIVATE_DRAFT_KEY],
    async (v) => {
      if (!allowProtected && (v[K.passwordHash] || localStorage.getItem(K.passwordHash)))
        throw new Error('完整备份暂不支持加密资料库，未导出任何文件');
      const data = Object.fromEntries(
        Object.entries(domains).map(([name, key]) => [name, storedArray(v[key], key) ?? []]),
      ) as VaultBackup['vault']['data'];
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
        cacheKeys.map((key) => [key, JSON.parse(localStorage.getItem(key) ?? '[]')]),
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
          caches,
          draft: (v[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined)?.draft ?? null,
        },
      };
      validateVaultBackup(result);
      return {
        backup: result,
        skippedEntries: decoded.unreadableEntries,
        protectedVault: Boolean(v[K.passwordHash] ?? localStorage.getItem(K.passwordHash)),
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
  const session = useAppStore.getState();
  const { backup, protectedVault } = await snapshotVaultBackup(version, userId, true);
  const result = protectedVault
    ? await encryptVaultBackupFile(backup, session.masterPassword ?? '')
    : backup;
  const current = useAppStore.getState();
  if (
    current.isUnlocked !== session.isUnlocked ||
    current.masterPassword !== session.masterPassword
  )
    throw new VaultLockedError();
  return result;
}
/** Explicitly produces a usable copy of readable records after damage. The source vault is never changed. */
export async function exportRecoverableVaultBackupFile(version: string, userId?: string) {
  const session = useAppStore.getState();
  const { backup, protectedVault, skippedEntries } = await snapshotVaultBackup(
    version,
    userId,
    true,
    true,
  );
  const file = protectedVault
    ? await encryptVaultBackupFile(backup, session.masterPassword ?? '')
    : backup;
  const current = useAppStore.getState();
  if (
    current.isUnlocked !== session.isUnlocked ||
    current.masterPassword !== session.masterPassword
  )
    throw new VaultLockedError();
  return { file, skippedEntries } as {
    file: VaultBackup | Awaited<ReturnType<typeof encryptVaultBackupFile>>;
    skippedEntries: UnreadableEntry[];
  };
}
export interface VaultRecoveryDrill {
  mode: 'merge' | 'replace';
  canRestore: boolean;
  importedCount: number;
  totalAfter: number;
  conflicts: string[];
  dataCounts: Record<string, number>;
  materialReferences: MaterialReferenceSummary;
  externalReferenceLimitations: string;
}

const summarizeBackupMaterialReferences = (backup: VaultBackup): MaterialReferenceSummary => {
  const references: Array<string | null | undefined> = [];
  for (const entry of backup.entries) {
    if (entry.attachment) references.push(entry.attachment.data);
    for (const material of entry.nowMaterials ?? []) references.push(material.url);
  }
  for (const material of backup.vault.draft?.materials ?? []) references.push(material.url);
  for (const row of backup.vault.data.materials) {
    if (!row || typeof row !== 'object') continue;
    const candidate = row as { data?: unknown; url?: unknown };
    references.push(
      typeof candidate.data === 'string'
        ? candidate.data
        : typeof candidate.url === 'string'
          ? candidate.url
          : undefined,
    );
  }
  return summarizeMaterialReferences(references);
};

/** Computes a restore result in memory only. It does not create restore jobs or write any vault key. */
export async function drillVaultBackupRestore(
  backup: VaultBackup,
  mode: 'merge' | 'replace' = 'merge',
  userId?: string,
): Promise<VaultRecoveryDrill> {
  validateVaultBackup(backup);
  const localDomains = domainsFor(userId);
  return preparedVaultTransaction(
    [...Object.values(localDomains), K.passwordHash, PRIVATE_DRAFT_KEY],
    async (v) => {
      const current = await decodeEntries(
        (storedArray(v[K.entries], K.entries) as DiaryEntry[]) ?? [],
        useAppStore.getState().masterPassword,
      );
      const conflicts = current.unreadableEntries.map(
        (entry) => `本机记录无法读取：${entry.id}（${entry.reason}）`,
      );
      const byId = new Map(current.entries.map((entry) => [entry.id, entry]));
      for (const entry of backup.entries) {
        const old = byId.get(entry.id);
        if (old && canonical(old) !== canonical(entry)) conflicts.push(`记录编号冲突：${entry.id}`);
      }
      const oldDraft = v[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined;
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
        dataCounts: Object.fromEntries(
          Object.entries(backup.vault.data).map(([key, rows]) => [key, rows.length]),
        ),
        materialReferences: summarizeBackupMaterialReferences(backup),
        externalReferenceLimitations:
          '演练不会访问外部链接、本机媒体或网络资源，也不会写入当前资料库。内嵌素材可随备份恢复；网页链接仅保存地址。',
      };
    },
    true,
  );
}
async function plaintextEntries(
  entries: DiaryEntry[],
  password: string | null,
): Promise<DiaryEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      if (!entry.isEncrypted) return { ...entry, isEncrypted: false };
      if (!password) throw new VaultLockedError();
      return {
        ...entry,
        content: await SecurityService.decrypt(entry.content, password),
        isEncrypted: false,
      };
    }),
  );
}
function mergeRows(current: unknown[], incoming: unknown[], key = 'id'): unknown[] {
  const merged = [...current];
  for (const raw of incoming) {
    const row = raw as Record<string, unknown>;
    const old = merged.find((r) => (r as Record<string, unknown>)[key] === row[key]);
    if (old && canonical(old) !== canonical(row))
      throw new Error(
        `编号冲突：${String(row[key])}。未导入任何数据，请检查并使用内容一致的备份。`,
      );
    if (!old) merged.push(row);
  }
  return merged;
}
export async function importVaultBackup(
  backup: VaultBackup,
  mode: 'merge' | 'replace' = 'merge',
  userId?: string,
  backupPassword?: string,
) {
  const domains = domainsFor(userId);
  validateVaultBackup(backup);
  await recoverSourceDeletion();
  await recoverBackupRestore();
  const hasProtection = await rawVaultTransaction(
    [K.passwordHash],
    (v) => Boolean(v[K.passwordHash] ?? localStorage.getItem(K.passwordHash)),
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
      RESTORE_JOB,
    ],
    async (v) => {
      const targetPassword =
        protection?.password ?? (v[K.passwordHash] ? useAppStore.getState().masterPassword : null);
      const existingEntries = await plaintextEntries(
        (storedArray(v[K.entries], K.entries) as DiaryEntry[]) ?? [],
        useAppStore.getState().masterPassword,
      );
      const oldDraft = v[PRIVATE_DRAFT_KEY] as DraftSnapshot | undefined;
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
                name === 'entries' ? existingEntries : (storedArray(v[key], key) ?? []),
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
                JSON.parse(localStorage.getItem(key) ?? '[]'),
                backup.vault.caches[key] ?? [],
              ),
        ]),
      );
      validateVaultBackup({
        ...backup,
        entries: data.entries,
        entryCount: data.entries.length,
        vault: { data, future, caches },
      });
      if (targetPassword)
        data.entries = await Promise.all(
          (data.entries as DiaryEntry[]).map(async (entry) => ({
            ...entry,
            content: await SecurityService.encrypt(entry.content, targetPassword),
            isEncrypted: true,
          })),
        );
      for (const [name, key] of Object.entries(domains))
        v[key] = data[name as keyof typeof domains];
      v[PRIVATE_DRAFT_KEY] = { revision: (oldDraft?.revision ?? 0) + 1, draft: nextDraft };
      v[K.future] = future;
      v[K.backup] = data.entries;
      v[K.initializedFlag] = true;
      v[K.semanticEmbeddings] = undefined;
      v[RESTORE_JOB] = { caches, mirrorKeys: Object.values(domains) };
      return { importedCount: backup.entries.length, totalAfter: data.entries.length, mode };
    },
    false,
    protection,
  );
  if (protection) useAppStore.setState({ masterPassword: protection.password, isUnlocked: true });
  try {
    await recoverBackupRestore();
  } catch {
    throw new Error('数据已导入，本地缓存待恢复。请重新打开页面后检查，无需重复导入。');
  }
  return summary;
}
