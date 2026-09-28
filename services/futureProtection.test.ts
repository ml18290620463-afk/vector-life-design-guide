import { beforeEach, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { SecurityService } from './securityService';
import { DiaryStorageKeys as K } from './diaryStorage';
import { changeFutureProtection } from './vaultTransaction';
import { readFutureSnapshot, saveVision, saveFutureAction } from './futureRepository';
import { readStoredArray } from './diaryDataRead';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  vi.restoreAllMocks();
});

async function login(password = 'Test-only-Password1!') {
  const salt = 'test-salt';
  await set(K.passwordSalt, salt);
  await set(K.passwordHash, await SecurityService.hashPassword(password, salt));
  useAppStore.setState({ isUnlocked: true, masterPassword: password });
  return password;
}

it('uses one login for editable future and shared Now actions, without plaintext storage', async () => {
  const password = await login();
  const vision = await saveVision({ text: '亲近山林', status: 'active' });
  await saveVision({ ...vision, text: '亲近自然' });
  const action = await saveFutureAction({
    title: '登山准备',
    status: 'pending',
    resultIntent: 'preparation',
  });
  expect((await readFutureSnapshot()).state.visions[0].text).toBe('亲近自然');
  expect(await readStoredArray(K.actions)).toEqual([action]);
  for (const key of [K.future, K.actions]) {
    expect(await get(key)).toMatchObject({ format: 'vector-private-v1' });
    expect(JSON.stringify(await get(key))).not.toMatch(/亲近|登山/);
  }
  useAppStore.setState({ isUnlocked: false });
  expect((await readFutureSnapshot()).protectedVault).toBe(true);
  await expect(saveVision({ ...vision, text: '禁止写入' })).rejects.toThrow('解锁');
  useAppStore.setState({ isUnlocked: true, masterPassword: password });
  expect((await readFutureSnapshot()).actions[0].title).toBe('登山准备');
});

it('rotates and removes protection without losing future or action data', async () => {
  await login();
  await saveVision({ text: '健康生活', status: 'active' });
  await saveFutureAction({ title: '散步', status: 'pending', resultIntent: 'preparation' });
  const next = 'Another-Test-Password2!';
  await changeFutureProtection(
    next,
    await SecurityService.hashPassword(next, 'next-salt'),
    'next-salt',
  );
  useAppStore.setState({ masterPassword: next });
  expect((await readFutureSnapshot()).state.visions[0].text).toBe('健康生活');
  await changeFutureProtection(null);
  useAppStore.setState({ isUnlocked: false, masterPassword: null });
  expect((await readFutureSnapshot()).actions[0].title).toBe('散步');
  expect(await get(K.passwordHash)).toBeUndefined();
});

it('aborts if the user locks while encryption is pending', async () => {
  await login();
  const encrypt = SecurityService.encrypt.bind(SecurityService);
  vi.spyOn(SecurityService, 'encrypt').mockImplementation(async (...args) => {
    const result = await encrypt(...args);
    useAppStore.setState({ isUnlocked: false });
    return result;
  });
  await expect(saveVision({ text: '不能保存', status: 'active' })).rejects.toThrow('解锁');
  expect(await get(K.future)).toBeUndefined();
});
