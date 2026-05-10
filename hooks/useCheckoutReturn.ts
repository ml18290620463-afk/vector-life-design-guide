import { useEffect, useRef, useState } from 'react';
import { claimToken } from '../services/checkoutService';

/**
 * Phase 5.2 — `useCheckoutReturn`
 *
 * Listens to URL query params on mount and handles the two
 * post-Stripe redirect flows:
 *
 *   - **`?activate_session_id=<sessionId>`** (success_url) — POSTs
 *     to `/api/checkout/claim-token` (with backoff for "not yet
 *     ready") to fetch the freshly-minted license token, hands
 *     it to the supplied `onActivate` callback, and clears the
 *     query string via `history.replaceState` so the token /
 *     session id never lands in browser history or shared URLs.
 *
 *   - **`?activate_cancelled=1`** (cancel_url) — flips a
 *     `cancelled` flag the consumer can show as a quiet toast,
 *     then clears the query.
 *
 * The hook is a no-op when neither query param is present.
 *
 * # Why not React Router
 *
 * The app is single-page; we don't ship Router and don't want to
 * add it for one redirect handler. `URLSearchParams` +
 * `history.replaceState` is enough.
 */

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 40; // ~60s — Stripe webhook delivery is usually < 5s

export type CheckoutReturnPhase = 'idle' | 'claiming' | 'activated' | 'cancelled' | 'failed';

export interface UseCheckoutReturnArgs {
  /**
   * Called once with the freshly-minted token. The consumer
   * activates it via `useLicense.activate(token)`.
   */
  onActivate: (token: string) => Promise<unknown>;
}

export interface UseCheckoutReturnResult {
  phase: CheckoutReturnPhase;
  /** Non-null when a polling loop hit the retry ceiling. */
  failureDetail: string | null;
  /** Manual reset for tests / "dismiss" buttons. */
  reset: () => void;
}

const cleanQuery = () => {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const { pathname } = window.location;
    window.history.replaceState({}, '', pathname);
  } catch {
    // ignore — older browsers / opaque iframes
  }
};

export const useCheckoutReturn = (args: UseCheckoutReturnArgs): UseCheckoutReturnResult => {
  const [phase, setPhase] = useState<CheckoutReturnPhase>('idle');
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  // Guard against StrictMode double-invocation in dev. The id
  // we've already started polling on is captured here.
  const handledSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('activate_session_id');
    const cancelled = params.get('activate_cancelled');

    if (cancelled === '1') {
      setPhase('cancelled');
      cleanQuery();
      return;
    }
    if (!sessionId || sessionId.length === 0) return;
    if (handledSessionRef.current === sessionId) return;
    handledSessionRef.current = sessionId;

    let cancelledLocal = false;
    setPhase('claiming');
    setFailureDetail(null);

    (async () => {
      let attempts = 0;
      while (!cancelledLocal && attempts < MAX_POLL_ATTEMPTS) {
        attempts += 1;
        const result = await claimToken({ sessionId });
        if (cancelledLocal) return;
        if (result.ok === true) {
          await args.onActivate(result.token);
          setPhase('activated');
          cleanQuery();
          return;
        }
        if (result.reason === 'not-ready') {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          continue;
        }
        setFailureDetail(result.reason);
        setPhase('failed');
        cleanQuery();
        return;
      }
      if (!cancelledLocal) {
        setFailureDetail('timeout');
        setPhase('failed');
        cleanQuery();
      }
    })();

    return () => {
      cancelledLocal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setPhase('idle');
    setFailureDetail(null);
    handledSessionRef.current = null;
  };

  return { phase, failureDetail, reset };
};
