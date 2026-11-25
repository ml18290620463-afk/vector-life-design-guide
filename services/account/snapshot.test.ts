import { beforeEach, expect, it, vi } from 'vitest';
import { DiaryStorageKeys as K } from '../diaryStorage';
import { SecurityService } from '../securityService';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from '../avatarOntologyKey';
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
async function setup() {
  const scope = await import('../accountScope');
  scope.initializeAccountScope(crypto.randomUUID());
  const db = await import('../accountIdb');
  const salt = 'test-salt';
  await db.set(K.passwordSalt, salt);
  await db.set(K.passwordHash, await SecurityService.hashPassword('test-password', salt));
  await db.set(K.entries, [{ id: 'a', text: 'private diary' }]);
  return { scope, db, api: await import('./snapshot') };
}
it('encrypts the entire snapshot and rejects wrong passwords, tampering and wrong owners', async () => {
  const { api, scope } = await setup();
  const snapshot = await api.captureSnapshot();
  const sealed = await api.sealSnapshot(snapshot, 'test-password');
  expect(JSON.stringify(sealed)).not.toContain('private diary');
  expect(await api.openSnapshot(sealed, 'test-password')).toEqual({
    ...snapshot,
    ontologySchemaVersion: 2,
  });
  await expect(api.openSnapshot(sealed, 'wrong')).rejects.toThrow();
  await expect(
    api.openSnapshot(
      { ...sealed, ciphertext: 'AAAA' + sealed.ciphertext.slice(4) },
      'test-password',
    ),
  ).rejects.toThrow();
  expect(() => api.validateSnapshot({ ...snapshot, owner: crypto.randomUUID() })).toThrow();
  expect(snapshot.owner).toBe(scope.currentAccountId());
});
it('refuses to seal new-password data with an old password', async () => {
  const { api } = await setup();
  await expect(api.sealSnapshot(await api.captureSnapshot(), 'old-password')).rejects.toThrow(
    '密码已变化',
  );
});
it('restores deletions, removes stale mirrors and retains a decryptable recovery copy', async () => {
  const { api, db, scope } = await setup();
  await db.set(K.principles, [{ id: 'old' }]);
  scope.accountLocalStorage.setItem(K.principles, '[{"id":"resurrect"}]');
  scope.accountLocalStorage.setItem(K.backup, 'old backup');
  const before = await api.captureSnapshot();
  const next = structuredClone(before);
  delete next.data[K.principles];
  next.data[K.entries] = [];
  await api.applySnapshot(next, 2, await api.fingerprint(before), 'test-password');
  expect(await db.get(K.principles)).toBeUndefined();
  expect(scope.accountLocalStorage.getItem(K.principles)).toBeNull();
  expect(scope.accountLocalStorage.getItem(K.backup)).toBeNull();
  expect(api.readSyncBase().revision).toBe(2);
  const recovery = await import('./recovery');
  const copies = await recovery.listRecoveryCopies();
  expect(copies).toHaveLength(1);
  expect(
    await api.openSnapshot(await recovery.readRecoveryCopy(copies[0]), 'test-password'),
  ).toEqual(before);
});
it('does not replace edits made since the cloud restore prompt', async () => {
  const { api, db } = await setup();
  const snapshot = await api.captureSnapshot();
  const expected = await api.fingerprint(snapshot);
  await db.set(K.entries, [{ id: 'newer' }]);
  await expect(api.applySnapshot(snapshot, 2, expected, 'test-password')).rejects.toThrow('已变化');
  expect(await db.get(K.entries)).toEqual([{ id: 'newer' }]);
});
it('excludes device secrets and rejects unrecognized snapshot domains', async () => {
  const { api, db } = await setup();
  await db.set(K.deviceKeypair, 'secret key');
  await db.set(K.license, 'license');
  const snapshot = await api.captureSnapshot();
  expect(snapshot.data[K.deviceKeypair]).toBeUndefined();
  expect(snapshot.data[K.license]).toBeUndefined();
  expect(() =>
    api.validateSnapshot({ ...snapshot, data: { ...snapshot.data, unexpected: [] } }),
  ).toThrow();
});

