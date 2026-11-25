import { describe, expect, it, vi } from 'vitest';
import { readFreshAvatarSnapshot } from './avatarOntologyTransaction';
import { VaultConflictError } from './vaultTransaction';

describe('fresh read snapshots', () => {
  it('discards a conflicted snapshot and returns a freshly validated read', async () => {
    const read = vi.fn().mockRejectedValueOnce(new VaultConflictError()).mockResolvedValue('fresh');
    const guard = vi.fn();
    await expect(readFreshAvatarSnapshot(read, guard)).resolves.toBe('fresh');
    expect(read).toHaveBeenCalledTimes(2);
    expect(guard).toHaveBeenCalledTimes(4);
  });
  it('does not retry validation or permission errors', async () => {
    const read = vi.fn().mockRejectedValue(new Error('invalid checkpoint'));
    await expect(readFreshAvatarSnapshot(read, () => {})).rejects.toThrow('invalid checkpoint');
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('retains the original session guard across conflicts', async () => {
    let changed = false;
    const read = vi.fn(async () => {
      changed = true;
      throw new VaultConflictError();
    });
    await expect(
      readFreshAvatarSnapshot(read, () => {
        if (changed) throw new Error('session changed');
      }),
    ).rejects.toThrow('session changed');
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('rejects a successful read if the session changed while reading', async () => {
    let changed = false;
    await expect(
      readFreshAvatarSnapshot(
        async () => {
          changed = true;
          return 'private';
        },
        () => {
          if (changed) throw new Error('session changed');
        },
      ),
    ).rejects.toThrow('session changed');
  });
  it('bounds repeated conflicts to five attempts', async () => {
    const read = vi.fn().mockRejectedValue(new VaultConflictError());
    await expect(readFreshAvatarSnapshot(read, () => {})).rejects.toBeInstanceOf(
      VaultConflictError,
    );
    expect(read).toHaveBeenCalledTimes(5);
  });
});
