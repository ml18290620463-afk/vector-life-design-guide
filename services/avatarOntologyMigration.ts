import { convertAvatarV1Snapshot } from './avatarOntologyMigrationConversion';
export { convertAvatarV1Snapshot } from './avatarOntologyMigrationConversion';
import { AVATAR_V1_KEYS } from './avatarLegacyTypes';
import type { RawStore, AvatarMigrationResult, Snapshot } from './avatarLegacyTypes';
export { AVATAR_V1_KEYS } from './avatarLegacyTypes';
export type {
  RawStore,
  MigrationDiagnostic,
  AvatarMigrationResult,
  Snapshot,
} from './avatarLegacyTypes';
import { accountLocalStorage, currentAccountId } from './accountScope';
import { DiaryStorageKeys as K } from './diaryStorage';
import { rawVaultTransaction, VaultLockedError } from './vaultTransaction';
import { useAppStore } from '../stores/appStore';
import { SecurityService } from './securityService';
import { validateAvatarOntology } from './avatarOntologyValidation';
import {
  decryptVaultBackupFile,
  encryptVaultBackupFile,
  isEncryptedVaultBackup,
} from './vaultBackupFile';

import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from './avatarOntologyKey';
export { AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY } from './avatarOntologyKey';
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const readRaw = (): RawStore =>
  Object.fromEntries(
    Object.entries(AVATAR_V1_KEYS).map(([name, key]) => [name, accountLocalStorage.getItem(key)]),
  ) as RawStore;

/** Read-only probe; malformed or nonempty legacy bytes always require protection. */
export function hasLegacyAvatarData(): boolean {
  return Object.values(readRaw()).some((value) => {
    if (value === null) return false;
    try {
      const decoded: unknown = JSON.parse(value);
      return !Array.isArray(decoded) || decoded.length > 0;
    } catch {
      return true;
    }
  });
}

/** Capture exact source bytes without invoking destructive candidate/session readers. */
export function captureLegacyAvatarGuard(): () => void {
  const before = readRaw();
  return () => {
    if (!equal(before, readRaw())) throw new Error('迁移期间旧资料发生变化，请重试');
  };
}

/** Call only after the encrypted checkpoint has been verified. Never sanitize,
 * reorder or truncate source messages: evidence indices refer to these bytes.
 * Invalid/over-capacity histories block activation and remain in the snapshot. */
export function readLegacyAvatarSessionsForMigration() {
  const raw = readRaw().sessions;
  const sessions: unknown = raw === null ? [] : JSON.parse(raw);
  const graph: unknown = {
    ontologySchemaVersion: 2,
    revision: 0,
    objects: [],
    edges: [],
    sessions,
  };
  validateAvatarOntology(graph);
  return structuredClone(graph.sessions ?? []);
}

/**
 * A checkpoint, not a second runtime store. Phase 1 consumes this explicitly.
 * Snapshot and result are always encrypted, even if a legacy item was AI-visible.
 * The source remains untouched; rollback is the original snapshot's exact raw strings.
 */