it('syncs the protected v2 graph without decrypting it and recovers the prior graph after replacement', async () => {
  const { api, db } = await setup();
  const graph = { ontologySchemaVersion: 2, revision: 4, objects: [], edges: [], sessions: [] };
  const protectedGraph = {
    format: 'vector-private-v1',
    ciphertext: await SecurityService.encrypt(JSON.stringify(graph), 'test-password'),
  };
  await db.set(AVATAR_ONTOLOGY_KEY, protectedGraph);
  const before = await api.captureSnapshot();
  expect(before.data[AVATAR_ONTOLOGY_KEY]).toEqual(protectedGraph);
  const sealed = await api.sealSnapshot(before, 'test-password');
  expect(await api.openSnapshot(sealed, 'test-password')).toEqual({
    ...before,
    ontologySchemaVersion: 2,
  });
  const next = structuredClone(before);
  const replacement = {
    format: 'vector-private-v1',
    ciphertext: await SecurityService.encrypt(
      JSON.stringify({ ...graph, revision: 5 }),
      'test-password',
    ),
  };
  next.data[AVATAR_ONTOLOGY_KEY] = replacement;
  await api.applySnapshot(next, 2, await api.fingerprint(before), 'test-password');
  expect(await db.get(AVATAR_ONTOLOGY_KEY)).toEqual(replacement);
  const recovery = await import('./recovery');
  const copies = await recovery.listRecoveryCopies();
  const restored = await api.openSnapshot(
    await recovery.readRecoveryCopy(copies[0]),
    'test-password',
  );
  expect(restored.data[AVATAR_ONTOLOGY_KEY]).toEqual(protectedGraph);
});
it('detects v2 graph edits made after a sync restore preview', async () => {
  const { api, db } = await setup();
  await db.set(AVATAR_ONTOLOGY_KEY, {
    ontologySchemaVersion: 2,
    revision: 1,
    objects: [],
    edges: [],
  });
  const before = await api.captureSnapshot();
  const changed = { ontologySchemaVersion: 2, revision: 2, objects: [], edges: [] };
  await db.set(AVATAR_ONTOLOGY_KEY, changed);
  await expect(
    api.applySnapshot(before, 2, await api.fingerprint(before), 'test-password'),
  ).rejects.toThrow('已变化');
  expect(await db.get(AVATAR_ONTOLOGY_KEY)).toEqual(changed);
});

it('preserves encrypted migration checkpoints and historical archives across account restore', async () => {
  const { api, db, scope } = await setup();
  const { convertAvatarV1Snapshot } = await import('../avatarOntologyMigration');
  const raw = { sessions: null, understandings: null, atoms: '[]', relations: null, tags: null };
  const { encryptVaultBackupFile } = await import('../vaultBackupFile');
  const checkpoint = await encryptVaultBackupFile(
    { version: 1, accountId: scope.currentAccountId(), capturedAt: new Date().toISOString(), raw },
    'test-password',
  );
  const archive = await encryptVaultBackupFile(convertAvatarV1Snapshot(raw), 'test-password');
  await db.set(AVATAR_MIGRATION_SNAPSHOT_KEY, checkpoint);
  await db.set(AVATAR_MIGRATION_RESULT_KEY, archive);
  const source = await api.captureSnapshot();
  expect(source.data[AVATAR_MIGRATION_SNAPSHOT_KEY]).toEqual(checkpoint);
  expect(source.data[AVATAR_MIGRATION_RESULT_KEY]).toEqual(archive);
  expect(JSON.stringify(source)).not.toContain('historical originals');
  expect(JSON.stringify(source)).not.toContain('legacy commitment');
  await db.del(AVATAR_MIGRATION_SNAPSHOT_KEY);
  await db.del(AVATAR_MIGRATION_RESULT_KEY);
  const before = await api.captureSnapshot();
  await api.applySnapshot(source, 3, await api.fingerprint(before), 'test-password');
  expect(await db.get(AVATAR_MIGRATION_SNAPSHOT_KEY)).toEqual(checkpoint);
  expect(await db.get(AVATAR_MIGRATION_RESULT_KEY)).toEqual(archive);
});

