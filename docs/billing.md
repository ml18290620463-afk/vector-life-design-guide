# Billing & licensing (Phase 5)

> Phase 5 design doc. Companion to:
>
> - `services/licenseToken.ts` — wire format + Ed25519 verifier
> - `services/licenseStore.ts` — IDB persistence
> - `hooks/useLicense.ts` — React state
> - `lib/pricing.ts` — USD pricing single source of truth
> - `lib/licenseKeyring.ts` — embedded master public keys
> - `components/LicenseSection.tsx` — Settings UI
> - `scripts/dev-mint-license.mjs` — local dev minter

## Phase 5 phasing

Phase 5 is a 4-6 week umbrella. We ship in four discrete phases,
each independently releasable:

| Phase   | Scope                                                  | Status   |
| ------- | ------------------------------------------------------ | -------- |
| **5.1** | License token data layer (no Stripe)                   | **Done** |
| **5.2** | Pricing page + Stripe Checkout (USD)                   | Pending  |
| **5.3** | License lifecycle (renewal / cancel / Customer Portal) | Pending  |
| **5.4** | AI quota counter + soft enforcement                    | Pending  |

This doc covers **Phase 5.1**. Phases 5.2-5.4 will append their
own sections as they ship.

## Why offline tokens

VECTOR's zero-knowledge tenet says we never want a server-side
"is this user allowed?" check before serving the local UI. So
the billing flow is:

1. User pays via Stripe Checkout (Phase 5.2).
2. Stripe webhook hits a tiny VECTOR-team-operated **minter
   service** that holds an Ed25519 master private key.
3. Minter signs a JSON `LicensePayload` and returns the
   serialised token to the browser.
4. Client stores the token in IDB, verifies it locally
   against an embedded master public key, and uses the
   decoded `tier` for `quotaService` paywall checks.

After step 4 the client never talks to the licensing layer
again until the token expires.

## Currency

**All prices are USD.** This is an explicit product decision:

1. FX rounding is misleading ("¥69.99" today vs ¥71.20 tomorrow
   after a rate refresh frustrates users and creates support
   churn).
2. Stripe Checkout Sessions can be configured per currency, but
   tracking N currencies multiplies the SKU table and the
   revenue reconciliation overhead. v1 ships with a single
   currency.
3. International users care more about the absolute USD price
   than a localised string — most of our target audience
   (26-38 yo, undergrad+, ¥50/mo+ willingness) reads English
   pricing comfortably.

Display rule: render every price as `$X.XX USD` (the explicit
`USD` suffix — not just the `$` glyph — so users in CAD / AUD /
SGD / HKD jurisdictions don't mistake it for their local
currency). The i18n layer ONLY translates the surrounding copy
("month" → "月", etc.) — it never localises the number.

## Pricing matrix (locked alpha)

| Tier     | Monthly   | Annual                | Lifetime    |
| -------- | --------- | --------------------- | ----------- |
| Stardust | $4.99 USD | $49.90 USD (~17% off) | —           |
| Polaris  | $9.99 USD | $99.90 USD (~17% off) | —           |
| Owner    | —         | —                     | $199.00 USD |

Numbers may move during the alpha review window. The single
source of truth lives in `lib/pricing.ts`.

## Wire format

```
vector-license-v1.<base64url-payload>.<base64url-signature>
```

- Three dot-separated segments, mirroring JWT but without the
  header (we hard-code Ed25519 for v1; if we ever rotate to a
  different curve, the version prefix bumps to
  `vector-license-v2.…`).
- `base64url` (RFC 4648 §5) — `+` → `-`, `/` → `_`, no padding.
  Tokens are URL-safe and can be pasted into a Settings text
  field without escaping.

### Payload shape

```json
{
  "tier": "stardust" | "polaris" | "owner",
  "sub":  "anonymous-installation-uuid",
  "iat":  1714521600,
  "exp":  1746057600,
  "kid":  "vector-master-2026"
}
```

