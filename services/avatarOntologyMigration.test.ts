import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { SecurityService } from './securityService';
import * as cryptoFile from './vaultBackupFile';
import { accountLocalStorage } from './accountScope';
import {
  AVATAR_V1_KEYS as keys,
  AVATAR_MIGRATION_RESULT_KEY as resultKey,
  AVATAR_MIGRATION_SNAPSHOT_KEY as snapshotKey,
  convertAvatarV1Snapshot,
  migrateAvatarStoreV1ToV2,
} from './avatarOntologyMigration';

const time = Date.UTC(2026, 0, 1);
const password = 'Phase0-private-123!';
const atom = (extra: Record<string, unknown> = {}) => ({
  id: 'a',
  statement: '私密的原始认知',
  nature: 'explicit',
  facets: ['preference'],
  tags: ['工作'],
  contexts: [],
  sourceRefs: [{ source: 'message', id: 'm1', sessionId: 's1', excerpt: '私密' }],
  confidence: 0.8,
  status: 'confirmed',
  sensitivity: 'private',
  createdAt: time,
  confirmedAt: time,
  confirmedBy: 'user',
  ...extra,
});
const understanding = (extra: Record<string, unknown> = {}) => ({
  id: 'u',
  statement: '重复观察',
  patternDomain: 'cognitive',
  status: 'confirmed',
  sourceEntryIds: ['e1', 'e2'],
  createdAt: time,
  confirmedAt: time,
  confirmedBy: 'user',
  ...extra,
});
const raw = (overrides: Partial<Record<keyof typeof keys, string | null>> = {}) => ({
  sessions: null,
  understandings: null,
  atoms: null,
  relations: null,
  tags: null,
  ...overrides,
});
const convert = (atoms: unknown[], understandings: unknown[] = [], relations: unknown[] = []) =>
  convertAvatarV1Snapshot(
    raw({
      atoms: JSON.stringify(atoms),
      understandings: JSON.stringify(understandings),
      relations: JSON.stringify(relations),
    }),
  );

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: false });
});
afterEach(() => vi.restoreAllMocks());
async function unlock() {
  const salt = 'phase-zero-salt';
  await set(K.passwordHash, await SecurityService.hashPassword(password, salt));
  await set(K.passwordSalt, salt);
  useAppStore.setState({ masterPassword: password, isUnlocked: true });
}
function seed(value = [atom()]) {
  localStorage.setItem(keys.atoms, JSON.stringify(value));
}

