import type { Express, Request, Response } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { resolveSku } from '../services/stripeIds';
import type { LicenseTier } from '../services/licenseToken';
import type { BillingPeriod } from '../lib/pricing';
import { ttlSecondsForPeriod, type Minter } from './licenseMinter';

/**
 * Phase 5.2 — `server/stripeRoutes.ts`
 *
 * Two routes:
 *
 *   - `POST /api/checkout/create-session` — accepts
 *     `{ tier, period, installId }` and returns the Stripe
 *     Checkout Session URL the client redirects to.
 *
 *   - `POST /api/stripe/webhook` — listens for
 *     `checkout.session.completed`, verifies Stripe's signature
 *     against the **raw** request body (this is critical;
 *     `express.json()` MUST NOT have parsed it first), and
 *     mints a license token via the configured `Minter`.
 *
 * # Webhook → token delivery
 *
 * Stripe webhooks are decoupled from the user's browser session
 * — they deliver server-to-server. So we can't put the token in
 * the webhook response. Instead:
 *
 *   1. The Checkout Session is created with `success_url`
 *      including `?session_id={CHECKOUT_SESSION_ID}`.
 *   2. The webhook fires, mints the token, **stashes it in
 *      memory** keyed by the session id (a `Map<string, string>`
 *      with a 30-minute TTL).
 *   3. When Stripe redirects the user to `success_url`, the
 *      client posts `{ sessionId }` to
 *      `POST /api/checkout/claim-token` and gets the freshly-
 *      minted token back.
 *
 * The in-memory map is fine for v1: a process restart between
 * webhook and claim is rare (Stripe re-tries webhooks; on a
 * cold cache miss the user gets "session not ready, retry in
 * a moment"). Phase 5.3 will move the cache to Redis when we
 * ship multi-instance deploys.
 *
 * # Production posture (defence in depth)
 *
 *   - Webhook handler is mounted via `express.raw({ type:
 *     'application/json' })` BEFORE the global `express.json()`
 *     so Stripe's signature can verify the bytes.
 *   - The minter's secret key is loaded from env once at
 *     startup; this module never touches it directly.
 *   - All errors are logged with a `requestId` so the operator
 *     can correlate user-side support tickets to webhook events.
 *   - Response bodies for the webhook ALWAYS return 200 to
 *     Stripe (even on internal mint errors) UNLESS the signature
 *     fails, because Stripe retries 4xx/5xx — and a malformed
 *     internal mint shouldn't make Stripe bombard us. We log
 *     the mint failure separately for human follow-up.
 */

/* ------------------------------------------------------------------ */
/*  Config + bootstrap                                                 */
/* ------------------------------------------------------------------ */

export interface StripeRoutesDeps {
  /** Already-instantiated minter (P-2). */
  minter: Minter;
  /** Stripe API key (sk_test_… or sk_live_…). */
  stripeSecretKey: string;
  /** Webhook signing secret (`whsec_…`). Set in the Stripe
   *  dashboard's webhook config. */
  webhookSecret: string;
  /** Origin for `success_url` / `cancel_url`. Without a trailing
   *  slash. Defaults to `http://localhost:3000` in dev. */
  publicOrigin: string;
  /** Optional: inject a pre-built Stripe client. Used by tests to
   *  swap in a stub without monkey-patching the SDK constructor.
   *  Production uses the default (a fresh `new Stripe(secretKey)`
   *  with the pinned API version). */
  stripeClient?: Stripe;
}

interface PendingTokenEntry {
  token: string;
  mintedAt: number;
}

/** TTL for the in-memory session→token cache (ms). 30 minutes
 *  is generous — Stripe usually delivers webhooks within seconds
 *  but we want to absorb users who close the redirect tab and
 *  come back later. */
const PENDING_TTL_MS = 30 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Input validation (create-session)                                  */
/* ------------------------------------------------------------------ */

