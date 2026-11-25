import { beforeEach, describe, expect, it } from 'vitest';
import { clear, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { SecurityService } from './securityService';
import { commitAvatarOntology, initializeAvatarOntology, readAvatarOntology } from './avatarOntologyStore';
import { setAvatarGuardrailEnabled } from './avatarGuardrail';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});

describe('explicit personal guardrail switch', () => {
  it('rejects missing or unconfirmed cognition', async () => {
    await initializeAvatarOntology();
    await expect(setAvatarGuardrailEnabled(0, 'missing', true)).rejects.toThrow('仅可切换');
    expect((await readAvatarOntology()).revision).toBe(0);
  });

  it('rejects a stale switch revision without changing the graph', async () => {
    await initializeAvatarOntology();
    await commitAvatarOntology(0, () => {});
    await expect(setAvatarGuardrailEnabled(0, 'missing', true)).rejects.toThrow('已更新');
    expect((await readAvatarOntology()).revision).toBe(1);
  });

  it('blocks the switch while the account is locked', async () => {
    const password = 'Phase5-private-123!';
    const salt = 'phase-five-salt';
    await set(K.passwordHash, await SecurityService.hashPassword(password, salt));
    await set(K.passwordSalt, salt);
    useAppStore.setState({ masterPassword: password, isUnlocked: true });
    await initializeAvatarOntology();
    useAppStore.setState({ masterPassword: null, isUnlocked: false });
    await expect(setAvatarGuardrailEnabled(0, 'missing', true)).rejects.toThrow('解锁');
  });
});
