import { currentAccountId } from './accountScope';
import { accountSessionGeneration } from './account/auth';
import { useAppStore } from '../stores/appStore';
import { VaultLockedError } from './vaultTransaction';

/** Every async operation observes lock/key transitions, including lock–unlock ABA. */
export async function withAvatarSession<T>(
  operation: (assertCurrent: () => void) => Promise<T>,
): Promise<T> {
  const initial = useAppStore.getState();
  const account = currentAccountId();
  const generation = accountSessionGeneration();
  let invalidated = false;
  const unsubscribe = useAppStore.subscribe((next, previous) => {
    if (next.isUnlocked !== previous.isUnlocked || next.masterPassword !== previous.masterPassword)
      invalidated = true;
  });
  const assertCurrent = () => {
    const now = useAppStore.getState();
    if (
      invalidated ||
      accountSessionGeneration() !== generation ||
      currentAccountId() !== account ||
      now.isUnlocked !== initial.isUnlocked ||
      now.masterPassword !== initial.masterPassword
    )
      throw new VaultLockedError();
  };
  try {
    const result = await operation(assertCurrent);
    assertCurrent();
    return result;
  } finally {
    unsubscribe();
  }
}
