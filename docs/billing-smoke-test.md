# Phase 5.2 Stripe smoke test (test mode)

> **Goal**: end-to-end verify the Phase 5.2 Stripe Checkout flow
> in Stripe **test mode** before flipping to live keys.
> Outcome: a real test-mode card (`4242 4242 4242 4242`) charged
> $0 in test mode → server webhook fires → license token signed
> → client auto-activates → Settings tier badge flips to paid.

This doc is hands-on; you (the operator) follow each step and tick
the `[ ]` boxes. Total time: ~30 minutes once you have a Stripe
test account + Stripe CLI installed.

## Prerequisites

- [ ] **Stripe test account** (free) — sign up at
      <https://dashboard.stripe.com> and **stay in test mode**
      (the toggle in the top-right of the dashboard).
- [ ] **Stripe CLI** installed and logged in:
      `bash
    brew install stripe/stripe-cli/stripe   # macOS
    # OR
    scoop install stripe                   # Windows
    stripe login                            # browser auth
    `
- [ ] Repo on the **Phase 5.2 commit** (HEAD = `chore(wiring):
    Phase 4 + 4.5 + 5 — App / Dashboard / Settings / i18n / docs`).
- [ ] `node_modules` installed (`npm install`).

## Step 1 — Create test-mode SKUs

Open <https://dashboard.stripe.com/test/products>. For each of
the five SKUs in `lib/pricing.ts`:

- [ ] **Stardust monthly** — $4.99 USD recurring monthly.
  - Click "Add product" → Name: `VECTOR Stardust (monthly)` →
    pricing model: Recurring → $4.99 → Monthly.
  - **Copy the price id** (starts with `price_…`).
- [ ] **Stardust annual** — $49.90 USD recurring yearly.
- [ ] **Polaris monthly** — $9.99 USD recurring monthly.
- [ ] **Polaris annual** — $99.90 USD recurring yearly.
- [ ] **Owner lifetime** — $199.00 USD one-time payment.
  - Pricing model: One-time → $199.00.

Tip: name them clearly so you can identify them in the dashboard
later. The price ids are what we wire into env vars below.

## Step 2 — Generate the master Ed25519 keypair

```bash
node -e "
const ed = require('@noble/ed25519');
const { sha512 } = require('@noble/hashes/sha2.js');
const concat = (...a) => { let n=0; for (const x of a) n += x.length; const o=new Uint8Array(n); let i=0; for (const x of a) { o.set(x,i); i+=x.length; } return o; };
ed.hashes.sha512Async = (...m) => Promise.resolve(sha512(concat(...m)));
ed.hashes.sha512 = (...m) => sha512(concat(...m));
(async () => {
  const sk = ed.utils.randomSecretKey();
  const pk = await ed.getPublicKeyAsync(sk);
  console.log('SECRET (base64):', Buffer.from(sk).toString('base64'));
  console.log('PUBLIC bytes:', '[' + Array.from(pk).join(', ') + ']');
})();
"
```

- [ ] Copy the **SECRET (base64)** to a `.env.local` file (see
      Step 3 below). **NEVER commit this file.**
- [ ] Copy the **PUBLIC bytes** array.

## Step 3 — Wire env vars

