import { useSyncExternalStore } from 'react';

const key = 'vector-reduce-motion';
const event = 'vector-motion-change';
const queries = ['(prefers-reduced-motion: reduce)', '(max-width: 767px)', '(pointer: coarse)'];
const subscribe = (notify: () => void) => {
  const media = queries.map((query) => window.matchMedia(query));
  media.forEach((item) => item.addEventListener('change', notify));
  window.addEventListener('storage', notify);
  window.addEventListener(event, notify);
  return () => {
    media.forEach((item) => item.removeEventListener('change', notify));
    window.removeEventListener('storage', notify);
    window.removeEventListener(event, notify);
  };
};
export const readMotionDisabled = () => {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
};
export const setMotionDisabled = (disabled: boolean) => {
  try {
    localStorage.setItem(key, String(disabled));
  } catch {
    /* Session remains usable. */
  }
  window.dispatchEvent(new Event(event));
};
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return true;
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return (
    readMotionDisabled() ||
    queries.some((query) => window.matchMedia(query).matches) ||
    (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 4) ||
    (device.deviceMemory !== undefined && device.deviceMemory <= 4) ||
    Boolean(device.connection?.saveData)
  );
};
/** Gate heavy visuals before mounting or requesting their lazy chunks. */
export const useMotionPreference = (): boolean =>
  useSyncExternalStore(subscribe, shouldReduceMotion, () => true);
export const useMotionDisabled = (): boolean =>
  useSyncExternalStore(subscribe, readMotionDisabled, () => false);
