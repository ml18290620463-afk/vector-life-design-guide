import type { LicenseTier } from './licenseToken';
import type { BillingPeriod } from '../lib/pricing';

/**
 * Phase 5.2 — `services/checkoutService.ts`
 *
 * Client wrapper for the Stripe checkout flow:
 *
 *   - `startCheckout({tier, period, installId})` — POSTs to
 *     `/api/checkout/create-session`, returns `{ url }` so the
 *     caller can `window.location.assign(url)`.
 *
 *   - `claimToken({sessionId})` — POSTs to
 *     `/api/checkout/claim-token`, returns the freshly-minted
 *     license token. Used by App-level URL-hijack code (Q6) when
 *     Stripe redirects the user back to `/?activate_session_id=…`.
 *
 * Both calls return tagged failure reasons so the UI can show
 * actionable copy. Network errors collapse into `'unreachable'`.
 *
 * # Privacy posture
 *
 * The only data crossing the wire is `(tier, period, installId)`
 * → Stripe. The install id is the user's anonymous device id;
 * we don't send email / name / location / IP-derived metadata.
 * Stripe will collect billing info during checkout but that lives
 * on Stripe's servers, not ours.
 */

export type StartCheckoutFailure =
  | 'invalid-input'
  | 'sku-not-configured'
  | 'stripe-rejected'
  | 'unreachable'
  | 'unknown';

export type StartCheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; reason: StartCheckoutFailure; detail?: string };

const reasonForCreateSession = (status: number): StartCheckoutFailure => {
  if (status === 400) return 'invalid-input';
  if (status === 503) return 'sku-not-configured';
  if (status === 502) return 'stripe-rejected';
  return 'unknown';
};

export interface StartCheckoutArgs {
  tier: LicenseTier;
  period: BillingPeriod;
  installId: string;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch;
}

export const startCheckout = async (args: StartCheckoutArgs): Promise<StartCheckoutResult> => {
  const fetchImpl = args.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl('/api/checkout/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: args.tier,
        period: args.period,
        installId: args.installId,
      }),
    });
  } catch (err) {
    return { ok: false, reason: 'unreachable', detail: (err as Error).message };
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json().catch(() => null);
      detail = body && typeof body.error === 'string' ? body.error : undefined;
    } catch {
      // ignore
    }
    return { ok: false, reason: reasonForCreateSession(res.status), detail };
  }
  let body: { url?: unknown; sessionId?: unknown };
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'unknown', detail: 'invalid response body' };
  }
  if (typeof body.url !== 'string' || typeof body.sessionId !== 'string') {
    return { ok: false, reason: 'unknown', detail: 'missing url / sessionId' };
  }
  return { ok: true, url: body.url, sessionId: body.sessionId };
};

/* ------------------------------------------------------------------ */
/*  claim token                                                        */
/* ------------------------------------------------------------------ */

export type ClaimTokenFailure = 'invalid-input' | 'not-ready' | 'unreachable' | 'unknown';

export type ClaimTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: ClaimTokenFailure; detail?: string };

export interface ClaimTokenArgs {
  sessionId: string;
  fetchImpl?: typeof fetch;
}

export const claimToken = async (args: ClaimTokenArgs): Promise<ClaimTokenResult> => {
  const fetchImpl = args.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl('/api/checkout/claim-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: args.sessionId }),
    });
  } catch (err) {
    return { ok: false, reason: 'unreachable', detail: (err as Error).message };
  }
  if (res.status === 400) return { ok: false, reason: 'invalid-input' };
  if (res.status === 404) return { ok: false, reason: 'not-ready' };
  if (!res.ok) return { ok: false, reason: 'unknown' };
  try {
    const body = (await res.json()) as { token?: unknown };
    if (typeof body.token !== 'string') {
      return { ok: false, reason: 'unknown', detail: 'missing token' };
    }
    return { ok: true, token: body.token };
  } catch {
    return { ok: false, reason: 'unknown', detail: 'invalid response body' };
  }
};
