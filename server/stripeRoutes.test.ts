/**
 * Tests for the Phase 5.2 Stripe routes. We mock the `stripe`
 * SDK constructor at the module boundary so we don't need a
 * real Stripe account to test:
 *
 *   - POST /api/checkout/create-session — input validation +
 *     SKU resolution + Stripe call shape.
 *   - POST /api/stripe/webhook — raw-body signature verify
 *     branches + token mint + cache.
 *   - POST /api/checkout/claim-token — happy path + cache miss.
 *
 * The webhook signature path is tested end-to-end by passing
 * the SDK its own constructed event (we use the real
 * `stripe.webhooks.generateTestHeaderString` helper).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import Stripe from 'stripe';
import { ed } from '../services/edBootstrap';
import { createMinter } from './licenseMinter';
import { registerStripeRoutes } from './stripeRoutes';

const STRIPE_KEY = 'sk_test_mock_for_unit_tests';
const WEBHOOK_SECRET = 'whsec_test_secret_value';
const PUBLIC_ORIGIN = 'http://localhost:3000';

const buildMinter = async () => {
  const secret = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secret);
  return {
    minter: createMinter({
      secretKeyBase64: Buffer.from(secret).toString('base64'),
      kid: 'test-kid',
    }),
    publicKey,
  };
};

/** Build a Stripe stub for tests:
 *   - `checkout.sessions.create` — injected mock so we don't call
 *     the real Stripe API.
 *   - `webhooks.constructEvent` — proxied to the static
 *     `Stripe.webhooks.constructEvent` (for v22+, `webhooks` is
 *     also exposed at the class level via `Stripe.webhooks`),
 *     so the signature verification path stays end-to-end real.
 */
const buildStubStripeClient = (sessionsCreate: ReturnType<typeof vi.fn>): Stripe =>
  ({
    checkout: { sessions: { create: sessionsCreate } },
    webhooks: Stripe.webhooks,
  }) as unknown as Stripe;

const buildApp = async (
  overrides: { sessionsCreate?: ReturnType<typeof vi.fn> } = {},
): Promise<{ app: Express; sessionsCreate: ReturnType<typeof vi.fn> }> => {
  const sessionsCreate =
    overrides.sessionsCreate ??
    vi.fn().mockResolvedValue({
      id: 'cs_test_AAA',
      url: 'https://checkout.stripe.com/c/pay/cs_test_AAA',
    });

  // Fix env vars so resolveSku finds a price id.
  process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY = 'price_TEST_SM';
  process.env.VECTOR_STRIPE_PRICE_STARDUST_ANNUAL = 'price_TEST_SA';
  process.env.VECTOR_STRIPE_PRICE_POLARIS_MONTHLY = 'price_TEST_PM';
  process.env.VECTOR_STRIPE_PRICE_POLARIS_ANNUAL = 'price_TEST_PA';
  process.env.VECTOR_STRIPE_PRICE_OWNER_LIFETIME = 'price_TEST_OL';

  const { minter } = await buildMinter();
  const app = express();
  // Mount a JSON parser that **skips** the Stripe webhook path
  // (which needs raw bytes for signature verify). Production
  // server.ts mirrors this guard. The route registrar sets up
  // its own `express.raw()` inside the webhook route handler
  // chain, but Express will already have run the global
  // express.json() unless we skip it explicitly.
  app.use((req, res, next) => {
    if (req.path === '/api/stripe/webhook') return next();
    return express.json()(req, res, next);
  });
  registerStripeRoutes(app, {
    minter,
    stripeSecretKey: STRIPE_KEY,
    webhookSecret: WEBHOOK_SECRET,
    publicOrigin: PUBLIC_ORIGIN,
    stripeClient: buildStubStripeClient(sessionsCreate),
  });

  return { app, sessionsCreate };
};

