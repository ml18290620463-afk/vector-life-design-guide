import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  fingerprint: vi.fn(),
  base: vi.fn(),
  save: vi.fn(),
  seal: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  erase: vi.fn(),
  state: { isUnlocked: true, masterPassword: 'pw' },
  generation: 0,
  listeners: new Set<
    (
      next: { isUnlocked: boolean; masterPassword: string },
      previous: { isUnlocked: boolean; masterPassword: string },
    ) => void
  >(),
}));
vi.mock('./snapshot', () => ({
  captureSnapshot: mocks.capture,
  fingerprint: mocks.fingerprint,
  readSyncBase: mocks.base,
  saveSyncBase: mocks.save,
  sealSnapshot: mocks.seal,
  hasVault: () => true,
}));
vi.mock('./cloud', () => ({
  eraseCloudRevision: mocks.erase,
  readCloudRevision: mocks.read,
  writeCloudRevision: mocks.write,
  SyncConflictError: class extends Error {
    constructor(public revision?: number) {
      super('conflict');
    }
  },
}));
vi.mock('./auth', () => ({ accountSessionGeneration: () => mocks.generation }));
vi.mock('../../stores/appStore', () => ({
  useAppStore: {
    getState: () => mocks.state,
    subscribe: (listener: (next: typeof mocks.state, previous: typeof mocks.state) => void) => {
      mocks.listeners.add(listener);
      return () => mocks.listeners.delete(listener);
    },
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.state = { isUnlocked: true, masterPassword: 'pw' };
  mocks.generation = 0;
  mocks.capture.mockResolvedValue({ content: 'local' });
  mocks.fingerprint.mockResolvedValue('local-hash');
  mocks.base.mockReturnValue({ revision: 1, fingerprint: 'old-hash' });
  mocks.read.mockResolvedValue({ revision: 1 });
  mocks.seal.mockResolvedValue({ encrypted: true });
  mocks.write.mockResolvedValue(2);
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
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('reports remote changes when local is clean without writing either version', async () => {
  mocks.base.mockReturnValue({ revision: 1, fingerprint: 'local-hash' });
  mocks.read.mockResolvedValue({ revision: 2 });
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
  mocks.seal.mockImplementation(async () => {
    mocks.state.isUnlocked = false;
    return {};
  });
  const sync = await import('./sync');
  await expect(sync.synchronizeAccount('pw')).rejects.toThrow('已锁定');
  expect(mocks.write).not.toHaveBeenCalled();
});
it('does not mark an in-flight upload clean after logout', async () => {
  mocks.write.mockImplementation(async () => {
    mocks.generation++;
    return 2;
  });
  const sync = await import('./sync');
  await expect(sync.synchronizeAccount('pw')).rejects.toThrow();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('conflict resolution uses the user-observed revision instead of silently replacing a newer remote', async () => {
  mocks.write.mockRejectedValue(new Error('conflict'));
  const sync = await import('./sync');
  await expect(sync.publishLocalConflict('pw', 2)).rejects.toThrow('conflict');
  expect(mocks.write).toHaveBeenCalledWith(2, { encrypted: true });
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('coalesces overlapping synchronization requests', async () => {
  const sync = await import('./sync');
  await Promise.all([sync.synchronizeAccount('pw'), sync.synchronizeAccount('pw')]);
  expect(mocks.write).toHaveBeenCalledTimes(1);
});

it('does not upload a restored snapshot until the user resumes sync', async () => {
  const { pauseSync } = await import('./syncPause');
  pauseSync();
  const sync = await import('./sync');
  expect(await sync.synchronizeAccount('pw')).toBe('paused');
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
it('cloud deletion pauses further uploads even when deletion fails', async () => {
  mocks.erase.mockRejectedValueOnce(new Error('offline'));
  const sync = await import('./sync');
  await expect(sync.eraseAccountCloud()).rejects.toThrow('offline');
  expect(await sync.synchronizeAccount('pw')).toBe('paused');
  expect(mocks.erase).toHaveBeenCalledWith(1);
  expect(mocks.write).not.toHaveBeenCalled();
});

it('stops an in-flight encrypted upload before cloud erasure', async () => {
  let finish!: (value: object) => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  mocks.seal.mockImplementation(() => {
    entered();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  mocks.erase.mockResolvedValue(undefined);
  const sync = await import('./sync');
  const upload = sync.synchronizeAccount('pw');
  const rejected = expect(upload).rejects.toThrow('同步已暂停');
  await waiting;
  const deletion = sync.eraseAccountCloud();
  finish({ encrypted: true });
  await rejected;
  await deletion;
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.erase).toHaveBeenCalledWith(1);
});

it('cancels cloud erasure when the account changes while waiting for sync', async () => {
  let finish!: (value: object) => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  mocks.seal.mockImplementation(() => {
    entered();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const sync = await import('./sync');
  const upload = sync.synchronizeAccount('pw');
  const rejectedUpload = expect(upload).rejects.toThrow();
  await waiting;
  const deletion = sync.eraseAccountCloud();
  const rejectedDeletion = expect(deletion).rejects.toThrow('账号已变化');
  mocks.generation++;
  finish({ encrypted: true });
  await rejectedUpload;
  await rejectedDeletion;
  expect(mocks.erase).not.toHaveBeenCalled();
});

for (const conflict of [false, true]) {
  it(`rejects a lock-unlock cycle during encryption (${conflict ? 'conflict' : 'normal'} upload)`, async () => {
    mocks.seal.mockImplementation(async () => {
      const initial = { ...mocks.state };
      const locked = { ...initial, isUnlocked: false };
      mocks.state = locked;
      mocks.listeners.forEach((listener) => listener(locked, initial));
      mocks.state = initial;
      mocks.listeners.forEach((listener) => listener(initial, locked));
      return { encrypted: true };
    });
    const sync = await import('./sync');
    const initialListeners = mocks.listeners.size;
    await expect(
      conflict ? sync.publishLocalConflict('pw', 1) : sync.synchronizeAccount('pw'),
    ).rejects.toThrow();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.listeners.size).toBe(initialListeners);
  });
}
