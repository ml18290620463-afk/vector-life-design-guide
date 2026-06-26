# Phase 5 — Architecture decision document

> **Status**: Approved by the user on 2026-05-03.
> **Owner**: VECTOR maintainer.
> **Companion docs**: [`phase-5-sku-matrix.md`](./phase-5-sku-matrix.md),
> [`phase-5-quota-rewrite.md`](./phase-5-quota-rewrite.md),
> [`product-vision-2026Q2.md`](./product-vision-2026Q2.md) §6
> ("Commercial model"), [`PRIVACY.md`](../PRIVACY.md),
> [`TERMS.md`](../TERMS.md).
> **Status of code**: This is a **decision-only document**. Phase 5
> code starts in §5.1. No production secrets are checked in.

This document locks the architecture for VECTOR's commercialisation
phase. It is the **single source of truth** every later Phase 5
sprint (§5.1 - §5.9) reads from. Changes here require an explicit
re-approval; sub-sprints don't get to retroactively change billing
provider, SKU shape, account model, or the zero-knowledge invariant.

---

## 1 · The five locked-in decisions

| Dimension              | Choice                                       | Locked on  |
| ---------------------- | -------------------------------------------- | ---------- |
| Billing provider       | **Stripe**                                   | 2026-05-03 |
| Subscription tiers     | **Free / Pro / Owner** (3-tier)              | 2026-05-03 |
| Quota model            | **Monthly quota** (Free 5 calls / Pro ∞)     | 2026-05-03 |
| Account model          | **Email + password**                         | 2026-05-03 |
| Phase 5 launch cadence | **Decision-only first**, code after sign-off | 2026-05-03 |

### 1.1 · Why Stripe

Picked over Paddle because:

