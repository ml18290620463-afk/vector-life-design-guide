import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import {
  getMaterialsStorageKey,
  getSelectedStarsStorageKey,
  DiaryStorageKeys as K,
} from './diaryStorage';
import { useAppStore } from '../stores/appStore';
import { SecurityService } from './securityService';
import { changeFutureProtection, BACKUP_RESTORE_JOB } from './vaultTransaction';
import {
  exportVaultBackup,
  exportVaultBackupFile,
  importVaultBackup,
  recoverBackupRestore,
  type VaultBackup,
} from './vaultBackup';
import { decryptVaultBackupFile, isEncryptedVaultBackup } from './vaultBackupFile';
import { saveNowDraft, loadNowDraft } from './nowDraftRepository';
import { createEmptyDraft } from '../features/now/state/nowRules';
import {
  saveGoal,
  saveFutureAction,
  readFutureSnapshot,
  saveVision,
  recordOutcome,
  recordActionPractice,
  setGoalStatus,
  saveArchiveDirection,
} from './futureRepository';

const password = '备份原密码-123';
const cache = 'vector:avatar:atomic-memories:v1';
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
afterEach(() => vi.restoreAllMocks());
async function protect(pwd = password) {
  const salt = 'backup-test-salt';
  await changeFutureProtection(pwd, await SecurityService.hashPassword(pwd, salt), salt);
  useAppStore.setState({ masterPassword: pwd, isUnlocked: true });
}
async function fixture() {
  await set(K.entries, [
    { id: 'e1', title: '记录', content: '私人经历', tags: [], createdAt: 1, isLocked: false },
  ]);
  await saveNowDraft({ ...createEmptyDraft(), text: '私人草稿' }, 0);
  const goal = await saveGoal({
    title: '改善沟通',
    status: 'active',
    measurement: { kind: 'narrative' },
    tags: [],
  });
  await saveFutureAction({ title: '先确认范围', status: 'pending', goalId: goal.id });
  localStorage.setItem(
    cache,
    JSON.stringify([{ id: 'memory', statement: '私人理解', status: 'confirmed' }]),
  );
  await protect();
  const entries = await get(K.entries);
  await set(
    K.entries,
    await Promise.all(
      entries.map(async (e: { content: string }) => ({
        ...e,
        content: await SecurityService.encrypt(e.content, password),
        isEncrypted: true,
      })),
    ),
  );
  const file = await exportVaultBackupFile('test');
  if (!isEncryptedVaultBackup(file)) throw new Error('Expected encrypted file');
  return file;
}
it('restores all protected domains in an empty browser storage and repeated merge is idempotent', async () => {
  const file = await fixture();
  expect(JSON.stringify(file)).not.toMatch(/私人|entryCount|passwordHash/);
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await importVaultBackup(backup, 'merge', undefined, password);
  await importVaultBackup(backup, 'merge', undefined, password);
  expect(await get(K.entries)).toHaveLength(1);
  expect((await get(K.entries))[0].isEncrypted).toBe(true);
  expect(await SecurityService.decrypt((await get(K.entries))[0].content, password)).toBe(
    '私人经历',
  );
  expect((await loadNowDraft()).draft?.text).toBe('私人草稿');
  expect((await readFutureSnapshot()).state.goals).toHaveLength(1);
  expect((await readFutureSnapshot()).actions).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(cache)!)).toHaveLength(1);
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
  useAppStore.setState({ masterPassword: null, isUnlocked: false });
  await expect(loadNowDraft()).rejects.toThrow('解锁');
}, 30_000);
it('preserves a protected destination password while importing a differently encrypted file', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await protect('本机密码-456');
  const hash = await get(K.passwordHash);
  await importVaultBackup(backup, 'merge', undefined, password);
  expect(await get(K.passwordHash)).toBe(hash);
  expect(await SecurityService.decrypt((await get(K.entries))[0].content, '本机密码-456')).toBe(
    '私人经历',
  );
}, 30_000);
it('rejects wrong passwords, damaged ciphertext, authenticated header changes and unsupported versions without writes', async () => {
  const file = await fixture();
  const before = await get(K.entries);
  await expect(decryptVaultBackupFile(file, 'wrong')).rejects.toThrow('未导入');
  await expect(decryptVaultBackupFile({ ...file, ciphertext: 'AAAA' }, password)).rejects.toThrow(
    '未导入',
  );
  await expect(
    decryptVaultBackupFile({ ...file, salt: btoa('1234567890123456') }, password),
  ).rejects.toThrow('未导入');
  await expect(
    decryptVaultBackupFile({ ...file, schemaVersion: 2 } as never, password),
  ).rejects.toThrow('不支持');
  expect(await get(K.entries)).toEqual(before);
}, 30_000);
it('rejects conflicting entry content atomically before replacing any destination domain', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  backup.entries[0].content = '冲突内容';
  backup.vault.data.entries = backup.entries;
  const before = await get(K.entries),
    future = await get(K.future);
  await expect(importVaultBackup(backup, 'merge', undefined, password)).rejects.toThrow('编号冲突');
  expect(await get(K.entries)).toEqual(before);
  expect(await get(K.future)).toEqual(future);
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
}, 30_000);
it('keeps an encrypted recovery job after local cache failure and retries only after unlock', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  const original = localStorage.setItem.bind(localStorage);
  let failCache = true;
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === cache && failCache) throw new Error('disk full');
    return original(key, value);
  });
  await expect(importVaultBackup(backup, 'replace', undefined, password)).rejects.toThrow(
    '数据已导入',
  );
  const job = await get(BACKUP_RESTORE_JOB);
  expect(job.format).toBe('vector-private-v1');
  expect(JSON.stringify(job)).not.toContain('私人理解');
  failCache = false;
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await recoverBackupRestore();
  expect(await get(BACKUP_RESTORE_JOB)).toEqual(job);
  useAppStore.setState({ isUnlocked: true, masterPassword: password });
  await recoverBackupRestore();
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
  expect(JSON.parse(localStorage.getItem(cache)!)[0].statement).toBe('私人理解');
}, 30_000);
it('boots a locked vault with no recovery job and blocks legacy plaintext export', async () => {
  await protect();
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  await expect(recoverBackupRestore()).resolves.toBeUndefined();
  await expect(exportVaultBackup('test')).rejects.toThrow('解锁');
});