export async function migrateAvatarStoreV1ToV2(
  options: { requireExistingCheckpoint?: boolean } = {},
): Promise<AvatarMigrationResult> {
  const requireExistingCheckpoint = options.requireExistingCheckpoint === true;
  const session = useAppStore.getState();
  if (!session.isUnlocked || !session.masterPassword) throw new VaultLockedError();
  const password = session.masterPassword;
  const accountId = currentAccountId();
  let invalidated = false;
  const unsubscribe = useAppStore.subscribe((next, previous) => {
    if (next.isUnlocked !== previous.isUnlocked || next.masterPassword !== previous.masterPassword)
      invalidated = true;
  });
  const assertSession = () => {
    const current = useAppStore.getState();
    if (
      invalidated ||
      currentAccountId() !== accountId ||
      !current.isUnlocked ||
      current.masterPassword !== password
    )
      throw new VaultLockedError();
  };
  // Capture all permissions as raw values without invoking destructive legacy readers.
  const guardKeys = [K.passwordHash, K.passwordSalt, K.entries, K.future, K.actions, K.principles];
  const keys = [...guardKeys, AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY];
  try {
    const raw = readRaw();
    const mirror = [
      accountLocalStorage.getItem(K.passwordHash),
      accountLocalStorage.getItem(K.passwordSalt),
    ];
    const before = await rawVaultTransaction(keys, (values) => structuredClone(values), true);
    const hash = before[K.passwordHash] ?? mirror[0];
    const salt = before[K.passwordSalt] ?? mirror[1];
    if (
      !hash ||
      !salt ||
      !(await SecurityService.verifyPassword(password, String(salt), String(hash)))
    )
      throw new VaultLockedError();
    const guard = (values: Record<string, unknown>) => {
      assertSession();
      if (
        !equal(raw, readRaw()) ||
        !equal(mirror, [
          accountLocalStorage.getItem(K.passwordHash),
          accountLocalStorage.getItem(K.passwordSalt),
        ]) ||
        guardKeys.some((key) => !equal(before[key], values[key]))
      )
        throw new Error('迁移期间来源或权限已变化，请重试');
    };
    const existing = before[AVATAR_MIGRATION_SNAPSHOT_KEY];
    if (
      requireExistingCheckpoint &&
      (existing === undefined || before[AVATAR_MIGRATION_RESULT_KEY] === undefined)
    )
      throw new Error('已升级资料缺少迁移快照或结果，请恢复完整备份');
    let snapshot: Snapshot;
    if (existing !== undefined) {
      if (!isEncryptedVaultBackup(existing)) throw new Error('迁移快照格式校验失败');
      const decoded = await decryptVaultBackupFile(existing, password);
      if (
        !record(decoded) ||
        decoded.version !== 1 ||
        decoded.accountId !== accountId ||
        typeof decoded.capturedAt !== 'string' ||
        !equal(decoded.raw, raw)
      )
        throw new Error('迁移快照与当前来源不一致');
      snapshot = decoded as unknown as Snapshot;
    } else {
      if (before[AVATAR_MIGRATION_RESULT_KEY] !== undefined)
        throw new Error('迁移结果缺少原始快照');
      snapshot = { version: 1, accountId, capturedAt: new Date().toISOString(), raw };
      const encrypted = await encryptVaultBackupFile(snapshot, password);
      if (!equal(await decryptVaultBackupFile(encrypted, password), snapshot))
        throw new Error('迁移快照校验失败');
      await rawVaultTransaction(keys, (values) => {
        guard(values);
        if (
          values[AVATAR_MIGRATION_SNAPSHOT_KEY] !== undefined ||
          values[AVATAR_MIGRATION_RESULT_KEY] !== undefined
        )
          throw new Error('迁移并发冲突，请重试');
        values[AVATAR_MIGRATION_SNAPSHOT_KEY] = encrypted;
      });
      before[AVATAR_MIGRATION_SNAPSHOT_KEY] = encrypted;
    }
    // Verify the persisted snapshot before any conversion or result commit.
    const persisted = await rawVaultTransaction(
      keys,
      (values) => {
        guard(values);
        return values[AVATAR_MIGRATION_SNAPSHOT_KEY];
      },
      true,
    );
    if (
      !isEncryptedVaultBackup(persisted) ||
      !equal(await decryptVaultBackupFile(persisted, password), snapshot)
    )
      throw new Error('持久化迁移快照校验失败');
    const result = convertAvatarV1Snapshot(snapshot.raw);
    const previousResult = before[AVATAR_MIGRATION_RESULT_KEY];
    if (previousResult !== undefined) {
      if (
        !isEncryptedVaultBackup(previousResult) ||
        !equal(await decryptVaultBackupFile(previousResult, password), result)
      )
        throw new Error('迁移结果校验失败');
      await rawVaultTransaction(
        keys,
        (values) => {
          guard(values);
          if (
            !equal(values[AVATAR_MIGRATION_RESULT_KEY], previousResult) ||
            !equal(values[AVATAR_MIGRATION_SNAPSHOT_KEY], persisted)
          )
            throw new Error('迁移并发冲突');
        },
        true,
      );
      return result;
    }
    const encryptedResult = await encryptVaultBackupFile(result, password);
    if (!equal(await decryptVaultBackupFile(encryptedResult, password), result))
      throw new Error('迁移结果校验失败');
    await rawVaultTransaction(keys, (values) => {
      guard(values);
      if (
        !equal(values[AVATAR_MIGRATION_SNAPSHOT_KEY], persisted) ||
        values[AVATAR_MIGRATION_RESULT_KEY] !== undefined
      )
        throw new Error('迁移并发冲突，请重试');
      values[AVATAR_MIGRATION_RESULT_KEY] = encryptedResult;
    });
    return result;
  } finally {
    unsubscribe();
  }
}

