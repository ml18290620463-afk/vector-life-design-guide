import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ capture: vi.fn(), fingerprint: vi.fn(), base: vi.fn(), save: vi.fn(), seal: vi.fn(), read: vi.fn(), write: vi.fn(), state: { isUnlocked: true, masterPassword: 'pw' }, generation: 0 }));
vi.mock('./snapshot', () => ({ captureSnapshot: mocks.capture, fingerprint: mocks.fingerprint, readSyncBase: mocks.base, saveSyncBase: mocks.save, sealSnapshot: mocks.seal, hasVault: () => true }));
vi.mock('./cloud', () => ({ readCloudRevision: mocks.read, writeCloudRevision: mocks.write, SyncConflictError: class extends Error { constructor(public revision?: number) { super('conflict'); } } }));
vi.mock('./auth', () => ({ accountSessionGeneration: () => mocks.generation }));
vi.mock('../../stores/appStore', () => ({ useAppStore: { getState: () => mocks.state } }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.state = { isUnlocked: true, masterPassword: 'pw' }; mocks.generation = 0;
  mocks.capture.mockResolvedValue({ content: 'local' }); mocks.fingerprint.mockResolvedValue('local-hash');
  mocks.base.mockReturnValue({ revision: 1, fingerprint: 'old-hash' });
  mocks.read.mockResolvedValue({ revision: 1 }); mocks.seal.mockResolvedValue({ encrypted: true }); mocks.write.mockResolvedValue(2);
});
it('uploads only against the observed revision and marks only that snapshot clean', async () => {
  const sync = await import('./sync');
  expect(await sync.synchronizeAccount('pw')).toBe('uploaded');
  expect(mocks.write).toHaveBeenCalledWith(1, { encrypted: true });
  expect(mocks.save).toHaveBeenCalledWith({ revision: 2, fingerprint: 'local-hash' });
});
it('never uploads while locked', async () => {
  const sync = await import('./sync');
  expect(await sync.synchronizeAccount(null)).toBe('locked');
  expect(mocks.capture).not.toHaveBeenCalled();
});
it('preserves both versions when both devices changed', async () => {
  mocks.read.mockResolvedValue({ revision: 2 });
  const sync = await import('./sync');
  await expect(sync.synchronizeAccount('pw')).rejects.toMatchObject({ revision: 2 });
  expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
it('reports remote changes when local is clean without writing either version', async () => {
  mocks.base.mockReturnValue({ revision: 1, fingerprint: 'local-hash' }); mocks.read.mockResolvedValue({ revision: 2 });
  const sync = await import('./sync');
  expect(await sync.synchronizeAccount('pw')).toBe('remote');
  expect(mocks.write).not.toHaveBeenCalled();
});
it('does not mark a network failure clean', async () => {
  mocks.write.mockRejectedValue(new TypeError('offline'));
  const sync = await import('./sync');
  await expect(sync.synchronizeAccount('pw')).rejects.toThrow('offline');
  expect(mocks.save).not.toHaveBeenCalled();
});
it('does not upload after the user locks or changes their password during encryption', async () => {
  mocks.seal.mockImplementation(async () => { mocks.state.isUnlocked = false; return {}; });
  const sync = await import('./sync');
  await expect(sync.synchronizeAccount('pw')).rejects.toThrow('已锁定');
  expect(mocks.write).not.toHaveBeenCalled();
});
it('does not mark an in-flight upload clean after logout', async () => {
  mocks.write.mockImplementation(async () => { mocks.generation++; return 2; });
  const sync = await import('./sync');
  await expect(sync.synchronizeAccount('pw')).rejects.toThrow();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('conflict resolution uses the user-observed revision instead of silently replacing a newer remote', async () => {
  mocks.write.mockRejectedValue(new Error('conflict'));
  const sync = await import('./sync');
  await expect(sync.publishLocalConflict('pw', 2)).rejects.toThrow('conflict');
  expect(mocks.write).toHaveBeenCalledWith(2, { encrypted: true });
  expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
it('coalesces overlapping synchronization requests', async () => {
  const sync = await import('./sync');
  await Promise.all([sync.synchronizeAccount('pw'), sync.synchronizeAccount('pw')]);
  expect(mocks.write).toHaveBeenCalledTimes(1);
});
