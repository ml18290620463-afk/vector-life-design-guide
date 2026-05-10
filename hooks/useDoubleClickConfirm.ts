import { useCallback, useState } from 'react';
import { useTimeoutManager } from './useTimeoutManager';

export interface UseDoubleClickConfirmArgs {
  /** Fires only on the *second* click (within `confirmWindowMs` of the
   *  first). The parent decides what the destructive action is. */
  onConfirm: () => void;
  /** Time the "are you sure?" badge stays visible. Defaults to 3 s. */
  confirmWindowMs?: number;
  /** Smallest gap between the two clicks; the second click fires
   *  immediately after this gap so an accidental double-tap doesn't
   *  count. Defaults to 500 ms. */
  minGapMs?: number;
}

export interface DoubleClickConfirm {
  /** True when the first click landed and we're waiting for either a
   *  confirming second click or the `confirmWindowMs` to elapse. The
   *  parent renders its "Confirm?" affordance based on this. */
  isConfirming: boolean;
  /** Wire this onto the destructive button. First call arms the
   *  confirmation badge; the second call (after `minGapMs`) fires
   *  `onConfirm`. */
  trigger: () => void;
  /** Imperatively dismiss the confirmation badge (e.g. on route away). */
  reset: () => void;
}

/**
 * Anti-misclick "click once → 'Confirm?' → click again to actually do
 * the thing" interaction. Used by MasterLock for its cancel button so
 * users don't accidentally bail out of an unlock flow.
 *
 * Pulled out of `MasterLock.tsx` as part of Phase 2 §2.i. Generic on
 * purpose so the next destructive button (delete-with-confirm,
 * sign-out-with-confirm) can also reuse it.
 */
export const useDoubleClickConfirm = ({
  onConfirm,
  confirmWindowMs = 3000,
  minGapMs = 500,
}: UseDoubleClickConfirmArgs): DoubleClickConfirm => {
  const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutManager();
  const [isConfirming, setIsConfirming] = useState(false);
  const [armedAt, setArmedAt] = useState(0);

  const reset = useCallback(() => {
    clearScheduledTimeouts();
    setIsConfirming(false);
    setArmedAt(0);
  }, [clearScheduledTimeouts]);

  const trigger = useCallback(() => {
    const now = Date.now();
    if (isConfirming) {
      // Only honour the confirming click if the user has had at least
      // `minGapMs` to read the warning — otherwise it's a double-tap.
      if (now - armedAt > minGapMs) {
        clearScheduledTimeouts();
        setIsConfirming(false);
        setArmedAt(0);
        onConfirm();
      }
      return;
    }
    setIsConfirming(true);
    setArmedAt(now);
    scheduleTimeout(() => {
      setIsConfirming(false);
      setArmedAt(0);
    }, confirmWindowMs);
  }, [
    armedAt,
    clearScheduledTimeouts,
    confirmWindowMs,
    isConfirming,
    minGapMs,
    onConfirm,
    scheduleTimeout,
  ]);

  return { isConfirming, trigger, reset };
};