/** Import boundary: convert transport bytes without ever installing v1 runtime caches.
 * Existing v2 plus v1 is accepted only when its verified checkpoint contains the
 * exact same originals. Never merge an unproven second source into a live graph.
 */
export async function migrateAvatarTransport(
  data: Record<string, unknown>,
  caches: Record<string, string>,
  password: string,
  accountId: string | null,
) {
  const legacyKeys = Object.values(AVATAR_V1_KEYS);
  if (!legacyKeys.some((key) => Object.hasOwn(caches, key)))
    return { data: structuredClone(data), caches: structuredClone(caches) };
  if (!password) throw new VaultLockedError();
  const raw = Object.fromEntries(
    Object.entries(AVATAR_V1_KEYS).map(([name, key]) => [name, caches[key] ?? null]),
  ) as RawStore;
  const nextData = structuredClone(data);
  const nextCaches = structuredClone(caches);
  const existingSnapshot = data[AVATAR_MIGRATION_SNAPSHOT_KEY];
  const existingResult = data[AVATAR_MIGRATION_RESULT_KEY];
  const result = convertAvatarV1Snapshot(raw);
  if (existingSnapshot !== undefined || existingResult !== undefined) {
    if (!isEncryptedVaultBackup(existingSnapshot) || !isEncryptedVaultBackup(existingResult))
      throw new Error('迁移快照格式校验失败');
    const snapshot = await decryptVaultBackupFile(existingSnapshot, password);
    if (
      !record(snapshot) ||
      snapshot.version !== 1 ||
      snapshot.accountId !== accountId ||
      typeof snapshot.capturedAt !== 'string' ||
      !Number.isFinite(Date.parse(snapshot.capturedAt)) ||
      !equal(snapshot.raw, raw) ||
      !equal(await decryptVaultBackupFile(existingResult, password), result)
    )
      throw new Error('旧版导入资料与迁移快照不一致');
  } else {
    if (data[AVATAR_ONTOLOGY_KEY] !== undefined)
      throw new Error('混合版本资料缺少旧数据迁移凭据，未导入任何资料');
    const snapshot: Snapshot = { version: 1, accountId, capturedAt: new Date().toISOString(), raw };
    const encryptedSnapshot = await encryptVaultBackupFile(snapshot, password);
    const encryptedResult = await encryptVaultBackupFile(result, password);
    if (
      !equal(await decryptVaultBackupFile(encryptedSnapshot, password), snapshot) ||
      !equal(await decryptVaultBackupFile(encryptedResult, password), result)
    )
      throw new Error('迁移快照校验失败');
    nextData[AVATAR_MIGRATION_SNAPSHOT_KEY] = encryptedSnapshot;
    nextData[AVATAR_MIGRATION_RESULT_KEY] = encryptedResult;
  }
  if (data[AVATAR_ONTOLOGY_KEY] === undefined) {
    const graph = {
      ontologySchemaVersion: 2,
      revision: 0,
      objects: result.objects,
      edges: result.edges,
      sessions: raw.sessions === null ? [] : JSON.parse(raw.sessions),
      migrationCheckpointRequired: true,
    };
    validateAvatarOntology(graph);
    nextData[AVATAR_ONTOLOGY_KEY] = {
      format: 'vector-private-v1',
      ciphertext: await SecurityService.encrypt(JSON.stringify(graph), password),
    };
  }
  for (const key of legacyKeys) delete nextCaches[key];
  return { data: nextData, caches: nextCaches };
}

/** File-format boundary: legacy arrays are converted before any restore transaction.
 * Exact checkpoint bytes remain authoritative even when JSON arrays were reformatted.
 */