- **Documentation + ecosystem** — `stripe-node` is mature, the
  webhook tooling is well-known, the dashboard is the industry
  baseline so onboarding new contributors is one-line ("read
  Stripe's docs").
- **China card support** — Stripe accepts UnionPay / Alipay / WeChat
  Pay through the same Checkout flow. Paddle's Chinese coverage is
  spottier.
- **Cancellation UX** — Stripe Customer Portal gives users a
  zero-build cancellation page. We don't have to design our own.

Trade-offs we accept:

- We are merchant-of-record (so we owe sales tax / VAT in some
  jurisdictions). Mitigated for v1 by **only selling to mainland
  China + global English-speaking users without explicit VAT
  registration**; if German / French sales become non-trivial we
  swap to Paddle as a follow-up sprint (the tier / quota / account
  layers are abstracted so the swap is bounded).

### 1.2 · Why 3 tiers

The existing `services/quotaService.ts` has 4 tiers (Free /
Stardust / Polaris / Owner). User picked the simpler 3-tier shape
to lower v1 conversion-decision cost. The rewrite plan lives in
[`phase-5-quota-rewrite.md`](./phase-5-quota-rewrite.md); the SKU
detail lives in [`phase-5-sku-matrix.md`](./phase-5-sku-matrix.md).

Summary:

- **Free** — full editor / archive / Echo Chamber free tier blocked.
  Limited Memoir feature (read-only on existing memoirs, no new
  Memoir creation, no Memoir chat). Morning Star: 5 calls / month.
- **Pro** — everything Free has + Persona Builder + Memoir
  unlimited + Echo Chamber + Letter Mode unlimited. Morning Star:
  unlimited. **¥58 / month** or **¥468 / year** (~33% off annual).
- **Owner** — same features as Pro, **lifetime** (no monthly
  payment). One-time **¥1880**. Pitched at long-term users who
  want to support the project + lock in a price ceiling.

Owner is intentionally NOT a higher feature tier than Pro — it's
the same features, paid differently. This is the lesson from
Phase 4: we don't have features-of-features that are only
unlocked above Pro.

### 1.3 · Why monthly quota (vs feature-gate / credits)

Feature-gate ("Pro = unlimited Memoir") is the simplest user
proposition but wastes the natural "you've used 4 of 5 free
Morning Stars this month" upgrade trigger. Credits are too cute
(users hate counting tokens).

Monthly quota threads the middle:

- **Free** users get a real taste (5 Morning Star / month, 1 free
  Memoir read, 0 Memoir chat). Enough to feel value, not enough
  for daily use.
- **Pro / Owner** users get unlimited (the only ceiling is fair-use
  rate limiting we already have).
- The server tracks **counter + monthly reset**, NOT call content.
  See §3 below for the privacy posture.

Why a 30-day rolling window vs calendar month: rolling window
avoids the "everyone hammers the API on the 1st" problem and
gives us slightly smoother infrastructure load. The cost is a
slightly more complex counter (per-user rolling window in Redis or
SQLite). Acceptable.

### 1.4 · Why email + password (vs magic-link / device-token)

This was the decision under most internal pressure because it
contradicts our zero-knowledge instinct. The reasoning:

- **Magic link** is ergonomically rough on mobile (deep-link
  handling differs across iOS / Android / WeChat browser). Users
  who can't get the email click reliably will churn.
- **Device-token bound to deviceKeypair** is the most
  zero-knowledge-pure but breaks the moment the user switches
  devices (we'd need a rescue path → which becomes email anyway).
- **Email + password** is what every user already understands.
  Two-factor + recovery codes + password reset are well-trodden
  paths.

Mitigations to keep the zero-knowledge story honest:

- The account password is for the **billing** account, NOT for
  the local vault. The vault password (via §4.b-3 Argon2id) stays
  100% local and unrelated. We tell users this explicitly in
  Settings: "this is your subscription account, not your vault
  password".
- The account row in the server DB stores `email`, `passwordHash`
  (Argon2id, same KDF as the local vault for code reuse), `tier`,
  `tierExpiresAt`. **No content fields**. See §3.
- Passwords are NEVER used to encrypt anything; they only
  authenticate the email-owner to the billing API.

### 1.5 · Why decision-only first (vs dive into code)

Phase 5 is the first time we touch:

- A persistent server-side database.
- A third-party payment API.
- User account state.
- Content that has real-money downstream consequences.

A bad decision in §5.0 (e.g. "let's use Magic Links") that gets
discovered in §5.4 ("oh, mobile WeChat browser doesn't deep-link
back") costs 3-5 days of rework. Two days of decision-locking
upfront prevents that.

---

## 2 · The system shape

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL CLIENT (browser / PWA)                                     │
│                                                                    │
│  Vault layer (UNCHANGED, zero-knowledge invariant intact):       │
│    - IndexedDB: entries, memories, letters, custom-personas,     │
│      device keypair (§4.b-3), trusted-devices (§4.b-3 K1)        │
│    - All encryption / decryption local                            │
│    - Vault password NEVER leaves device                           │
│                                                                    │
│  Subscription layer (NEW in §5.1):                                │
│    - localStorage: cached `tier`, `tierExpiresAt`, `quotaUsage`   │
│    - useSubscription() hook polls server every 60s                │
│      (or on app focus, whichever comes first)                     │
│    - Optimistic UI: paywall judged client-side using cache       │
│    - Real enforcement: every Morning Star / Memoir / Echo        │
│      Chamber call goes through the server proxy, which           │
│      double-checks the quota                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS only,
                            │ NO content payloads except AI prompts
                            │ (which already cross to the AI proxy)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVER (Express, already exists at server.ts)                    │
│                                                                    │
│  Existing surfaces (Phase 4):                                    │
│    - /api/morning-star (AI proxy)                                │
│    - /api/persona-build, /api/memoir-build                        │
│    - /api/memoir-extract, /api/echo-chamber                       │
│                                                                    │
│  NEW Phase 5 surfaces:                                            │
│    - POST /api/account/signup                                    │
│    - POST /api/account/login (returns short-lived JWT)           │
│    - POST /api/account/logout                                     │
│    - POST /api/account/password-reset-request                    │
│    - POST /api/account/password-reset-confirm                    │
│    - GET  /api/account/me  (current tier + quota usage)          │
│    - POST /api/billing/checkout-session  (Stripe Checkout URL)   │
│    - POST /api/billing/portal-session   (Stripe Customer Portal) │
│    - POST /api/billing/webhook  (Stripe → us, signature-verified)│
│                                                                    │
│  Persistence:                                                     │
│    - SQLite (better-sqlite3) for v1 — single file, easy ops      │
│    - Schema: accounts, subscriptions, quota_usage, audit_log     │
│    - Migrate to Postgres if / when we hit the operations limit   │
│                                                                    │
│  Auth wrapper:                                                    │
│    - JWT (HS256, 30-day refresh + 1-hour access)                 │
│    - Stored in httpOnly cookie + SameSite=Lax                    │
│    - Every NEW endpoint above requires the access token          │
│    - Existing /api/morning-star etc. keep their own auth (the    │
│      rate-limiter + provider-config gate from Phase 3),          │
│      but ALSO grow a subscription-tier check — see §4 below.     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Stripe webhooks
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STRIPE                                                           │
│  - Hosts Checkout + Customer Portal                              │
│  - Sends webhooks: customer.subscription.{created, updated,      │
│    deleted}, invoice.{payment_succeeded, payment_failed}         │
│  - Source of truth for "did the user actually pay?"              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3 · The privacy posture (the thing we cannot get wrong)

VECTOR's brand is "your journal never leaves your device". Phase 5
introduces a server-side component for the first time. The bright
line we draw and TEST FOR:

### What the server stores

| Table             | Fields                                                                                                                                               | Why                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `accounts`        | `id, email, passwordHash, createdAt, updatedAt`                                                                                                      | Identify the billing customer |
| `subscriptions`   | `id, accountId, stripeCustomerId, stripeSubscriptionId, tier, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt` | Drive paywall decisions       |
| `quota_usage`     | `accountId, monthBucket, morningStarCalls, memoirChats, echoChamberCalls, lastReset`                                                                 | Enforce monthly quotas        |
| `audit_log`       | `id, accountId, eventType, payloadJson, createdAt`                                                                                                   | Debugging + compliance        |
| `password_resets` | `id, accountId, tokenHash, expiresAt`                                                                                                                | Password reset flow           |

### What the server NEVER stores

- Journal entries, custom personas, memoirs, memories, letters,
  attachments, ANYTHING the user types into the editor.
- The vault password.
- Stripe payment details (card number, etc.) — Stripe holds those.
- IP addresses (we strip them at the reverse-proxy layer).
- User-agent strings beyond the bare "is this a bot" check.
- Telemetry pings, analytics events, error stack traces with user
  data. Server logs use the existing Phase 3 `scrubLog` helper.

### The invariant test

A new `scripts/check-zero-knowledge.sh` runs in CI for every
Phase 5 sprint. It does an `rg` over `server/**/*.ts` for forbidden
strings (`entry.content`, `memory.body`, `letter.body`, etc.) and
fails the build when any are found outside of an explicit allow-list
(currently empty). This is paranoid by design — better to prove the
absence of leakage than to assume it.

---

## 4 · The paywall enforcement model

### Layer 1 — Client-side optimism (UX speed)

`services/quotaService.ts` keeps its current shape. The
`getCurrentTier()` resolver gets a new branch: when the
`useSubscription` hook has cached a server-confirmed tier, return
that; otherwise fall back to the existing dev-tier override; finally
default to `'free'`. This is the FAST PATH — paywall verdicts render
without a server round-trip.

### Layer 2 — Server-side enforcement (correctness)

Every existing AI-touching endpoint (`/api/morning-star`,
`/api/persona-build`, `/api/memoir-build`, `/api/memoir-extract`,
`/api/echo-chamber`) grows a new middleware: `requireSubscription({
minTier: 'pro', feature: 'morning-star' })`. The middleware:

1. Resolves the JWT from the cookie.
2. Looks up the account's current subscription tier.
3. Increments + checks the monthly counter for the named feature.
4. Returns 402 Payment Required (with a structured JSON body the
   client uses to surface the upgrade modal) when the user is over
   quota OR not on the required tier.

The existing rate-limiter and provider-config gate are preserved
**before** the subscription check — a free-tier user trying to
exhaust the AI provider via a script gets rate-limited first, paid
users gets the paywall second. Order matters: rate-limit is a
fairness defence, paywall is a commercial defence.

### Layer 3 — Stripe webhook reconciliation (truth)

When Stripe sends `customer.subscription.updated` or
`invoice.payment_failed`, the webhook handler:

1. Verifies the signature against `STRIPE_WEBHOOK_SECRET`.
2. Locates the `subscriptions` row by `stripeSubscriptionId`.
3. Updates `tier`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`
   based on the event.
4. Inserts an `audit_log` row.
5. **Does NOT** invalidate any client cache directly — the client
   re-polls every 60 s, so the worst the user sees is a 60-second
   window where a cancelled subscription still grants Pro features
   on their device. Acceptable.

The webhook is idempotent on `event.id` (we keep a 30-day Redis or
in-memory log of processed event ids).

---

## 5 · The migration plan from "no server account" to "server account"

Existing pre-Phase-5 users:

- Have a fully functional local vault.
- Have NO server account.
- See "Free tier" everywhere — no behavioural change.

When we ship Phase 5:

- A new "Account" tab appears in Settings (existing tabs
  unchanged).
- Empty state: "You haven't connected your VECTOR account yet —
  signing up is optional and only unlocks Pro features. Your local
  vault stays exactly where it is, untouched, regardless of
  whether you sign up."
- "Sign up" CTA → email + password form → `POST /api/account/signup`.
- "Log in" CTA → email + password form → `POST /api/account/login`.
- After login, the existing `useSubscription` hook polls once,
  cache populates, paywalled features unlock.

We do **NOT** auto-link the local vault to the account. The vault is
identified by IDB; the account is identified by email. They never
meet in our database. If the user wipes their account, the vault
still works (drops to Free tier). If the user wipes their vault,
their account still works (paid features become available again the
moment they create a new vault).

---

## 6 · The deployment shape

### v1 (this Phase 5)

- Single Express process (the existing `server.ts`).
- SQLite file at `${VECTOR_DATA_DIR}/vector.sqlite`.
- Manual backups via cron + `sqlite3 .backup`.
- Single region (decision deferred until §5.9).

### v2 (Phase 6+, NOT this Phase 5)

- Postgres on a managed host.
- Multi-region read replicas if needed.
- Sentry for server-side errors (Phase 3 already wired, but the new
  endpoints get their own breadcrumb categories).

### Secrets we will need (NEVER checked in)

- `STRIPE_SECRET_KEY` (live + test)
- `STRIPE_WEBHOOK_SECRET` (live + test)
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_OWNER_LIFETIME_PRICE_ID`
- `JWT_SECRET` (for the account access token)
- `VECTOR_DATA_DIR` (where SQLite lives)
- Email transactional provider key (Postmark or Resend, decision
  deferred to §5.6 — they have similar APIs, picking is a 1-hour
  call, not a 1-day decision).

`.env.example` will list all of these with sensible test defaults.
The existing `scripts/check-beta.sh` will gain a "no real Stripe
keys committed" assertion.

---

## 7 · Sprint breakdown — final timeline

| Sprint | Title                                        | Estimate  | Deliverable                                                     |
| ------ | -------------------------------------------- | --------- | --------------------------------------------------------------- |
| §5.0   | Decision + architecture (this document)      | 0.5 d     | This file + sku-matrix + quota-rewrite docs                     |
| §5.1   | Server skeleton + accounts + DB              | 2 d       | SQLite + accounts + JWT + signup/login routes (no Stripe yet)   |
| §5.2   | Stripe Checkout + webhook                    | 2 d       | Live Stripe test-mode flow, signature-verified webhook          |
| §5.3   | Client `useSubscription` + cache + UI hooks  | 1.5 d     | Settings → Account tab, paywall modals call `/api/account/me`   |
| §5.4   | Quota counter + 402 enforcement + replay     | 1.5 d     | Server middleware on all AI endpoints, monthly reset job        |
| §5.5   | Account UX polish + password reset           | 1.5 d     | Forgot-password flow + Settings → "this is not your vault" copy |
| §5.6   | Email transactional pipeline                 | 1 d       | Welcome / receipt / quota-warning / password-reset emails       |
| §5.7   | Internal admin (read-only)                   | 1 d       | `/admin` route behind a single env-var bypass token             |
| §5.8   | Legal + docs full pass                       | 1 d       | TERMS § Account/Billing, PRIVACY § Server, refund policy        |
| §5.9   | Staging dress rehearsal + production rollout | 1 d       | Stripe live mode toggled, full e2e checklist, beta-gate clean   |
|        | **TOTAL**                                    | **~13 d** |                                                                 |

---

## 8 · What is explicitly OUT of Phase 5

- Team / family plans (one account = one user).
- Discount codes / referral system.
- A / B testing the paywall copy.
- Mobile-app-store billing (App Store / Play Store IAP).
- Crypto payments.
- An admin UI beyond read-only.
- Proactive refund policy (we'll honour requests case-by-case via
  Stripe Dashboard for v1; documented in TERMS but no automated
  flow).
- Multi-currency display (Stripe will charge in CNY for mainland
  China / USD for everywhere else; the UI shows what Stripe shows).
- Internationalisation of the new account / billing UI beyond the
  existing zh / en pair (other locales already inherit zh fallback
  per the long-standing drift).
