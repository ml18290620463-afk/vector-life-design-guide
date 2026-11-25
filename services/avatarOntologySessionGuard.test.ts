import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());

it('invalidates an operation on account logout even when account scope and vault key remain unchanged', async () => {
  const { useAppStore } = await import('../stores/appStore');
  const { withAvatarSession } = await import('./avatarOntologySessionGuard');
  const { logoutAccount } = await import('./account/auth');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'unchanged' });
  await expect(
    withAvatarSession(async (assertCurrent) => {
      await logoutAccount();
      assertCurrent();
      return 'must not commit';
    }),
  ).rejects.toThrow();
});

it('invalidates lock-unlock cycles while allowing unrelated UI state updates', async () => {
  const { useAppStore } = await import('../stores/appStore');
  const { withAvatarSession } = await import('./avatarOntologySessionGuard');
  useAppStore.setState({ isUnlocked: true, masterPassword: 'unchanged' });
  await expect(
    withAvatarSession(async (assertCurrent) => {
      useAppStore.setState({ isUnlocked: false, masterPassword: null });
      useAppStore.setState({ isUnlocked: true, masterPassword: 'unchanged' });
      assertCurrent();
    }),
  ).rejects.toThrow();
  await expect(
    withAvatarSession(async (assertCurrent) => {
      useAppStore.setState({ isUnlocked: true });
      assertCurrent();
      return 'valid';
    }),
  ).resolves.toBe('valid');
});
