import React, { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({
  baseRevision: 0,
  resume: vi.fn(), scope: vi.fn(), lock: vi.fn(), cloud: vi.fn(),
  open: vi.fn(), apply: vi.fn(), send: vi.fn(), verify: vi.fn(),
}));
vi.mock('../services/account/auth', () => ({
  accountsEnabled: true, accountsRequired: true,
  resumeAccount: mocks.resume, sendEmailCode: mocks.send, verifyEmailCode: mocks.verify,
  clearSavedSession: vi.fn(), logoutAccount: vi.fn(),
}));
vi.mock('../services/accountScope', () => ({ initializeAccountScope: mocks.scope, accountLocalStorage: { getItem: () => null, removeItem: vi.fn() } }));
vi.mock('../services/account/tabLock', () => ({ holdAccountTab: mocks.lock }));
vi.mock('../services/account/cloud', () => ({ readCloudRevision: mocks.cloud }));
vi.mock('../services/account/snapshot', () => ({
  recoverSnapshotRestore: vi.fn(), captureSnapshot: async () => ({}), fingerprint: async () => 'local',
  hasVault: () => false, readSyncBase: () => ({ revision: mocks.baseRevision, fingerprint: '' }),
  openSnapshot: mocks.open, applySnapshot: mocks.apply, saveSyncBase: vi.fn(),
}));
vi.mock('../services/account/recovery', () => ({ RECOVERY_SELECTION: 'recovery', readRecoveryCopy: vi.fn() }));
vi.mock('../App', () => ({ default: () => <div>PRIVATE_DIARY_APP</div> }));
vi.mock('./AccountSyncStatus', () => ({ AccountSyncStatus: () => null }));
afterEach(cleanup);
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.baseRevision = 0; mocks.resume.mockResolvedValue(null); mocks.lock.mockResolvedValue(undefined); mocks.cloud.mockResolvedValue(null); });
it('does not mount the diary before email verification and account scope preparation', async () => {
  const { AccountBoundary } = await import('./AccountBoundary');
  mocks.verify.mockResolvedValue({ user: { id: 'alice', email: 'alice@example.com' } });
  render(<StrictMode><AccountBoundary /></StrictMode>);
  await waitFor(() => expect((screen.getByRole('button', { name: '发送登录邮件' }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByText('PRIVATE_DIARY_APP')).toBeNull();
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'alice@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: '发送登录邮件' }));
  await screen.findByLabelText('邮箱验证码');
  expect(screen.queryByText('PRIVATE_DIARY_APP')).toBeNull();
  fireEvent.change(screen.getByLabelText('邮箱验证码'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并登录' }));
  await screen.findByText('PRIVATE_DIARY_APP');
  expect(mocks.scope).toHaveBeenCalledWith('alice');
  expect(mocks.lock).toHaveBeenCalledTimes(1);
  expect(mocks.resume).toHaveBeenCalledTimes(1);
});
it('keeps a new device outside the diary when cloud decryption fails', async () => {
  mocks.resume.mockResolvedValue({ user: { id: 'alice' } });
  mocks.cloud.mockResolvedValue({ revision: 2, payload: { encrypted: true } });
  mocks.open.mockRejectedValue(new Error('密码不正确'));
  const { AccountBoundary } = await import('./AccountBoundary');
  render(<StrictMode><AccountBoundary /></StrictMode>);
  fireEvent.change(await screen.findByLabelText('资料库密码'), { target: { value: 'wrong-password' } });
  await waitFor(() => expect((screen.getByRole('button', { name: '解密并恢复' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '解密并恢复' }));
  await screen.findByText('密码不正确');
  expect(mocks.apply).not.toHaveBeenCalled();
  expect(screen.queryByText('PRIVATE_DIARY_APP')).toBeNull();
});

it('restores a cleared device even when its remembered revision matches cloud', async () => {
  mocks.baseRevision = 2;
  mocks.resume.mockResolvedValue({ user: { id: 'alice' } });
  mocks.cloud.mockResolvedValue({ revision: 2, payload: { encrypted: true } });
  const { AccountBoundary } = await import('./AccountBoundary');
  render(<AccountBoundary />);
  await screen.findByLabelText('资料库密码');
  expect(screen.queryByText('PRIVATE_DIARY_APP')).toBeNull();
});