describe('server/stripeRoutes', () => {
  beforeEach(() => {
    // Reset env in case a previous test polluted it.
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY;
    delete process.env.VECTOR_STRIPE_PRICE_STARDUST_ANNUAL;
    delete process.env.VECTOR_STRIPE_PRICE_POLARIS_MONTHLY;
    delete process.env.VECTOR_STRIPE_PRICE_POLARIS_ANNUAL;
    delete process.env.VECTOR_STRIPE_PRICE_OWNER_LIFETIME;
  });

  /* ----- create-session ------------------------------------------ */

  describe('POST /api/checkout/create-session', () => {
    it('rejects missing tier', async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .post('/api/checkout/create-session')
        .send({ period: 'monthly', installId: 'install-A' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/tier/);
    });

    it('rejects unknown period', async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .post('/api/checkout/create-session')
        .send({ tier: 'stardust', period: 'weekly', installId: 'install-A' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/period/);
    });

    it('rejects empty installId', async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .post('/api/checkout/create-session')
        .send({ tier: 'stardust', period: 'monthly', installId: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/installId/);
    });

    it('returns 503 when the env price id is not configured for the requested SKU', async () => {
      const { app } = await buildApp();
      delete process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY;
      const res = await request(app)
        .post('/api/checkout/create-session')
        .send({ tier: 'stardust', period: 'monthly', installId: 'install-A' });
      expect(res.status).toBe(503);
    });

    it('happy path — calls Stripe with the configured price id + metadata', async () => {
      const { app, sessionsCreate } = await buildApp();
      const res = await request(app)
        .post('/api/checkout/create-session')
        .send({ tier: 'polaris', period: 'annual', installId: 'install-XYZ' });
      expect(res.status).toBe(200);
      expect(res.body.url).toMatch(/checkout\.stripe\.com/);
      expect(res.body.sessionId).toBe('cs_test_AAA');

      expect(sessionsCreate).toHaveBeenCalledTimes(1);
      const args = sessionsCreate.mock.calls[0][0];
      expect(args.line_items[0].price).toBe('price_TEST_PA');
      expect(args.metadata).toEqual({
        installId: 'install-XYZ',
        tier: 'polaris',
        period: 'annual',
      });
      expect(args.mode).toBe('subscription');
      expect(args.success_url).toMatch(/activate_session_id=\{CHECKOUT_SESSION_ID\}/);
    });

    it('lifetime SKU uses payment mode, no subscription_data', async () => {
      const { app, sessionsCreate } = await buildApp();
      await request(app)
        .post('/api/checkout/create-session')
        .send({ tier: 'owner', period: 'lifetime', installId: 'install-O' });
      const args = sessionsCreate.mock.calls[0][0];
      expect(args.mode).toBe('payment');
      expect(args.subscription_data).toBeUndefined();
    });
  });

  /* ----- webhook + claim-token ----------------------------------- */

  describe('POST /api/stripe/webhook + /api/checkout/claim-token', () => {
    /** Fabricate a real signed webhook payload using Stripe's
     *  test header helper so we exercise the real signature
     *  verification path. */
    const buildSignedWebhook = (event: object): { body: string; signature: string } => {
      const body = JSON.stringify(event);
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: WEBHOOK_SECRET,
      });
      return { body, signature };
    };

    it('rejects requests with a missing signature', async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .post('/api/stripe/webhook')
        .set('content-type', 'application/json')
        .send('{}');
      expect(res.status).toBe(400);
    });

    it('rejects requests with a forged signature', async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .post('/api/stripe/webhook')
        .set('content-type', 'application/json')
        .set('stripe-signature', 't=1,v1=00000')
        .send('{}');
      expect(res.status).toBe(400);
    });

    it('ignores non-completion events (200 ignored)', async () => {
      const { app } = await buildApp();
      const { body, signature } = buildSignedWebhook({
        id: 'evt_test_AAA',
        type: 'invoice.created',
        data: { object: {} },
      });
      const res = await request(app)
        .post('/api/stripe/webhook')
        .set('content-type', 'application/json')
        .set('stripe-signature', signature)
        .send(body);
      expect(res.status).toBe(200);
      expect(res.text).toBe('ignored');
    });

    it('mints a token on checkout.session.completed + claim-token returns it', async () => {
      const { app } = await buildApp();
      const sessionId = 'cs_test_BBB';
      const { body, signature } = buildSignedWebhook({
        id: 'evt_test_BBB',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            metadata: {
              installId: 'install-BBB',
              tier: 'stardust',
              period: 'monthly',
            },
          },
        },
      });
      const webhookRes = await request(app)
        .post('/api/stripe/webhook')
        .set('content-type', 'application/json')
        .set('stripe-signature', signature)
        .send(body);
      expect(webhookRes.status).toBe(200);

      // Now claim the token.
      const claimRes = await request(app).post('/api/checkout/claim-token').send({ sessionId });
      expect(claimRes.status).toBe(200);
      expect(claimRes.body.token.startsWith('vector-license-v1.')).toBe(true);

      // Second claim should miss (token consumed).
      const second = await request(app).post('/api/checkout/claim-token').send({ sessionId });
      expect(second.status).toBe(404);
    });

    it('handles checkout completion with missing metadata gracefully (200 logged)', async () => {
      const { app } = await buildApp();
      const { body, signature } = buildSignedWebhook({
        id: 'evt_test_NOMETA',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_NOMETA', metadata: {} } },
      });
      const res = await request(app)
        .post('/api/stripe/webhook')
        .set('content-type', 'application/json')
        .set('stripe-signature', signature)
        .send(body);
      expect(res.status).toBe(200);
      expect(res.text).toBe('metadata missing');
    });

    it('claim-token rejects empty sessionId', async () => {
      const { app } = await buildApp();
      const res = await request(app).post('/api/checkout/claim-token').send({});
      expect(res.status).toBe(400);
    });

    it('claim-token returns 404 for an unknown session', async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .post('/api/checkout/claim-token')
        .send({ sessionId: 'cs_test_UNKNOWN' });
      expect(res.status).toBe(404);
    });
  });
});