- `sub` is **the user's anonymous install id**, not an email.
  We don't want to learn the user's identity; the install id
  is what the user types in the Settings → Activate license
  form (or, in Phase 5.2, what Stripe passes in metadata).
- `kid` is the master-key id — when we rotate the signing key,
  we ship a NEW public key in the client and old tokens with
  the old `kid` continue to verify against the old key for a
  grace window.

## Install id

The install id is a random 32-char base32 string generated on
the **first** call to `getOrCreateInstallId`. It is:

- **anonymous** (not derived from any user-controlled identity
  — no email, no fingerprint).
- **per-device** (different across browser profiles, lost on
  "Wipe data").
- **embedded into the license token** as `payload.sub` when
  the user goes through Stripe Checkout. The client refuses
  tokens whose `sub` doesn't match the install id, so a leaked
  token is useless on a different device unless the user
  manually copies BOTH the token and their install id.

The install id is also displayed in Settings so users can paste
it into the Stripe Checkout form during the upgrade flow.

## Master keyring

`lib/licenseKeyring.ts` maps `kid` → 32-byte raw Ed25519 public
key. Initial keys:

- **`dev-2026`** — deterministic public key derived from the
  seed `vector-dev-license-seed-2026`. The matching private key
  is reproducible by `scripts/dev-mint-license.mjs`, so any
  developer can mint a working token locally without touching
  a server. **Accepted in EVERY build for now** — Phase 5.2
  will narrow to non-production builds once the production
  minter ships.

- **`vector-master-2026`** _(not yet shipped)_ — the production
  public key. Phase 5.2 will replace `null` with the real
  32-byte public key once the production keypair is generated
  and the private key is sealed in the minter's secret store.

### Key rotation

The keyring lookup is `kid` → `publicKey`. To rotate:

1. Generate a new keypair on the minter server (offline, sealed
   storage).
2. Add the new public key to `LICENSE_KEYRING` under a new
   `kid` (e.g. `vector-master-2027`).
3. Ship the client. Old tokens (`kid: vector-master-2026`)
   continue to verify against the old key for a grace window.
4. Migrate the minter to sign with the new private key.
5. Eventually remove the old kid from the keyring after the
   grace window ends.

## Verification flow

`services/licenseToken.verifyLicenseToken(args)` is the offline
verifier. It:

1. Splits the token into 3 segments; rejects `'malformed'` if
   the count is wrong.
2. Checks the prefix; rejects `'wrong-prefix'` if it's not
   `vector-license-v1`.
3. base64url-decodes both the payload and the signature; rejects
   `'invalid-base64'` on decode failure or `signature.length !== 64`.
4. JSON-parses the payload; rejects `'invalid-payload-json'`.
5. Validates the payload shape; rejects `'invalid-payload-shape'`
   if any required field is missing.
6. Looks up `payload.kid` in the public keyring; rejects
   `'unknown-kid'` if missing.
7. Verifies the Ed25519 signature; rejects `'invalid-signature'`
   on mismatch.
8. Compares `payload.exp` to the current time; rejects
   `'expired'` if past.

`services/licenseStore.loadLicense(installId)` adds one more
check on top of `verifyLicenseToken`:

9. `payload.sub === installId`; rejects `'install-mismatch'`
   otherwise.

`hooks/useLicense.activate(token)` runs `saveLicense` which
verifies BEFORE persisting (so a paste of garbage doesn't end
up in IDB and cause confusing follow-up errors on next load).

## Quota integration

`services/quotaService.tierFromLicense(payload)` is the bridge
between the license types (`'stardust' | 'polaris' | 'owner'`)
and the paywall predicates' `UserTier`
(`'free' | 'stardust' | 'polaris' | 'owner'`). Free is the
silent default for users without a token.

The existing predicates (`canCreateCustomPersona`,
`canCreateMemoir`, `canStartEchoChamber`, `canChatMemoir`)
already accept an optional `tier` parameter — Phase 5.4 will
wire `useLicense().currentTier` to those call sites in earnest.
For now the predicates default to `getCurrentTier()` (the
localStorage dev override), which means the existing alpha
behaviour is unchanged.

