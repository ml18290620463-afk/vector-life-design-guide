import type { DiaryEntry } from '../types';
import type { FutureState } from '../types/future';
import {
  DiaryStorageKeys as K,
  getMaterialsStorageKey,
  getSelectedStarsStorageKey,
} from './diaryStorage';
import { stateFrom } from './futureRepository';
import { vaultTransaction } from './vaultTransaction';
import { recoverSourceDeletion } from './sourceDeletion';
import { storedArray, withLegacyValue } from './vaultLegacyRead';

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
  ...memoryKeys,
  'vector:avatar:understandings:v1',
  'vector:avatar:sessions:v1',
  'user_custom_anchors',
] as const;
const RESTORE_JOB = 'vector_backup_restore_job_v1';
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
  scalarDomain(name)
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
  for (const key of cacheKeys) {
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
    if (!(await vaultTransaction([RESTORE_JOB], (v) => Boolean(v[RESTORE_JOB]), true))) return;
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
export async function exportVaultBackup(version: string, userId?: string): Promise<VaultBackup> {
  const domains = domainsFor(userId);
  await recoverSourceDeletion();
  await recoverBackupRestore();
  return vaultTransaction(
    [...Object.values(domains), K.future, K.passwordHash],
    (v) => {
      // Existing encryption covers diary content only. Never export a decrypted UI snapshot.
      if (v[K.passwordHash] || localStorage.getItem(K.passwordHash))
        throw new Error('完整备份暂不支持加密资料库，未导出任何文件');
      const data = Object.fromEntries(
        Object.entries(domains).map(([name, key]) => [name, storedArray(v[key], key) ?? []]),
      ) as VaultBackup['vault']['data'];
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
        vault: { data, future: stateFrom(withLegacyValue(v[K.future], K.future)), caches },
      };
      validateVaultBackup(result);
      return result;
    },
    true,
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
) {
  const domains = domainsFor(userId);
  validateVaultBackup(backup);
  await recoverSourceDeletion();
  await recoverBackupRestore();
  const summary = await vaultTransaction(
    [
      ...Object.values(domains),
      K.future,
      K.backup,
      K.passwordHash,
      K.initializedFlag,
      K.semanticEmbeddings,
      RESTORE_JOB,
    ],
    (v) => {
      if (v[K.passwordHash] || localStorage.getItem(K.passwordHash))
        throw new Error('请勿将未加密备份导入加密资料库');
      const data = {} as VaultBackup['vault']['data'];
      for (const [name, key] of Object.entries(domains)) {
        const incoming = backup.vault.data[name as keyof typeof domains];
        data[name as keyof typeof domains] =
          mode === 'replace'
            ? incoming
            : mergeValues(name, storedArray(v[key], key) ?? [], incoming);
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
      for (const [name, key] of Object.entries(domains))
        v[key] = data[name as keyof typeof domains];
      v[K.future] = future;
      v[K.backup] = data.entries;
      v[K.initializedFlag] = true;
      v[K.semanticEmbeddings] = undefined;
      v[RESTORE_JOB] = { caches, mirrorKeys: Object.values(domains) };
      return { importedCount: backup.entries.length, totalAfter: data.entries.length, mode };
    },
  );
  try {
    await recoverBackupRestore();
  } catch {
    throw new Error('数据已导入，本地缓存待恢复。请重新打开页面后检查，无需重复导入。');
  }
  return summary;
}
