/** A page owns exactly one account scope. Switching accounts requires a reload. */
let accountId: string | null = null;
let initialized = false;
export function initializeAccountScope(id: string | null) {
  if (initialized && id !== accountId) throw new Error('切换账号需要重新加载页面');
  if (id !== null && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error('账号标识无效');
  accountId = id;
  initialized = true;
}
export const currentAccountId = () => accountId;
export const accountDatabaseName = () => accountId ? `vector-account-${accountId}` : 'keyval-store';
export const accountStorageKey = (key: string) => accountId ? `vector-account:${accountId}:${key}` : key;
export const accountChannelName = () => accountId ? `vector-vault-commits:${accountId}` : 'vector-vault-commits-v1';

function storageFor(kind: 'localStorage' | 'sessionStorage'): Storage {
  return {
    getItem: (key) => window[kind].getItem(accountStorageKey(key)),
    setItem: (key, value) => window[kind].setItem(accountStorageKey(key), value),
    removeItem: (key) => window[kind].removeItem(accountStorageKey(key)),
    key(index) {
      const keys = Object.keys(window[kind]).filter((key) => key.startsWith(accountStorageKey('')));
      return keys[index]?.slice(accountStorageKey('').length) ?? null;
    },
    get length() { return Object.keys(window[kind]).filter((key) => key.startsWith(accountStorageKey(''))).length; },
    clear() {
      const keys = Array.from({ length: this.length }, (_, index) => this.key(index));
      keys.forEach((key) => { if (key !== null) this.removeItem(key); });
    },
  };
}
export const accountLocalStorage = storageFor('localStorage');
export const accountSessionStorage = storageFor('sessionStorage');
