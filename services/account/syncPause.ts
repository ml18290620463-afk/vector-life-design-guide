import { accountLocalStorage } from '../accountScope';
const KEY = 'vector-sync-paused-v1';
export const isSyncPaused = () => accountLocalStorage.getItem(KEY) === 'true';
export const pauseSync = () => accountLocalStorage.setItem(KEY, 'true');
export const resumeSync = () => accountLocalStorage.removeItem(KEY);
