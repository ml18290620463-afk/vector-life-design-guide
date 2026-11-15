import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ open: vi.fn(), set: vi.fn(), valid: vi.fn() }));
vi.mock('./snapshot', () => ({ openSnapshot: mocks.open }));
vi.mock('../accountIdb', () => ({ set: mocks.set }));
vi.mock('../vaultBackupFile', () => ({ isEncryptedVaultBackup: mocks.valid }));
import { importRecoveryCopy } from './recovery';
const file = (text = '{"encrypted":true}', size = text.length) => ({ size, text: async () => text });
beforeEach(() => { vi.clearAllMocks(); mocks.valid.mockReturnValue(true); mocks.open.mockResolvedValue({}); mocks.set.mockResolvedValue(undefined); });
it('validates password and owner before writing an imported encrypted copy', async () => {
  const key = await importRecoveryCopy(file(), 'original-password');
  expect(mocks.open).toHaveBeenCalledWith({ encrypted: true }, 'original-password');
  expect(mocks.set).toHaveBeenCalledWith(key, { encrypted: true });
  expect(mocks.open.mock.invocationCallOrder[0]).toBeLessThan(mocks.set.mock.invocationCallOrder[0]);
});
it.each(['wrong password', 'snapshot belongs to another account'])('does not retain a rejected file: %s', async reason => {
  mocks.open.mockRejectedValueOnce(new Error(reason));
  await expect(importRecoveryCopy(file(), 'pw')).rejects.toThrow(reason);
  expect(mocks.set).not.toHaveBeenCalled();
});
it('rejects oversized files before reading them', async () => {
  const text = vi.fn();
  await expect(importRecoveryCopy({ size: 20_000_001, text }, 'pw')).rejects.toThrow('20 MB');
  expect(text).not.toHaveBeenCalled();
});
it('rejects plaintext and malformed files without modifying the account', async () => {
  await expect(importRecoveryCopy(file('bad json'), 'pw')).rejects.toThrow('JSON');
  mocks.valid.mockReturnValue(false);
  await expect(importRecoveryCopy(file(), 'pw')).rejects.toThrow('加密账号恢复副本');
  expect(mocks.set).not.toHaveBeenCalled();
});
