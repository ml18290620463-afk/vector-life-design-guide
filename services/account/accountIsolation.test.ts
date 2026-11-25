import { beforeEach, expect, it, vi } from 'vitest';
import { get as legacyGet, set as legacySet } from 'idb-keyval';
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
});
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
async function open(id: string) {
  vi.resetModules();
  const scope = await import('../accountScope');
  scope.initializeAccountScope(id);
  return { scope, db: await import('../accountIdb') };
}
it('same display name and password do not select another account database or cache', async () => {
  const a = await open(alice);
  await a.db.set('diary', { name: '同名', password: 'same', text: 'Alice only' });
  a.scope.accountLocalStorage.setItem('draft', 'Alice draft');
  a.scope.accountSessionStorage.setItem('session', 'Alice session');
  const b = await open(bob);
  expect(await b.db.get('diary')).toBeUndefined();
  expect(b.scope.accountLocalStorage.getItem('draft')).toBeNull();
  expect(b.scope.accountSessionStorage.getItem('session')).toBeNull();
  await b.db.set('diary', { name: '同名', password: 'same', text: 'Bob only' });
  b.scope.accountLocalStorage.setItem('draft', 'Bob draft');
  b.scope.accountLocalStorage.clear();
  expect(await a.db.get('diary')).toMatchObject({ text: 'Alice only' });
  expect(a.scope.accountLocalStorage.getItem('draft')).toBe('Alice draft');
  expect(await b.db.get('diary')).toMatchObject({ text: 'Bob only' });
});
it('does not claim legacy data on first login, even if the default store was touched early', async () => {
  await legacySet('legacy-proof', 'existing private journal');
  const scope = await import('../accountScope');
  const db = await import('../accountIdb');
  db.accountStore();
  scope.initializeAccountScope(crypto.randomUUID());
  expect(await db.get('legacy-proof')).toBeUndefined();
  expect(await legacyGet('legacy-proof')).toBe('existing private journal');
});
it('requires a reload for account switching and rejects malformed identities', async () => {
  const { scope } = await open(alice);
  expect(() => scope.initializeAccountScope(bob)).toThrow('重新加载');
  vi.resetModules();
  const fresh = await import('../accountScope');
  expect(() => fresh.initializeAccountScope('-'.repeat(36))).toThrow('无效');
});