Create `.env.local` in the repo root (already in `.gitignore`
under the `.env` glob? confirm with `git check-ignore .env.local` —
if it prints the path, you're safe):

```bash
# Stripe test mode
STRIPE_SECRET_KEY=sk_test_<from your Stripe dashboard>
STRIPE_WEBHOOK_SECRET=whsec_<filled in Step 4>

# License signing master key
VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64=<from Step 2>
VECTOR_LICENSE_MASTER_KID=vector-master-2026

# Public origin (for Stripe success/cancel URLs)
VECTOR_PUBLIC_ORIGIN=http://localhost:3000

# Per-SKU price ids from Step 1
VECTOR_STRIPE_PRICE_STARDUST_MONTHLY=price_xxx
VECTOR_STRIPE_PRICE_STARDUST_ANNUAL=price_xxx
VECTOR_STRIPE_PRICE_POLARIS_MONTHLY=price_xxx
VECTOR_STRIPE_PRICE_POLARIS_ANNUAL=price_xxx
VECTOR_STRIPE_PRICE_OWNER_LIFETIME=price_xxx
```

Then update `lib/licenseKeyring.ts` with the **PUBLIC bytes**
from Step 2 (replace `PRODUCTION_PUBLIC_KEY_BYTES = null` with
`new Uint8Array([29, 8, 163, ...])`):

- [ ] `lib/licenseKeyring.ts` updated with the production public
      key (you can keep this change uncommitted for the smoke
      test — DO NOT commit if the `.env.local` is for one-off
      testing).

## Step 4 — Start Stripe CLI webhook forward

In a dedicated terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a `whsec_…` value. **Copy it into `.env.local`**
under `STRIPE_WEBHOOK_SECRET`.

- [ ] `STRIPE_WEBHOOK_SECRET` set in `.env.local`.
- [ ] Stripe CLI is forwarding (leave the terminal open for the
      whole smoke test).

## Step 5 — Start the dev server

In another terminal:

```bash
npm run build && npm run start          # OR
npm run dev                              # if you want HMR
```

You should see in the server log:

```
[stripe] billing routes mounted (kid=vector-master-2026)
```

If you see `[stripe] billing routes NOT mounted`, double-check
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` +
`VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64` are all set.

- [ ] Server starts cleanly.
- [ ] Log line confirms billing routes mounted.

## Step 6 — Sanity-check create-session

In a third terminal:

```bash
INSTALL_ID=install-SMOKETEST1234567890ABCDEF1234567890
curl -sS -X POST http://localhost:3000/api/checkout/create-session \
  -H 'content-type: application/json' \
  -d "{\"tier\":\"stardust\",\"period\":\"monthly\",\"installId\":\"$INSTALL_ID\"}" \
  | jq
```

Expected output:

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_...",
  "requestId": "..."
}
```

- [ ] `url` returned starts with `https://checkout.stripe.com`.
- [ ] `sessionId` returned starts with `cs_test_`.

If you get a 503, double-check the `VECTOR_STRIPE_PRICE_*` env
vars match the price ids you copied from Step 1.

## Step 7 — Walk the full flow in the browser

- [ ] Open <http://localhost:3000>.
- [ ] Tap "Initialize" → set up a master password (any value;
      we're testing billing, not crypto).
- [ ] Open Settings → "Subscription" section appears.
- [ ] Note the **install id** displayed in Settings (you'll
      compare it to the one in Stripe metadata later).
- [ ] Click "Upgrade" → PricingPage opens. Verify:
  - [ ] Three tier cards (Stardust / Polaris / Owner) are visible.
  - [ ] Prices render as `$X.XX USD` with the literal `USD` suffix.
  - [ ] Toggle to annual → Stardust shows `$49.90 USD`, Polaris
        shows `$99.90 USD`, Owner unchanged.
  - [ ] Footer says "Powered by Stripe" / "由 Stripe 处理付款".
- [ ] Click "Subscribe" on Stardust monthly.
- [ ] Browser redirects to Stripe Checkout (`checkout.stripe.com`).
  - [ ] Header shows the SKU name + `$4.99 USD` total.
- [ ] Pay with the test card:
  - Card number: `4242 4242 4242 4242`
  - Expiry: any future date (e.g. `12/30`)
  - CVC: any 3 digits (e.g. `123`)
  - Name + email: any
  - Country / postal: any (Stripe test mode accepts everything)
- [ ] Click "Subscribe".

In the Stripe CLI terminal you should see:

```
checkout.session.completed → 200 OK
```

In the dev server log you should see:

```
[stripe] minted token { requestId: '...', sessionId: 'cs_test_...', tier: 'stardust', period: 'monthly' }
```

The browser auto-redirects to `http://localhost:3000/?activate_session_id=cs_test_…`.

Within ~3 seconds the URL should clean to `http://localhost:3000/`
(via `history.replaceState`).

- [ ] Open Settings again → "Subscription" section now shows:
  - [ ] Tier badge: `STARDUST` (instead of `FREE`).
  - [ ] Expires: ~32 days from now (the monthly TTL).
- [ ] Quotas now reflect Stardust limits (try opening the
      Persona Builder; it should NOT show the Free-tier paywall).

## Step 8 — Verify cancel flow

- [ ] Open Settings → click "Change plan" → PricingPage opens.
- [ ] Click Subscribe on a different SKU (e.g. Polaris annual).
- [ ] On the Stripe page, click the back arrow OR navigate to
      the cancel link.
- [ ] Browser lands on `http://localhost:3000/?activate_cancelled=1`.
- [ ] Within a moment the URL cleans to `http://localhost:3000/`.
- [ ] Settings → "Subscription" still shows Stardust (cancel
      did NOT touch the existing license).

## Step 9 — Verify install-id binding

- [ ] In a different browser profile / incognito window, open
      <http://localhost:3000>. This new install gets a different
      `install-...` id.
- [ ] Open Settings → "Subscription" → paste the token you got
      from Step 7 (you can copy it from the URL **before** it
      gets cleaned, or you can read it from the IDB blob via
      DevTools).
- [ ] Settings shows the failure banner: "此 Token 是为另一台
      设备签发的(install id 不匹配)" / "This token was issued
      for a different device".

This proves `payload.sub === installId` enforcement works.

## Step 10 — Verify webhook signature reject

In a fourth terminal:

```bash
curl -sS -X POST http://localhost:3000/api/stripe/webhook \
  -H 'content-type: application/json' \
  -H 'stripe-signature: t=1,v1=00000' \
  -d '{}' \
  -i
```

Expected: `HTTP/1.1 400 Bad Request` + body `invalid signature`.

- [ ] 400 returned.
- [ ] Server log shows `[stripe] webhook signature verify failed`.

This proves the webhook is rejecting forged signatures.

## Step 11 — Cleanup

- [ ] Stop the dev server (Ctrl+C).
- [ ] Stop Stripe CLI (Ctrl+C).
- [ ] **Delete `.env.local`** OR move it to your secret store.
- [ ] **Revert any uncommitted change to `lib/licenseKeyring.ts`**
      (your production public key shouldn't be committed in this
      smoke-test cycle):
      `bash
    git checkout lib/licenseKeyring.ts
    `
- [ ] Optionally: delete the test-mode products from Stripe
      dashboard (you'll re-create them in live mode for
      production with different price ids).

## What this smoke test proves

If all 11 steps pass:

✅ Stripe Checkout integration is live in test mode.
✅ Webhook signature verify works (raw-body ingestion is correct).
✅ License minting + token roundtrip works end-to-end.
✅ Install-id binding works (token is bound to the device).
✅ URL hijack + auto-activation works.
✅ Pricing page displays USD prices correctly.
✅ Tier upgrade is reflected in paywall predicates.

## Security note: no auth on /api/checkout/\* by design

The Phase 5.2 Stripe routes (`create-session`, `claim-token`) do
NOT require auth. This is intentional:

- `create-session` doesn't charge anyone (Stripe collects payment).
  An attacker can only DoS our Stripe API quota, not steal tokens.
- `claim-token` returns a token bound to a specific install id
  (`payload.sub === installId`). Even if an attacker races the
  legitimate user to claim a token, the token won't verify on
  their device.
- Adding token-based auth here would defeat the "anonymous
  install id only" privacy posture (we'd need to issue a session
  token to authenticate, which is yet-more identity to track).

If you want stricter policy in production:

- Rate-limit the routes via the existing `morningStarLimiter`
  pattern (Phase 5.3 candidate).
- Add an HMAC-signed `install_proof` header the client computes
  from its install id + a per-server pepper (more work, marginal
  benefit).

## What this smoke test does NOT cover

- **Live mode** — once test mode passes, you swap `sk_test_…`
  for `sk_live_…` and re-create the price ids in live mode.
- **Customer Portal** — Phase 5.3 work; cancellation /
  renewal / refund webhooks land then.
- **Multi-instance webhook race** — the in-memory session→token
  cache only works for single-instance deploys. Multi-instance
  deploys need Redis (Phase 5.3+).
- **Webhook delivery on AWS / Cloudflare / Vercel edge** —
  `express.raw` works in standard Node; some edge runtimes
  parse bodies differently. Test in your actual prod
  environment before going live.

## Troubleshooting

| Symptom                                         | Likely cause                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `503 SKU not configured`                        | `VECTOR_STRIPE_PRICE_*` env var missing or empty                                                                                   |
| `Stripe rejected the session creation`          | `STRIPE_SECRET_KEY` invalid or test/live mismatch                                                                                  |
| Webhook never fires                             | Stripe CLI not running OR firewall / port mismatch                                                                                 |
| `webhook signature verify failed`               | `STRIPE_WEBHOOK_SECRET` doesn't match the CLI's whsec                                                                              |
| Token comes back but `currentTier` stays `free` | install id mismatch (compare Settings vs URL)                                                                                      |
| `unknown-kid` after activate                    | `lib/licenseKeyring.ts` doesn't have the production public key OR `VECTOR_LICENSE_MASTER_KID` doesn't match the kid in the keyring |
