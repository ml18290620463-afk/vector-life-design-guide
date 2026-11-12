import * as idb from 'idb-keyval';
import { accountDatabaseName, currentAccountId } from './accountScope';
const stores = new Map<string, ReturnType<typeof idb.createStore>>();
export function accountStore() {
  const name = accountDatabaseName();
  if (!stores.has(name)) stores.set(name, idb.createStore(name, 'keyval'));
  return stores.get(name)!;
}
// Preserve the default store for local-only installations and existing migrations.
const selectedStore = () => currentAccountId() ? accountStore() : undefined;
export const get = <T = unknown>(key: IDBValidKey) => idb.get<T>(key, selectedStore());
export const set = (key: IDBValidKey, value: unknown) => idb.set(key, value, selectedStore());
export const del = (key: IDBValidKey) => idb.del(key, selectedStore());
export const getMany = <T = unknown>(keys: IDBValidKey[]) => idb.getMany<T>(keys, selectedStore());