it('round-trips every backup domain, embedded media and complete linked future history', async () => {
  await fixture();
  const uid = 'roundtrip-user';
  const entries = await get(K.entries);
  entries[0].attachment = {
    type: 'image',
    data: 'data:image/png;base64,aGVsbG8=',
    name: '证据.png',
    mimeType: 'image/png',
  };
  entries[0].nowMaterials = [
    { id: 'media-1', type: 'image', url: 'data:image/png;base64,aGVsbG8=', sort_order: 0 },
  ];
  await set(K.entries, entries);
  await set(K.principles, [{ id: 'p1', text: '先核对', derivedFromEntryIds: ['e1'] }]);
  await set(K.patternPrincipleLinks, [{ id: 'link1', principleId: 'p1', patternId: 'memory' }]);
  await set(K.guidingStars, ['诚实']);
  await set(K.containers, [{ id: 'container1', title: '沟通', entryIds: ['e1'] }]);
  await set(getMaterialsStorageKey(uid), [
    { id: 'material1', entryId: 'e1', data: 'data:audio/wav;base64,aGVsbG8=' },
  ]);
  await set(getSelectedStarsStorageKey(uid), ['诚实']);
  for (const [key, rows] of Object.entries({
    'vector:avatar:memory-relations:v1': [{ id: 'relation1', sourceId: 'memory', targetId: 'e1' }],
    'vector:avatar:memory-tags:v1': [{ name: '沟通' }],
    'vector:avatar:understandings:v1': [{ id: 'understanding1', sourceEntryIds: ['e1'] }],
    'vector:avatar:sessions:v1': [
      { id: 'session1', messages: [{ role: 'user', content: '如何确认范围？' }] },
    ],
    user_custom_anchors: ['耐心'],
  }))
    localStorage.setItem(key, JSON.stringify(rows));
  const vision = await saveVision({ text: '持续探索', status: 'active' });
  const goal = await saveGoal({
    title: '探索一次',
    visionId: vision.id,
    status: 'active',
    tags: [],
    measurement: { kind: 'quantity', target: 1, unit: '次', precision: 0, distinctItems: true },
  });
  const revised = await saveGoal({ ...goal, title: '完成一次探索' });
  const action = await saveFutureAction({ title: '整理路线', status: 'pending', goalId: goal.id });
  await recordActionPractice({
    actionId: action.id,
    expectedActionRevision: action.revision!,
    status: 'completed',
    note: '路线已整理',
    nextStep: 'end',
    occurredOn: '2026-10-09',
  });
  await set(K.entries, [{ ...entries[0], content: '私人经历', isEncrypted: false }]);
  await recordOutcome({
    goalId: goal.id,
    expectedRevision: revised.revision,
    operationId: 'outcome1',
    itemLabel: '公园',
    occurredOn: '2026-10-09',
    value: { kind: 'quantity', amount: 1 },
    sourceEntryId: 'e1',
  });
  await set(K.entries, entries);
  await setGoalStatus(goal.id, 'completed', revised.revision);
  await saveArchiveDirection({
    proposalId: 'proposal1',
    kind: 'action',
    text: '再次核对',
    tags: [],
    sourceRefs: [{ source: 'entry', id: 'e1' }],
  });
  const file = await exportVaultBackupFile('test', uid);
  const before = (await decryptVaultBackupFile(
    file as Parameters<typeof decryptVaultBackupFile>[0],
    password,
  )) as VaultBackup;
  for (const key of [
    'visions',
    'goals',
    'items',
    'events',
    'revisions',
    'closures',
    'receipts',
    'practiceRecords',
  ] as const)
    expect(before.vault.future[key]?.length, key).toBeGreaterThan(0);
  expect(Object.keys(before.vault.future.archiveOrigins!)).toHaveLength(1);
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await protect('destination-password');
  await set(K.semanticEmbeddings, [{ id: 'stale' }]);
  await importVaultBackup(before, 'merge', uid, password);
  await importVaultBackup(before, 'merge', uid, password);
  const afterFile = await exportVaultBackupFile('test', uid);
  const after = (await decryptVaultBackupFile(
    afterFile as Parameters<typeof decryptVaultBackupFile>[0],
    'destination-password',
  )) as VaultBackup;
  expect(after.vault.data).toEqual(before.vault.data);
  expect(after.vault.caches).toEqual(before.vault.caches);
  expect(after.vault.draft).toEqual(before.vault.draft);
  expect({ ...after.vault.future, revision: 0 }).toEqual({ ...before.vault.future, revision: 0 });
  expect(await get(K.semanticEmbeddings)).toBeUndefined();
  expect((await get(K.entries))[0].content).not.toContain('私人经历');
}, 30_000);
it('rejects conflicting drafts without writes, and explicit replacement removes destination-only records', async () => {
  const file = await fixture();
  const backup = (await decryptVaultBackupFile(file, password)) as VaultBackup;
  const draft = await loadNowDraft();
  await saveNowDraft({ ...draft.draft!, text: '本机另一份草稿' }, draft.revision);
  const before = await get(K.entries);
  await expect(importVaultBackup(backup, 'merge', undefined, password)).rejects.toThrow('草稿');
  expect(await get(K.entries)).toEqual(before);
  expect((await loadNowDraft()).draft?.text).toBe('本机另一份草稿');
  await saveFutureAction({ title: '仅在本机', status: 'pending' });
  await importVaultBackup(backup, 'replace', undefined, password);
  expect((await loadNowDraft()).draft?.text).toBe('私人草稿');
  expect((await readFutureSnapshot()).actions.map((a) => a.title)).toEqual(['先确认范围']);
}, 30_000);