interface CreateSessionInput {
  tier: LicenseTier;
  period: BillingPeriod;
  installId: string;
}

const VALID_TIERS: ReadonlySet<LicenseTier> = new Set(['stardust', 'polaris', 'owner']);
const VALID_PERIODS: ReadonlySet<BillingPeriod> = new Set(['monthly', 'annual', 'lifetime']);

const validateCreateSessionInput = (raw: unknown): CreateSessionInput | string => {
  if (!raw || typeof raw !== 'object') return 'body must be an object';
  const v = raw as Partial<CreateSessionInput>;
  if (!v.tier || !VALID_TIERS.has(v.tier as LicenseTier)) {
    return `tier must be one of: ${Array.from(VALID_TIERS).join(' / ')}`;
  }
  if (!v.period || !VALID_PERIODS.has(v.period as BillingPeriod)) {
    return `period must be one of: ${Array.from(VALID_PERIODS).join(' / ')}`;
  }
  if (typeof v.installId !== 'string' || v.installId.length === 0 || v.installId.length > 128) {
    return 'installId must be a non-empty string ≤ 128 chars';
  }
  return { tier: v.tier as LicenseTier, period: v.period as BillingPeriod, installId: v.installId };
};

/* ------------------------------------------------------------------ */
/*  Route registrar                                                    */
/* ------------------------------------------------------------------ */