it('rejects a missing migration archive before replacing any account data', async () => {
  const { api, db } = await setup();
  const before = await api.captureSnapshot();
  const invalid = structuredClone(before);
  invalid.data[AVATAR_ONTOLOGY_KEY] = {
    ontologySchemaVersion: 2,
    revision: 0,
    objects: [],
    edges: [],
    migrationCheckpointRequired: true,
  };
  invalid.data[K.entries] = [];
  await expect(
    api.applySnapshot(invalid, 2, await api.fingerprint(before), 'test-password'),
  ).rejects.toThrow('缺少');
  expect(await db.get(K.entries)).toEqual(before.data[K.entries]);
  expect(api.readSyncBase().revision).toBe(0);
});

it('blocks restore when the account changes during asynchronous validation', async () => {
  const { api, db, scope } = await setup();
  const before = await api.captureSnapshot();
  const expected = await api.fingerprint(before);
  const next = structuredClone(before);
  next.data[K.entries] = [];
  const otherAccount = crypto.randomUUID();
  const account = vi.spyOn(scope, 'currentAccountId');
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
  const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    const result = await originalDigest(...args);
    account.mockReturnValue(otherAccount);
    return result;
  });
  try {
    await expect(api.applySnapshot(next, 2, expected, 'test-password')).rejects.toThrow();
    expect(api.readSyncBase().revision).toBe(0);
    account.mockRestore();
    expect(await db.get(K.entries)).toEqual(before.data[K.entries]);
  } finally {
    digest.mockRestore();
    account.mockRestore();
  }
});

it('blocks restore after a lock–unlock transition while preparing the recovery copy', async () => {
  const { api, db } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  const before = await api.captureSnapshot();
  const expected = await api.fingerprint(before);
  const next = structuredClone(before);
  next.data[K.entries] = [];
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
  const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    const result = await originalDigest(...args);
    useAppStore.setState({ isUnlocked: false, masterPassword: null });
    useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
    return result;
  });
  try {
    await expect(api.applySnapshot(next, 2, expected, 'test-password')).rejects.toThrow();
    expect(await db.get(K.entries)).toEqual(before.data[K.entries]);
    expect(api.readSyncBase().revision).toBe(0);
    const recovery = await import('./recovery');
    expect(await recovery.listRecoveryCopies()).toHaveLength(0);
  } finally {
    digest.mockRestore();
  }
});

it('migrates old account caches into a protected graph without restoring legacy runtime keys', async () => {
  const { api, db, scope } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  const { AVATAR_V1_KEYS } = await import('../avatarOntologyMigration');
  const before = await api.captureSnapshot();
  const incoming = structuredClone(before);
  incoming.caches[AVATAR_V1_KEYS.atoms] = JSON.stringify([
    { id: 'old-event', kind: 'experience', statement: 'historical original', createdAt: 1000 },
  ]);
  const original = structuredClone(incoming);
  await api.applySnapshot(incoming, 5, await api.fingerprint(before), 'test-password');
  expect(incoming).toEqual(original);
  for (const key of Object.values(AVATAR_V1_KEYS))
    expect(scope.accountLocalStorage.getItem(key)).toBeNull();
  const graph = await db.get<{ format: string; ciphertext: string }>(AVATAR_ONTOLOGY_KEY);
  expect(graph?.format).toBe('vector-private-v1');
  expect(JSON.stringify(graph)).not.toContain('historical original');
  const decoded = JSON.parse(await SecurityService.decrypt(graph!.ciphertext, 'test-password'));
  expect(decoded).toMatchObject({
    ontologySchemaVersion: 2,
    objects: [],
    migrationCheckpointRequired: true,
  });
  const { decodeAvatarMigrationCheckpoint, avatarMigrationCheckpointFrom } =
    await import('../avatarOntologyMigrationCheckpoint');
  const after = await api.captureSnapshot();
  const archive = await decodeAvatarMigrationCheckpoint(
    avatarMigrationCheckpointFrom(after.data),
    'test-password',
    scope.currentAccountId(),
  );
  expect(archive.snapshot.raw.atoms).toBe(incoming.caches[AVATAR_V1_KEYS.atoms]);
  expect(api.readSyncBase()).toEqual({ revision: 5, fingerprint: await api.fingerprint(original) });
});

