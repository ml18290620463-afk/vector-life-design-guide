import { assertAIPrivacyUnchanged } from '../../../services/aiPrivacy';
import { subscribeVault } from '../../../services/vaultTransaction';
import { currentAccountId } from '../../../services/accountScope';
import { useAppStore } from '../../../stores/appStore';

/** Guard the entire response lifecycle, including JSON parsing. Aborting cannot
 * retract data already transmitted to a provider. */
export async function avatarRequest<T>(token: string, url: string, init: RequestInit) {
  const controller = new AbortController();
  const session = useAppStore.getState();
  const account = currentAccountId();
  const caller = init.signal;
  const abort = () => controller.abort();
  const assertSession = () => {
    const now = useAppStore.getState();
    if (
      now.isUnlocked !== session.isUnlocked ||
      now.masterPassword !== session.masterPassword ||
      currentAccountId() !== account
    ) {
      controller.abort();
    }
    controller.signal.throwIfAborted();
  };
  const unsubscribeSession = useAppStore.subscribe(() => {
    try {
      assertSession();
    } catch {
      abort();
    }
  });
  const unsubscribe = subscribeVault(() => {
    try {
      assertSession();
    } catch {
      return;
    }
    void assertAIPrivacyUnchanged(token).catch(abort);
  });
  caller?.addEventListener('abort', abort, { once: true });
  if (caller?.aborted) abort();
  try {
    await assertAIPrivacyUnchanged(token);
    assertSession();
    const response = await fetch(url, { ...init, signal: controller.signal });
    const result = (await response.json()) as T;
    await assertAIPrivacyUnchanged(token);
    assertSession();
    return { response, result };
  } finally {
    unsubscribe();
    unsubscribeSession();
    caller?.removeEventListener('abort', abort);
  }
}
