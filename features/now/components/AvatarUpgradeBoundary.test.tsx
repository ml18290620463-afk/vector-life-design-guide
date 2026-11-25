import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../stores/appStore';
import { AvatarUpgradeBoundary } from './AvatarUpgradeBoundary';
import {
  AvatarUpgradeRequiredError,
  initializeAvatarOntology,
  settleExpiredAvatarOntology,
} from '../../../services/avatarOntologyStore';
import { VaultLockedError } from '../../../services/vaultTransaction';
vi.mock('../../../services/avatarOntologyStore', async (original) => ({
  ...(await original<typeof import('../../../services/avatarOntologyStore')>()),
  initializeAvatarOntology: vi.fn(),
  settleExpiredAvatarOntology: vi.fn(),
}));
const initialize = vi.mocked(initializeAvatarOntology);
const settle = vi.mocked(settleExpiredAvatarOntology);
const graph = { ontologySchemaVersion: 2 as const, revision: 0, objects: [], edges: [] };
beforeEach(() => {
  vi.clearAllMocks();
  settle.mockResolvedValue(graph);
  useAppStore.setState({ masterPassword: null, isUnlocked: true, userId: 'local-user' });
});
it('mounts consumers only after an empty new-user graph is verified', async () => {
  let resolve!: (value: typeof graph) => void;
  initialize.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  expect(screen.queryByText('consumer')).toBeNull();
  await act(async () => resolve(graph));
  expect(screen.getByText('consumer')).toBeTruthy();
});
it('waits for the startup expiry scan before mounting avatar consumers', async () => {
  let finishScan!: (value: typeof graph) => void;
  initialize.mockResolvedValue(graph);
  settle.mockImplementation(() => new Promise((resolve) => { finishScan = resolve; }));
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  await waitFor(() => expect(settle).toHaveBeenCalledOnce());
  expect(screen.queryByText('consumer')).toBeNull();
  await act(async () => finishScan(graph));
  expect(screen.getByText('consumer')).toBeTruthy();
});
it.each([
  ['locked', new VaultLockedError(), '解锁资料库'],
  ['upgrade', new AvatarUpgradeRequiredError(), '设置密码并升级'],
  ['scan error', new Error('scan failed'), '重新核验'],
])('leaves the waiting gate and shows the %s recovery action', async (kind, failure, action) => {
  if (kind === 'scan error') {
    initialize.mockResolvedValue(graph);
    settle.mockRejectedValueOnce(failure);
  } else initialize.mockRejectedValueOnce(failure);
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()} onUnlock={vi.fn()} onSetPassword={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  expect(await screen.findByRole('button', { name: action })).toBeTruthy();
  expect(screen.queryByText('consumer')).toBeNull();
  if (kind !== 'scan error') expect(settle).not.toHaveBeenCalled();
  if (kind === 'scan error') expect(screen.getByRole('alert').textContent).toContain('scan failed');
});
it('offers the existing protection form and resumes after password setup', async () => {
  initialize.mockRejectedValueOnce(new AvatarUpgradeRequiredError()).mockResolvedValue(graph);
  const save = vi.fn(async (password: string) => {
    useAppStore.setState({ masterPassword: password, isUnlocked: true });
  });
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()} onSetPassword={save}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  fireEvent.click(await screen.findByRole('button', { name: '设置密码并升级' }));
  expect(screen.queryByText('consumer')).toBeNull();
  fireEvent.change(screen.getByTestId('onboarding-password'), { target: { value: 'Password123' } });
  fireEvent.change(screen.getByTestId('onboarding-password-confirm'), {
    target: { value: 'Password123' },
  });
  fireEvent.click(screen.getByTestId('onboarding-protect'));
  await screen.findByText('consumer');
  expect(save).toHaveBeenCalledWith('Password123');
  expect(initialize).toHaveBeenCalledTimes(2);
});
it('unmounts consumers on locking and exposes the unlock action', async () => {
  initialize.mockResolvedValueOnce(graph).mockRejectedValue(new VaultLockedError());
  const unlock = vi.fn();
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()} onUnlock={unlock}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  await screen.findByText('consumer');
  act(() => useAppStore.setState({ isUnlocked: false }));
  expect(screen.queryByText('consumer')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: '解锁资料库' }));
  expect(unlock).toHaveBeenCalledOnce();
});
it('discards completion from a previous account', async () => {
  let resolveOld!: (value: typeof graph) => void;
  initialize
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveOld = done;
        }),
    )
    .mockRejectedValue(new Error('checkpoint rejected'));
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  act(() => useAppStore.setState({ userId: 'other-user' }));
  await screen.findByRole('alert');
  await act(async () => resolveOld(graph));
  expect(screen.queryByText('consumer')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('checkpoint rejected');
});
it('keeps consumers paused after invalid checkpoint and permits verification retry', async () => {
  initialize.mockRejectedValueOnce(new Error('checkpoint rejected')).mockResolvedValue(graph);
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  await screen.findByRole('alert');
  expect(screen.queryByText('consumer')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重新核验' }));
  await waitFor(() => expect(screen.getByText('consumer')).toBeTruthy());
});

it('reverifies after a batched lock/unlock instead of retaining stale consumers', async () => {
  initialize.mockResolvedValueOnce(graph).mockRejectedValue(new Error('checkpoint changed'));
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  await screen.findByText('consumer');
  act(() => {
    useAppStore.setState({ isUnlocked: false });
    useAppStore.setState({ isUnlocked: true });
  });
  expect(screen.queryByText('consumer')).toBeNull();
  expect((await screen.findByRole('alert')).textContent).toContain('checkpoint changed');
  expect(initialize).toHaveBeenCalledTimes(2);
});
it('discards pending verification after a batched key replacement and restoration', async () => {
  let resolveOld!: (value: typeof graph) => void;
  initialize
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockRejectedValue(new Error('key changed'));
  render(
    <AvatarUpgradeBoundary language="zh" onBack={vi.fn()}>
      <p>consumer</p>
    </AvatarUpgradeBoundary>,
  );
  act(() => {
    useAppStore.setState({ masterPassword: 'temporary-key' });
    useAppStore.setState({ masterPassword: null });
  });
  await screen.findByRole('alert');
  await act(async () => resolveOld(graph));
  expect(screen.queryByText('consumer')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('key changed');
});