describe('lossless conservative v1 conversion', () => {
  it('preserves explicit revision lineage without confirming successors', () => {
    const r = convert([
      atom({ id: 'a', status: 'superseded' }),
      atom({ id: 'b', status: 'superseded', previousVersionId: 'a' }),
      atom({ id: 'c', previousVersionId: 'b' }),
    ]);
    expect(r.edges.map((e) => e.type)).toEqual(['SUPERSEDES', 'SUPERSEDES']);
    expect(r.objects[2]).toMatchObject({
      status: 'candidate',
      lineageId: 'v2:atoms:a',
      version: 3,
    });
  });
  it('rejects cyclic, branching and unconfirmed revision provenance', () => {
    for (const rows of [
      [
        atom({ id: 'a', status: 'superseded', previousVersionId: 'b' }),
        atom({ id: 'b', status: 'superseded', previousVersionId: 'a' }),
      ],
      [
        atom({ id: 'a', status: 'superseded' }),
        atom({ id: 'b', previousVersionId: 'a' }),
        atom({ id: 'c', previousVersionId: 'a' }),
      ],
      [
        atom({ id: 'a', status: 'superseded' }),
        atom({ id: 'b', previousVersionId: 'a', confirmedBy: 'assistant' }),
      ],
    ]) {
      const r = convert(rows);
      expect(r.edges).toEqual([]);
      expect(r.diagnostics.some((d) => d.code.startsWith('revision_'))).toBe(true);
    }
  });
  it('does not create a tension through an ambiguous raw identity', () => {
    const r = convert(
      [atom(), atom(), atom({ id: 'b' })],
      [],
      [{ fromId: 'a', toId: 'b', kind: 'contradicts', reason: '历史冲突', createdAt: time }],
    );
    expect(r.edges).toEqual([]);
  });
  it('handles an empty store deterministically', () => {
    expect(convertAvatarV1Snapshot(raw())).toEqual({
      ontologySchemaVersion: 2,
      objects: [],
      edges: [],
      archive: [],
      diagnostics: [],
    });
  });
  it('does not truncate large stores or expire old candidates', () => {
    const values = Array.from({ length: 1400 }, (_, i) =>
      atom({ id: `a${i}`, status: 'candidate', proposedAt: 1 }),
    );
    expect(convert(values).objects).toHaveLength(1400);
    expect(convert(values)).toEqual(convert(values));
  });
  it('retains historical confirmation without inventing an active v2 confirmation', () => {
    const object = convert([atom()]).objects[0];
    expect(object.status).toBe('candidate');
    expect(object.confirmedAt).toBeUndefined();
    expect(object.migration?.legacyConfirmedAt).toBe(new Date(time).toISOString());
    expect(object.privacy).toMatchObject({ sensitivity: 'high', aiVisible: false });
  });
  it('does not count unverified records or assistant messages as evidence', () => {
    const result = convert(
      [
        atom({
          nature: 'inferred',
          facets: ['cognitive_pattern'],
          sourceRefs: Array.from({ length: 4 }, (_, i) => ({
            source: 'message',
            id: `assistant-${i}`,
            sessionId: `s${i}`,
            createdAt: time + i * 86400000,
            excerpt: '助手总结',
          })),
        }),
      ],
      [understanding()],
    );
    expect(result.objects).toHaveLength(2);
    result.objects.forEach((o) =>
      expect(o.evidenceGate).toMatchObject({
        independentExperienceCount: 0,
        distinctUserMessageCount: 0,
        isReadyForConfirmation: false,
      }),
    );
    expect(result.edges).toEqual([]);
  });
  it('preserves deleted-source retention without reauthorizing AI', () => {
    const o = convert([atom({ status: 'retained', retainedAfterSourceDeletion: true })]).objects[0];
    expect(o.status).toBe('retained_after_source_delete');
    expect(o.privacy).toMatchObject({ traceabilityDegraded: true, aiVisible: false });
  });
  it('archives both confirmed and unconfirmed experiences and commitments verbatim', () => {
    const values = ['experience', 'commitment'].flatMap((nature) =>
      ['confirmed', 'candidate'].map((status) =>
        atom({ id: `${nature}-${status}`, nature, status }),
      ),
    );
    const r = convert(values);
    expect(r.objects).toEqual([]);
    expect(r.archive.map((a) => a.value)).toEqual(values);
    expect(r.archive.every((a) => a.readOnly && a.sourceNotExtractable)).toBe(true);
  });
  it('diagnoses corrupt collections and malformed rows without throwing or silently dropping', () => {
    const r = convertAvatarV1Snapshot(
      raw({ atoms: '{broken', understandings: '[null,42,{}]', sessions: '{}', tags: 'false' }),
    );
    expect(r.diagnostics).toHaveLength(6);
    expect(r.objects).toEqual([]);
  });
  it('does not guess ambiguous categories, origin or staged expiry', () => {
    const r = convert([
      atom({ id: '1', facets: ['skill', 'preference'] }),
      atom({ id: '2', sourceRefs: [] }),
      atom({ id: '3', nature: 'state' }),
    ]);
    expect(r.objects).toEqual([]);
    expect(r.diagnostics.map((d) => d.code)).toEqual([
      'category_requires_review',
      'origin_requires_review',
      'validity_requires_review',
    ]);
  });
  it('preserves valid temporal intervals and rejects invalid dates', () => {
    const r = convert([
      atom({ nature: 'state', validFrom: time, validTo: time + 86400000 }),
      atom({ id: 'bad', validTo: time - 1 }),
    ]);
    expect(r.objects[0].validity).toEqual({
      mode: 'staged',
      validFrom: new Date(time).toISOString(),
      validUntil: new Date(time + 86400000).toISOString(),
    });
    expect(r.objects).toHaveLength(1);
  });
  it('merges only exact materialized understanding provenance, not similar statements', () => {
    const r = convert(
      [
        atom({
          nature: 'inferred',
          statement: '重复观察',
          facets: ['cognitive_pattern'],
          sourceRefs: [{ source: 'pattern', id: 'u' }],
        }),
        atom({
          id: 'other',
          nature: 'inferred',
          statement: '重复观察',
          facets: ['cognitive_pattern'],
        }),
      ],
      [understanding()],
    );
    expect(r.objects).toHaveLength(2);
    expect(r.objects[0].migration?.legacyIds).toEqual(['understandings:u', 'atoms:a']);
    expect(r.objects[1].id).toBe('v2:atoms:other');
  });
  it('does not merge a retained or rejected projection into a pending-verification understanding', () => {
    for (const extra of [
      { status: 'retained', retainedAfterSourceDeletion: true },
      { status: 'rejected' },
    ]) {
      const r = convert(
        [
          atom({
            nature: 'inferred',
            statement: '重复观察',
            sourceRefs: [{ source: 'pattern', id: 'u' }],
            ...extra,
          }),
        ],
        [understanding()],
      );
      expect(r.objects).toHaveLength(1);
      expect(r.objects[0]).toMatchObject({
        status: 'candidate',
        privacy: { traceabilityDegraded: false, aiVisible: false },
        migration: { legacyIds: ['understandings:u'] },
      });
      expect(r.diagnostics).toContainEqual({
        collection: 'atoms',
        index: 0,
        code: 'projection_lifecycle_conflict_preserved',
      });
    }
  });
  it('keeps duplicate IDs in snapshot diagnostics instead of overwriting objects', () => {
    expect(
      convert([atom(), atom({ statement: '不同内容' })]).diagnostics.some(
        (d) => d.code === 'duplicate_id_preserved',
      ),
    ).toBe(true);
  });
  it('maps explicit tensions but does not fabricate evidence or tags from memory relations', () => {
    const relations = [
      'supports',
      'contradicts',
      'updates',
      'derived_from',
      'constrains',
      'serves',
      'validated_by',
      'same_context',
    ].map((kind) => ({
      id: kind,
      kind,
      fromId: 'a',
      toId: 'b',
      reason: '历史冲突',
      createdAt: time,
    }));
    const r = convert([atom(), atom({ id: 'b' })], [], relations);
    expect(r.edges.map((e) => e.type)).toEqual(['TENSION_WITH', 'TENSION_WITH']);
    expect(r.diagnostics.filter((d) => d.collection === 'relations')).toHaveLength(6);
  });
});