it.each(['locked', 'wrong-key', 'mixed', 'invalid-session'] as const)(
  'blocks unsafe legacy account import (%s) before any write',
  async (scenario) => {
    const { api, db, scope } = await setup();
    const { useAppStore } = await import('../../stores/appStore');
    useAppStore.setState({
      isUnlocked: scenario !== 'locked',
      masterPassword: scenario === 'locked' ? null : 'test-password',
    });
    const { AVATAR_V1_KEYS } = await import('../avatarOntologyMigration');
    const before = await api.captureSnapshot();
    const incoming = structuredClone(before);
    incoming.caches[AVATAR_V1_KEYS.atoms] = '[]';
    incoming.data[K.entries] = [];
    if (scenario === 'mixed')
      incoming.data[AVATAR_ONTOLOGY_KEY] = {
        ontologySchemaVersion: 2,
        revision: 0,
        objects: [],
        edges: [],
      };
    if (scenario === 'invalid-session')
      incoming.caches[AVATAR_V1_KEYS.sessions] = '[{"id":"broken"}]';
    await expect(
      api.applySnapshot(
        incoming,
        5,
        await api.fingerprint(before),
        'test-password',
        scenario === 'wrong-key' ? 'wrong' : 'test-password',
      ),
    ).rejects.toThrow();
    expect(await db.get(K.entries)).toEqual(before.data[K.entries]);
    expect(await db.get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
    expect(await db.get(AVATAR_MIGRATION_SNAPSHOT_KEY)).toBeUndefined();
    expect(scope.accountLocalStorage.getItem(AVATAR_V1_KEYS.atoms)).toBeNull();
    expect(api.readSyncBase().revision).toBe(0);
  },
);

it('preserves cache edits made while the restore recovery copy is being encrypted', async () => {
  const { api, db, scope } = await setup();
  const before = await api.captureSnapshot();
  const expected = await api.fingerprint(before);
  const incoming = structuredClone(before);
  incoming.data[K.entries] = [];
  const cryptoApi = await import('../vaultBackupFile');
  const encrypt = cryptoApi.encryptVaultBackupFile;
  const spy = vi
    .spyOn(cryptoApi, 'encryptVaultBackupFile')
    .mockImplementationOnce(async (...args) => {
      const result = await encrypt(...args);
      scope.accountLocalStorage.setItem('user_custom_anchors', '["concurrent edit"]');
      return result;
    });
  try {
    await expect(api.applySnapshot(incoming, 2, expected, 'test-password')).rejects.toThrow(
      '已变化',
    );
    expect(await db.get(K.entries)).toEqual(before.data[K.entries]);
    expect(scope.accountLocalStorage.getItem('user_custom_anchors')).toBe('["concurrent edit"]');
    expect(api.readSyncBase().revision).toBe(0);
    const recovery = await import('./recovery');
    expect(await recovery.listRecoveryCopies()).toHaveLength(0);
  } finally {
    spy.mockRestore();
  }
});

it('restores the reviewed input even if its caller mutates it during asynchronous preparation', async () => {
  const { api, db } = await setup();
  const before = await api.captureSnapshot();
  const expected = await api.fingerprint(before);
  const incoming = structuredClone(before);
  incoming.data[K.entries] = [];
  const reviewed = structuredClone(incoming);
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
  const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    const result = await originalDigest(...args);
    incoming.data[K.entries] = [{ id: 'unreviewed mutation' }];
    incoming.caches.user_custom_anchors = '["unreviewed mutation"]';
    return result;
  });
  try {
    await api.applySnapshot(incoming, 2, expected, 'test-password');
    expect(await db.get(K.entries)).toEqual([]);
    expect(api.readSyncBase()).toEqual({
      revision: 2,
      fingerprint: await api.fingerprint(reviewed),
    });
  } finally {
    spy.mockRestore();
  }
});

