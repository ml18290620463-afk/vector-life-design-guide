import { useEffect, useState } from 'react';

/**
 * Returns a `Date.now()` snapshot that refreshes every `intervalMs` while
 * `enabled` is true. When disabled, no timer runs and the value is set once
 * on mount; this avoids 1Hz re-renders when nothing actually depends on it.
 *
 * Typical use: pass `entries.some(e => e.unlockAt && e.unlockAt > Date.now())`
 * as `enabled` so the tick only runs when there is a time-locked entry to
 * count down.
 */
export function useNowTick(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return now;
}