## Dev minter

```bash
# Print the dev public key (sanity-check vs licenseKeyring.ts).
npm run license:mint -- --print-pub

# Mint a 30-day Stardust token bound to a specific install id:
npm run license:mint -- \
  --install install-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --tier stardust \
  --days 30
```

The `dev-2026` private key is deliberately reproducible from a
public seed (`vector-dev-license-seed-2026`). Anyone running
this script can mint a token. That's fine for v1 because:

- In dev / alpha builds, every paywall is just a paywall-shaped
  UI affordance; AI calls are still gated by the user's own AI
  provider key.
- Production builds ship with `LICENSE_KEYRING['dev-2026']`
  intact for the alpha review window. Phase 5.2 will gate the
  dev kid on `import.meta.env.MODE !== 'production'` once the
  production minter is live.

If you need to rotate the dev seed (e.g. after the alpha
window), bump `DEV_LICENSE_SEED` in `lib/licenseKeyring.ts` AND
regenerate the embedded public key (`npm run license:mint --
--print-pub`).

## Out of scope for Phase 5.1

- Stripe Checkout Session creation (Phase 5.2 — **done**, see below).
- Stripe webhook minter (Phase 5.2 — **done**).
- Stripe Customer Portal (Phase 5.3).
- Online revocation list / refund-driven instant revocation
  (Phase 5.3).
- Server-side per-token quota counter (Phase 5.4).
- Auto-renewal flow.
- Multi-currency pricing.

---

# Phase 5.2 — Stripe Checkout (USD)

## What ships

- **`/pricing`** public landing page + Settings → Upgrade CTA.
  Shows the 5 SKUs in `$X.XX USD`, a monthly/annual toggle, a
  per-tier feature list, and a Stripe Checkout button per tier.
- **`POST /api/checkout/create-session`** — accepts `{tier,
period, installId}`, asks Stripe for a Checkout Session URL
  with the install id pinned in `metadata`, returns the URL.
- **`POST /api/stripe/webhook`** — listens for
  `checkout.session.completed`. Verifies the signature
  (raw-body required by Stripe). Mints a license token via
  `server/licenseMinter` and stashes it in an in-memory
  session→token map.
- **`POST /api/checkout/claim-token`** — the client calls this
  with the `sessionId` from the post-Stripe redirect; returns
  the freshly-minted token. Single-shot (the entry is removed
  on read).
- **`useAppBilling`** + **`useCheckoutReturn`** — React glue
  that listens to `?activate_session_id=…` / `?activate_cancelled=1`
  on mount, polls `claim-token` with backoff, hands the token
  to `useLicense.activate`, and cleans the URL via
  `history.replaceState` so the token never lands in browser
  history.

## End-to-end flow

```
┌─ user clicks Upgrade in Settings ───────────────────────────────┐
│                                                                  │
│  PricingPage opens (USD prices, period toggle)                  │
│         │                                                         │
│         ▼ click Subscribe (tier=polaris, period=annual)         │
│  POST /api/checkout/create-session                              │
│         │                                                         │
│         ▼ stripe.checkout.sessions.create({                     │
│            line_items: [{ price: env.PRICE_POLARIS_ANNUAL }],   │
│            metadata: { installId, tier, period },               │
│            success_url: '...?activate_session_id={CHECKOUT_…}',│
│            cancel_url:  '...?activate_cancelled=1',             │
│         })                                                        │
│         │                                                         │
│         ▼ window.location.assign(stripeUrl)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Stripe Checkout (USD)      │
              │  user enters card details   │
              │  Stripe charges + redirects │
              └──────────────┬──────────────┘
                             │
                             ▼
        ┌───────────────────────────────────────────────┐
        │  /?activate_session_id=cs_xxx                  │
        │                                                  │
        │  useCheckoutReturn fires on mount:              │
        │   1. POST /api/checkout/claim-token             │
        │      (with backoff for "not yet ready")         │
        │   2. license.activate(token) (in-IDB persist)   │
        │   3. history.replaceState — clean the URL       │
        │                                                  │
        │  Settings → LicenseSection now shows the new    │
        │  paid tier badge. Done.                         │
        └───────────────────────────────────────────────┘

Concurrently:
        ┌───────────────────────────────────────────────┐
        │  Stripe → POST /api/stripe/webhook              │
        │   (raw body, signature verified)                │
        │  → minter.mintToken({tier, installId, ttlSec})  │
        │  → pendingTokens.set(sessionId, { token })      │
        │  → 200 OK                                        │
        └───────────────────────────────────────────────┘
```