describe('encrypted checkpoint and atomic commit', () => {
  it('encrypts exact original bytes, verifies persistence, and repeats without changing output or snapshot', async () => {
    await unlock();
    seed();
    localStorage.setItem(keys.sessions, '[ {"role":"assistant","content":"秘密"} ]');
    const first = await migrateAvatarStoreV1ToV2();
    const snapshot = await get(snapshotKey);
    const result = await get(resultKey);
    expect(JSON.stringify(snapshot)).not.toContain('秘密');
    expect(JSON.stringify(result)).not.toContain('私密');
    const restored = (await cryptoFile.decryptVaultBackupFile(snapshot, password)) as {
      raw: ReturnType<typeof raw>;
      capturedAt: string;
    };
    expect(restored.raw.sessions).toBe(localStorage.getItem(keys.sessions));
    expect(restored.raw.atoms).toBe(localStorage.getItem(keys.atoms));
    expect(Number.isFinite(Date.parse(restored.capturedAt))).toBe(true);
    expect(await migrateAvatarStoreV1ToV2()).toEqual(first);
    expect(await get(snapshotKey)).toEqual(snapshot);
    expect(await get(resultKey)).toEqual(result);
  });
  it('migrates an empty protected account', async () => {
    await unlock();
    expect((await migrateAvatarStoreV1ToV2()).objects).toEqual([]);
  });
  it('blocks locked and missing-key sessions before writing', async () => {
    seed();
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow();
    useAppStore.setState({ isUnlocked: true });
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow();
    expect(await get(snapshotKey)).toBeUndefined();
    expect(await get(resultKey)).toBeUndefined();
  });
  it('rejects incorrect session credentials', async () => {
    await unlock();
    useAppStore.setState({ masterPassword: 'wrong-password' });
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow();
    expect(await get(snapshotKey)).toBeUndefined();
  });
  it('never reads or decrypts locked/private/sealed source contents to invent evidence', async () => {
    await unlock();
    seed();
    const entries = [
      {
        id: 'e1',
        isLocked: true,
        isEncrypted: true,
        aiVisibility: 'private',
        content: 'encrypted-opaque',
        unlockAt: time + 1e12,
      },
    ];
    await set(K.entries, entries);
    const r = await migrateAvatarStoreV1ToV2();
    expect(r.edges).toEqual([]);
    expect(await get(K.entries)).toEqual(entries);
  });
  it('blocks corrupted persisted snapshots and leaves legacy data unchanged', async () => {
    await unlock();
    seed();
    const source = localStorage.getItem(keys.atoms);
    await migrateAvatarStoreV1ToV2();
    const snapshot = await get(snapshotKey);
    snapshot.ciphertext = 'corrupt';
    await set(snapshotKey, snapshot);
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow();
    expect(localStorage.getItem(keys.atoms)).toBe(source);
  });
  it('rejects source changes instead of returning a stale result', async () => {
    await unlock();
    seed();
    await migrateAvatarStoreV1ToV2();
    seed([atom({ statement: 'changed' })]);
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow('快照与当前来源不一致');
  });
  it('blocks a lock/unlock ABA change during encryption', async () => {
    await unlock();
    seed();
    const original = cryptoFile.encryptVaultBackupFile;
    vi.spyOn(cryptoFile, 'encryptVaultBackupFile').mockImplementationOnce(async (...args) => {
      useAppStore.setState({ isUnlocked: false });
      useAppStore.setState({ isUnlocked: true });
      return original(...args);
    });
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow();
    expect(await get(resultKey)).toBeUndefined();
  });
  it('blocks permission revocation during result encryption and retains recoverable encrypted snapshot', async () => {
    await unlock();
    seed();
    const original = cryptoFile.encryptVaultBackupFile;
    let calls = 0;
    vi.spyOn(cryptoFile, 'encryptVaultBackupFile').mockImplementation(async (...args) => {
      if (++calls === 2) await set(K.entries, [{ id: 'e1', aiVisibility: 'private' }]);
      return original(...args);
    });
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow('来源或权限已变化');
    expect(cryptoFile.isEncryptedVaultBackup(await get(snapshotKey))).toBe(true);
    expect(await get(resultKey)).toBeUndefined();
    vi.restoreAllMocks();
    expect((await migrateAvatarStoreV1ToV2()).objects).toHaveLength(1);
  });
  it('fails closed on snapshot verification failure', async () => {
    await unlock();
    seed();
    vi.spyOn(cryptoFile, 'decryptVaultBackupFile').mockResolvedValueOnce({ invalid: true });
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow('快照校验失败');
    expect(await get(resultKey)).toBeUndefined();
  });
  it('preserves a checkpoint after encryption failure and resumes idempotently', async () => {
    await unlock();
    seed();
    const original = cryptoFile.encryptVaultBackupFile;
    vi.spyOn(cryptoFile, 'encryptVaultBackupFile')
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error('crypto failed'));
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow('crypto failed');
    const snapshot = await get(snapshotKey);
    expect(snapshot).toBeDefined();
    expect(await get(resultKey)).toBeUndefined();
    vi.restoreAllMocks();
    await migrateAvatarStoreV1ToV2();
    expect(await get(snapshotKey)).toEqual(snapshot);
  });
  it('fails closed on storage read errors', async () => {
    await unlock();
    vi.spyOn(accountLocalStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    await expect(migrateAvatarStoreV1ToV2()).rejects.toThrow('storage unavailable');
    expect(await get(snapshotKey)).toBeUndefined();
  });
});
