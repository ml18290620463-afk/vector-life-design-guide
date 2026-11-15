import { isSyncPaused, pauseSync } from './syncPause';
import { useAppStore } from '../../stores/appStore';
import { accountSessionGeneration } from './auth';
import { captureSnapshot, fingerprint, readSyncBase, saveSyncBase, sealSnapshot, hasVault } from './snapshot';
import { readCloudRevision, writeCloudRevision, eraseCloudRevision, SyncConflictError } from './cloud';
export type SyncResult = 'paused' | 'locked' | 'current' | 'uploaded' | 'remote';
let running: Promise<SyncResult> | null = null;
export function synchronizeAccount(password: string | null): Promise<SyncResult> {
  if (isSyncPaused()) return Promise.resolve('paused');
  if (!password) return Promise.resolve('locked');
  running ??= synchronize(password).finally(() => { running = null; });
  return running;
}
async function synchronize(password: string): Promise<SyncResult> {
  const generation = accountSessionGeneration();
  const local = await captureSnapshot();
  if (!hasVault(local)) return 'locked';
  const hash = await fingerprint(local);
  const base = readSyncBase();
  const remote = await readCloudRevision();
  if ((remote?.revision ?? 0) !== base.revision) {
    if (base.fingerprint === hash) return 'remote';
    throw new SyncConflictError(remote?.revision ?? 0);
  }
  if (hash === base.fingerprint) return 'current';
  const encrypted = await sealSnapshot(local, password);
  assertSession(password, generation);
  const revision = await writeCloudRevision(base.revision, encrypted);
  assertSession(password, generation);
  // Mark only the uploaded snapshot clean; edits made during the request remain dirty.
  saveSyncBase({ revision, fingerprint: hash });
  return 'uploaded';
}
function assertSession(password: string, generation: number) {
  const state = useAppStore.getState();
  if (isSyncPaused()) throw new Error('同步已暂停，本机资料保留');
  if (generation !== accountSessionGeneration() || !state.isUnlocked || state.masterPassword !== password) throw new Error('资料库已锁定或密码已变化，请解锁后重新同步');
}
export async function publishLocalConflict(password: string, expectedRevision: number) {
  if (running) throw new Error('正在检查同步，请稍后重试');
  running = (async (): Promise<SyncResult> => {
    const generation = accountSessionGeneration();
    const local = await captureSnapshot();
    const payload = await sealSnapshot(local, password);
    assertSession(password, generation);
    const revision = await writeCloudRevision(expectedRevision, payload);
    assertSession(password, generation);
    saveSyncBase({ revision, fingerprint: await fingerprint(local) });
    return 'uploaded';
  })().finally(() => { running = null; });
  await running;
}

/** Pause before waiting for in-flight work. Server serializes writes and deletion,
 * and keeps a tombstone that also rejects uploads from older/offline devices. */
export async function eraseAccountCloud(): Promise<void> {
  const generation = accountSessionGeneration();
  pauseSync();
  if (running) await running.catch(() => undefined);
  if (generation !== accountSessionGeneration()) throw new Error('账号已变化，已取消云端删除，请重新确认');
  await eraseCloudRevision(readSyncBase().revision);
}