## Module map

| Layer           | File                                                            | Tests |
| --------------- | --------------------------------------------------------------- | ----- |
| SKU → Stripe id | `services/stripeIds.ts`                                         | 10    |
| Server signer   | `server/licenseMinter.ts`                                       | 11    |
| Routes          | `server/stripeRoutes.ts` (create-session, webhook, claim-token) | 13    |
| Server wiring   | `server.ts`                                                     | —     |
| Production gate | `lib/licenseKeyring.ts` (drops `dev-2026` in prod builds)       | 2     |
| Client svc      | `services/checkoutService.ts` (startCheckout, claimToken)       | 10    |
| UI              | `components/PricingPage.tsx`                                    | 7     |
| URL hijack      | `hooks/useCheckoutReturn.ts`                                    | 6     |
| App glue        | `hooks/useAppBilling.ts`                                        | —     |

## Env vars (production)

```bash
# Required (server)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64=<base64-32-byte-secret>

# Required (per-SKU price ids)
VECTOR_STRIPE_PRICE_STARDUST_MONTHLY=price_...
VECTOR_STRIPE_PRICE_STARDUST_ANNUAL=price_...
VECTOR_STRIPE_PRICE_POLARIS_MONTHLY=price_...
VECTOR_STRIPE_PRICE_POLARIS_ANNUAL=price_...
VECTOR_STRIPE_PRICE_OWNER_LIFETIME=price_...

# Optional
VECTOR_LICENSE_MASTER_KID=vector-master-2026   # default
VECTOR_PUBLIC_ORIGIN=https://app.example.com   # used in success_url
```

When ANY of the three required server vars is missing, the
Stripe routes are NOT registered. The pricing page handles this
gracefully via the `sku-not-configured` error code.

## Production gate for the dev kid

`lib/licenseKeyring.ts` drops the `dev-2026` kid from
`LICENSE_KEYRING` when `import.meta.env.MODE === 'production'`
(Vite rewrites this at build time). This means:

- A user who pastes a dev-minted token into a production build
  gets `unknown-kid`. Settings shows the localised
  "this build does not recognise the signing key" copy.
- Local development continues to accept dev-minted tokens.
- Phase 5.3 will add an explicit "production needs the master
  key in `LICENSE_KEYRING`" build-time check to prevent
  shipping production with neither the dev kid nor the
  production kid.

## Webhook security checklist

- [x] Raw body parser (`express.raw`) on the webhook route, not
      `express.json`.
- [x] Signature verified against `STRIPE_WEBHOOK_SECRET` via the
      Stripe SDK.
- [x] Returns 200 to Stripe even on internal mint errors (so
      Stripe doesn't bombard us with retries) but logs the
      failure with `requestId` for human follow-up.
- [x] Only handles `checkout.session.completed`; other event
      types respond 200 / "ignored".
- [x] In-memory session→token cache with 30-min TTL + 5-min
      sweeper (move to Redis in Phase 5.3 when we ship
      multi-instance).

## Out of scope for Phase 5.2

- Renewal handling (`customer.subscription.updated`) — Phase 5.3.
- Cancellation handling (`customer.subscription.deleted`) — Phase 5.3.
- Refund-driven revocation — Phase 5.3.
- Stripe Customer Portal embed — Phase 5.3.
- Per-tier feature gating in the AI proxy — Phase 5.4.
- Multi-currency support — explicitly **never** for v1.
- Promo code support — Phase 5.3+ if needed.