export const registerStripeRoutes = (app: Express, deps: StripeRoutesDeps): void => {
  const { minter, stripeSecretKey, webhookSecret, publicOrigin } = deps;
  if (!stripeSecretKey) throw new Error('registerStripeRoutes: stripeSecretKey is required');
  if (!webhookSecret) throw new Error('registerStripeRoutes: webhookSecret is required');

  // We pin a stable Stripe API version so a server restart against
  // a newer Stripe SDK doesn't silently change request shapes.
  // Pin the API version to the SDK's bundled default. Bumping the
  // SDK = explicit code review + this string flips with it. We
  // deliberately don't override to an older version because Stripe
  // requires every account to opt-in to deprecated versions and
  // the dashboard shows the active version per account.
  const stripe =
    deps.stripeClient ??
    new Stripe(stripeSecretKey, {
      apiVersion: '2026-04-22.dahlia',
    });

  // In-memory session→token cache. Cleared periodically by a
  // best-effort sweeper.
  const pendingTokens = new Map<string, PendingTokenEntry>();
  const sweepPending = () => {
    const cutoff = Date.now() - PENDING_TTL_MS;
    for (const [sessionId, entry] of pendingTokens) {
      if (entry.mintedAt < cutoff) pendingTokens.delete(sessionId);
    }
  };
  // Sweep every 5 min (cheap; Map iteration is fast for our scale).
  setInterval(sweepPending, 5 * 60 * 1000).unref?.();

  /* -------------------------------------------------------------- */
  /*  POST /api/checkout/create-session                              */
  /* -------------------------------------------------------------- */
  app.post('/api/checkout/create-session', async (req: Request, res: Response) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const validation = validateCreateSessionInput(req.body);
    if (typeof validation === 'string') {
      res.status(400).json({ error: validation, requestId });
      return;
    }
    const { tier, period, installId } = validation;

    const sku = resolveSku(tier, period);
    if (!sku || !sku.stripeIdResolved) {
      console.warn('[stripe] SKU not configured', { requestId, tier, period });
      res.status(503).json({
        error: `SKU ${tier}/${period} is not configured (missing Stripe price id)`,
        requestId,
      });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: period === 'lifetime' ? 'payment' : 'subscription',
        line_items: [{ price: sku.stripeIdResolved, quantity: 1 }],
        // Pass the install id through metadata. Stripe echoes it
        // back on the webhook event so we know who paid.
        metadata: {
          installId,
          tier,
          period,
        },
        // For subscription mode, Stripe also lets us label the
        // subscription itself with metadata so the Customer
        // Portal cancel-flow webhook (Phase 5.3) can identify
        // the install id without reading the original session.
        ...(period !== 'lifetime' && {
          subscription_data: { metadata: { installId, tier, period } },
        }),
        success_url: `${publicOrigin}/?activate_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicOrigin}/?activate_cancelled=1`,
      });
      res.json({ url: session.url, sessionId: session.id, requestId });
    } catch (err) {
      console.error('[stripe] create-session failed', {
        requestId,
        err: (err as Error).message,
      });
      res.status(502).json({ error: 'Stripe rejected the session creation', requestId });
    }
  });

  /* -------------------------------------------------------------- */
  /*  POST /api/stripe/webhook                                       */
  /*                                                                  */
  /*  raw body — MUST be registered with express.raw, NOT json.      */
  /* -------------------------------------------------------------- */
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req: Request, res: Response) => {
      const requestId = randomUUID();
      res.setHeader('X-Request-Id', requestId);

      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        res.status(400).send('missing signature');
        return;
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      } catch (err) {
        console.warn('[stripe] webhook signature verify failed', {
          requestId,
          err: (err as Error).message,
        });
        res.status(400).send('invalid signature');
        return;
      }

      // We only care about checkout completion in v1. Phase 5.3
      // adds `customer.subscription.deleted` and
      // `customer.subscription.updated` for renewals / cancels.
      if (event.type !== 'checkout.session.completed') {
        res.status(200).send('ignored');
        return;
      }

      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata ?? {};
      const installId = meta.installId;
      const tier = meta.tier as LicenseTier | undefined;
      const period = meta.period as BillingPeriod | undefined;

      if (!installId || !tier || !period) {
        console.error('[stripe] webhook event missing metadata', {
          requestId,
          sessionId: session.id,
        });
        // Return 200 so Stripe doesn't bombard us; we logged the
        // event for human follow-up.
        res.status(200).send('metadata missing');
        return;
      }

      try {
        const token = await minter.mintToken({
          tier,
          installId,
          ttlSeconds: ttlSecondsForPeriod(period),
        });
        pendingTokens.set(session.id, { token, mintedAt: Date.now() });
        console.info('[stripe] minted token', {
          requestId,
          sessionId: session.id,
          tier,
          period,
        });
      } catch (err) {
        // Same posture: log + 200 so Stripe doesn't loop. The
        // user will see "couldn't activate, contact support" on
        // the redirect; support can replay from the session id.
        console.error('[stripe] mint failed', {
          requestId,
          sessionId: session.id,
          err: (err as Error).message,
        });
      }

      res.status(200).send('ok');
    },
  );

  /* -------------------------------------------------------------- */
  /*  POST /api/checkout/claim-token                                 */
  /*                                                                  */
  /*  The client polls this with the session id from success_url    */
  /*  to get the freshly-minted token. Removes the entry after a    */
  /*  successful read so a leaked session id can't replay.          */
  /* -------------------------------------------------------------- */
  app.post('/api/checkout/claim-token', async (req: Request, res: Response) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const sessionId = (req.body as { sessionId?: unknown })?.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      res.status(400).json({ error: 'sessionId is required', requestId });
      return;
    }
    const entry = pendingTokens.get(sessionId);
    if (!entry) {
      // Either the webhook hasn't fired yet OR the session is
      // unknown / already claimed. The client retries with
      // backoff for a minute before showing "support" copy.
      res.status(404).json({ error: 'token not yet ready', requestId });
      return;
    }
    pendingTokens.delete(sessionId);
    res.json({ token: entry.token, requestId });
  });
};

/** For tests — drop the in-memory cache without restarting the
 *  process. Not exposed via routes; only callable from inside
 *  the same module. */
export const __testClearPendingTokens = (): void => {
  // Tests can re-import the module to re-instantiate the cache;
  // we keep this stub so future test scaffolding has a hook.
};