it.each(['locked', 'wrong-key', 'ready'] as const)(
  'recovers legacy account journals only through protected migration (%s)',
  async (state) => {
    const { api, db, scope } = await setup();
    const { useAppStore } = await import('../../stores/appStore');
    const { AVATAR_V1_KEYS } = await import('../avatarOntologyMigration');
    useAppStore.setState({
      isUnlocked: state !== 'locked',
      masterPassword: state === 'locked' ? null : state === 'wrong-key' ? 'wrong' : 'test-password',
    });
    const raw = JSON.stringify([
      {
        id: 'journal-history',
        kind: 'experience',
        statement: 'preserve original',
        createdAt: 1000,
      },
    ]);
    const job = {
      caches: { [AVATAR_V1_KEYS.atoms]: raw },
      base: { revision: 7, fingerprint: 'original-cloud-fingerprint' },
    };
    await db.set('vector-account-restore-v1', job);
    if (state !== 'ready') {
      await expect(api.recoverSnapshotRestore()).rejects.toThrow();
      expect(await db.get('vector-account-restore-v1')).toEqual(job);
      expect(await db.get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
      expect(api.readSyncBase().revision).toBe(0);
    } else {
      await api.recoverSnapshotRestore();
      expect(await db.get('vector-account-restore-v1')).toBeUndefined();
      const graph = await db.get<{ format: string; ciphertext: string }>(AVATAR_ONTOLOGY_KEY);
      expect(graph?.format).toBe('vector-private-v1');
      expect(JSON.stringify(graph)).not.toContain('preserve original');
      const { decodeAvatarMigrationCheckpoint, avatarMigrationCheckpointFrom } =
        await import('../avatarOntologyMigrationCheckpoint');
      const snapshot = await api.captureSnapshot();
      const checkpoint = await decodeAvatarMigrationCheckpoint(
        avatarMigrationCheckpointFrom(snapshot.data),
        'test-password',
        scope.currentAccountId(),
      );
      expect(checkpoint.snapshot.raw.atoms).toBe(raw);
      expect(api.readSyncBase()).toEqual(job.base);
      await api.recoverSnapshotRestore();
      expect(await api.captureSnapshot()).toEqual(snapshot);
    }
    for (const key of Object.values(AVATAR_V1_KEYS))
      expect(scope.accountLocalStorage.getItem(key)).toBeNull();
  },
);

it.each(['lock-cycle', 'data-edit', 'journal-edit'] as const)(
  'preserves a pending legacy recovery when its preparation becomes stale (%s)',
  async (change) => {
    const { api, db } = await setup();
    const { useAppStore } = await import('../../stores/appStore');
    const { AVATAR_V1_KEYS } = await import('../avatarOntologyMigration');
    useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
    const job = {
      caches: { [AVATAR_V1_KEYS.atoms]: '[]' },
      base: { revision: 9, fingerprint: 'pending' },
    };
    await db.set('vector-account-restore-v1', job);
    const { SecurityService: currentSecurity } = await import('../securityService');
    const verify = currentSecurity.verifyPassword;
    const spy = vi
      .spyOn(currentSecurity, 'verifyPassword')
      .mockImplementationOnce(async (...args) => {
        const result = await verify(...args);
        if (change === 'lock-cycle') {
          useAppStore.setState({ isUnlocked: false, masterPassword: null });
          useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
        } else if (change === 'data-edit') {
          await db.set(K.entries, [{ id: 'concurrent' }]);
        } else {
          await db.set('vector-account-restore-v1', {
            ...job,
            base: { revision: 10, fingerprint: 'newer' },
          });
        }
        return result;
      });
    try {
      await expect(api.recoverSnapshotRestore()).rejects.toThrow();
      expect(await db.get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
      expect(await db.get(AVATAR_MIGRATION_SNAPSHOT_KEY)).toBeUndefined();
      expect(await db.get('vector-account-restore-v1')).toEqual(
        change === 'journal-edit' ? { ...job, base: { revision: 10, fingerprint: 'newer' } } : job,
      );
      expect(await db.get(K.entries)).toEqual(
        change === 'data-edit' ? [{ id: 'concurrent' }] : [{ id: 'a', text: 'private diary' }],
      );
      expect(api.readSyncBase().revision).toBe(0);
    } finally {
      spy.mockRestore();
    }
  },
);

it('exports legacy caches only as encrypted v2 data without changing local fingerprints', async () => {
  const { api, scope } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  const { AVATAR_V1_KEYS } = await import('../avatarOntologyMigration');
  scope.accountLocalStorage.setItem(AVATAR_V1_KEYS.atoms, '[]');
  const before = await api.captureSnapshot();
  const hash = await api.fingerprint(before);
  const opened = await api.openSnapshot(
    await api.sealSnapshot(before, 'test-password'),
    'test-password',
  );
  expect(opened.ontologySchemaVersion).toBe(2);
  expect(opened.caches[AVATAR_V1_KEYS.atoms]).toBeUndefined();
  expect(opened.data[AVATAR_ONTOLOGY_KEY]).toMatchObject({ format: 'vector-private-v1' });
  expect(opened.data[AVATAR_MIGRATION_SNAPSHOT_KEY]).toBeDefined();
  expect(scope.accountLocalStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe('[]');
  expect(await api.fingerprint(await api.captureSnapshot())).toBe(hash);
  expect(await api.fingerprint(before)).toBe(hash);
});

it('refuses legacy export while locked even with a supplied password', async () => {
  const { api, scope } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  const { AVATAR_V1_KEYS } = await import('../avatarOntologyMigration');
  scope.accountLocalStorage.setItem(AVATAR_V1_KEYS.atoms, '[]');
  await expect(api.sealSnapshot(await api.captureSnapshot(), 'test-password')).rejects.toThrow();
  expect(scope.accountLocalStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe('[]');
});

it('discards an export when the vault locks and unlocks during encryption', async () => {
  const { api } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  const cryptoApi = await import('../vaultBackupFile');
  const original = cryptoApi.encryptVaultBackupFile;
  const spy = vi.spyOn(cryptoApi, 'encryptVaultBackupFile').mockImplementation(async (...args) => {
    const encrypted = await original(...args);
    useAppStore.setState({ isUnlocked: false, masterPassword: null });
    useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
    return encrypted;
  });
  try {
    await expect(api.sealSnapshot(await api.captureSnapshot(), 'test-password')).rejects.toThrow();
  } finally {
    spy.mockRestore();
  }
});

it('rejects capture when the account logs out during the IndexedDB read', async () => {
  const { api } = await setup();
  const { logoutAccount } = await import('./auth');
  const pending = api.captureSnapshot();
  await logoutAccount();
  await expect(pending).rejects.toThrow();
});

it('rejects capture after a lock-unlock cycle during the IndexedDB read', async () => {
  const { api } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  const pending = api.captureSnapshot();
  useAppStore.setState({ isUnlocked: false });
  useAppStore.setState({ isUnlocked: true });
  await expect(pending).rejects.toThrow();
});

it('discards decrypted cloud data after a lock-unlock cycle', async () => {
  const { api } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  const sealed = await api.sealSnapshot(await api.captureSnapshot(), 'test-password');
  const pending = api.openSnapshot(sealed, 'test-password');
  useAppStore.setState({ isUnlocked: false });
  useAppStore.setState({ isUnlocked: true });
  await expect(pending).rejects.toThrow();
});

it.each(['locked', 'wrong-key', 'invalid-graph', 'ready'] as const)(
  'validates v2 recovery journals before publishing caches (%s)',
  async (state) => {
    const { api, db, scope } = await setup();
    const { useAppStore } = await import('../../stores/appStore');
    useAppStore.setState({
      isUnlocked: state !== 'locked',
      masterPassword: state === 'locked' ? null : state === 'wrong-key' ? 'wrong' : 'test-password',
    });
    const graph = {
      ontologySchemaVersion: 2,
      revision: state === 'invalid-graph' ? -1 : 0,
      objects: [],
      edges: [],
    };
    await db.set(AVATAR_ONTOLOGY_KEY, graph);
    const job = {
      caches: { user_custom_anchors: '["restored"]' },
      base: { revision: 11, fingerprint: 'v2-journal' },
    };
    scope.accountLocalStorage.setItem('user_custom_anchors', '["original"]');
    await db.set('vector-account-restore-v1', job);
    if (state === 'ready') {
      await api.recoverSnapshotRestore();
      expect(await db.get('vector-account-restore-v1')).toBeUndefined();
      expect(scope.accountLocalStorage.getItem('user_custom_anchors')).toBe('["restored"]');
      expect(api.readSyncBase()).toEqual(job.base);
    } else {
      await expect(api.recoverSnapshotRestore()).rejects.toThrow();
      expect(await db.get('vector-account-restore-v1')).toEqual(job);
      expect(scope.accountLocalStorage.getItem('user_custom_anchors')).toBe('["original"]');
      expect(api.readSyncBase().revision).toBe(0);
    }
    expect(await db.get(AVATAR_ONTOLOGY_KEY)).toEqual(graph);
  },
);

it('keeps a v2 recovery journal when its required encrypted checkpoint is absent', async () => {
  const { api, db } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'test-password' });
  await db.set(AVATAR_ONTOLOGY_KEY, {
    ontologySchemaVersion: 2,
    revision: 0,
    objects: [],
    edges: [],
    migrationCheckpointRequired: true,
  });
  const job = { caches: {}, base: { revision: 12, fingerprint: 'missing-checkpoint' } };
  await db.set('vector-account-restore-v1', job);
  await expect(api.recoverSnapshotRestore()).rejects.toThrow();
  expect(await db.get('vector-account-restore-v1')).toEqual(job);
  expect(api.readSyncBase().revision).toBe(0);
});

it('resumes a locked pending journal with an explicitly verified password without unlocking the app', async () => {
  const { api, db } = await setup();
  const { useAppStore } = await import('../../stores/appStore');
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await db.set(AVATAR_ONTOLOGY_KEY, {
    ontologySchemaVersion: 2,
    revision: 0,
    objects: [],
    edges: [],
  });
  const job = { caches: {}, base: { revision: 13, fingerprint: 'explicit-recovery' } };
  await db.set('vector-account-restore-v1', job);
  await expect(api.recoverSnapshotRestore('wrong')).rejects.toThrow();
  expect(await db.get('vector-account-restore-v1')).toEqual(job);
  await api.recoverSnapshotRestore('test-password');
  expect(await db.get('vector-account-restore-v1')).toBeUndefined();
  expect(api.readSyncBase()).toEqual(job.base);
  expect(useAppStore.getState().isUnlocked).toBe(false);
  expect(useAppStore.getState().masterPassword).toBeNull();
});