export async function normalizeAvatarBackupPayload(
  incoming: {
    ontology?: import('./avatarOntologyStore').AvatarOntologySnapshot;
    migrationCheckpoint?: import('./avatarOntologyMigrationCheckpoint').AvatarMigrationCheckpoint;
    caches: Record<string, unknown[]>;
  },
  password: string | null,
) {
  const payload = structuredClone(incoming);
  const legacy = Object.entries(AVATAR_V1_KEYS);
  const present = legacy.filter(([, key]) => Object.hasOwn(payload.caches, key));
  if (!present.length) return payload;
  for (const [, key] of present)
    if (!Array.isArray(payload.caches[key])) throw new Error('旧版分身备份格式无效');
  const nonempty = present.some(([, key]) => payload.caches[key].length > 0);
  if (!nonempty && !payload.migrationCheckpoint) {
    for (const [, key] of present) delete payload.caches[key];
    return payload;
  }
  if (!password) throw new VaultLockedError();
  const { decodeAvatarMigrationCheckpoint, avatarMigrationCheckpointFrom } =
    await import('./avatarOntologyMigrationCheckpoint');
  const { canonical } = await import('./vaultBackupNormalization');
  const transport: Record<string, unknown> = {};
  const rawCaches: Record<string, string> = {};
  let owner = currentAccountId();
  if (payload.migrationCheckpoint) {
    const decoded = await decodeAvatarMigrationCheckpoint(payload.migrationCheckpoint, password);
    owner = decoded.snapshot.accountId;
    for (const [name, key] of present) {
      const original = decoded.snapshot.raw[name as keyof RawStore];
      if (
        canonical(original === null ? [] : JSON.parse(original)) !== canonical(payload.caches[key])
      )
        throw new Error('旧版导入资料与迁移快照不一致');
    }
    for (const [name, key] of legacy) {
      const original = decoded.snapshot.raw[name as keyof RawStore];
      if (original !== null) rawCaches[key] = original;
    }
    transport[AVATAR_MIGRATION_SNAPSHOT_KEY] = payload.migrationCheckpoint.snapshot;
    transport[AVATAR_MIGRATION_RESULT_KEY] = payload.migrationCheckpoint.result;
  } else {
    for (const [, key] of present) rawCaches[key] = JSON.stringify(payload.caches[key]);
  }
  if (payload.ontology !== undefined) transport[AVATAR_ONTOLOGY_KEY] = payload.ontology;
  const migrated = await migrateAvatarTransport(transport, rawCaches, password, owner);
  let graph = migrated.data[AVATAR_ONTOLOGY_KEY];
  if (record(graph) && graph.format === 'vector-private-v1' && typeof graph.ciphertext === 'string')
    graph = JSON.parse(await SecurityService.decrypt(graph.ciphertext, password));
  validateAvatarOntology(graph);
  payload.ontology = graph;
  payload.migrationCheckpoint = avatarMigrationCheckpointFrom(migrated.data);
  for (const [, key] of present) delete payload.caches[key];
  return payload;
}

/** Read-only export probe; all v1 key knowledge stays inside the migration boundary. */
export function readLegacyAvatarBackupCaches(): Record<string, unknown[]> {
  return Object.fromEntries(
    Object.values(AVATAR_V1_KEYS).flatMap((key) => {
      const raw = accountLocalStorage.getItem(key);
      if (raw === null) return [];
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) throw new Error('旧版分身备份格式无效');
      return [[key, value]];
    }),
  );
}

/** Raw, read-only transport probe. Preserve exact bytes for account fingerprints. */
export function readLegacyAvatarTransportCaches(): Record<string, string> {
  return Object.fromEntries(
    Object.values(AVATAR_V1_KEYS).flatMap((key) => {
      const raw = accountLocalStorage.getItem(key);
      return raw === null ? [] : [[key, raw]];
    }),
  );
}

export function isLegacyAvatarTransportKey(key: string): boolean {
  return Object.values(AVATAR_V1_KEYS).some((legacyKey) => legacyKey === key);
}

export function hasLegacyAvatarTransport(caches: Record<string, unknown>): boolean {
  return Object.keys(caches).some(isLegacyAvatarTransportKey);
}

/** Restore-only retirement. The caller has verified and persisted the encrypted
 * recovery journal and normalized v2 graph before entering this synchronous step.
 * No values are ever copied back into the retired runtime stores. */
export function retireLegacyAvatarTransportCaches(): void {
  for (const key of Object.values(AVATAR_V1_KEYS)) accountLocalStorage.removeItem(key);
}
