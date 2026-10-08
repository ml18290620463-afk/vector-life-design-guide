# Argon2id Evaluation — Phase 3 §3.e

> **Status:** **SHIPPED — default-on Phase 4.5 §C (2026-05-04)**.
> **Author:** vector-life-design-guide security WG
> **Date:** 2026-05-02 (last bench run); 2026-05-04 (default-on rollout).
> **Verdict:** ✅ **GO — adopt Argon2id at OWASP_RECOMMENDED for new
> hashes; keep PBKDF2 verifier in place forever.**
>
> ## Phase 4.5 §C rollout summary
>
> The Phase 3 PoC + Phase 4 §4.b-1/§4.b-2 toggle have now been
> promoted to **default-on for all installations**. Concretely:
>
> - `SecurityService.applyArgon2idDefaults` runs once on App
>   mount and (a) sets the `vector_argon2_default_v45` migration
>   marker and (b) flips the verifier + minter flags ON when
>   they have never been touched. The marker prevents repeated
>   auto-enabling on subsequent mounts so an explicit user
>   "OFF" choice in Settings stays sticky.
> - `SecurityService.needsRehash` now returns `true` for any
>   non-Argon2id hash whenever the minter flag is on — i.e.
>   the legacy PBKDF2 hash on every existing install gets
>   flagged as needing migration as soon as §C ships.
> - `services/passwordRehash.ts::maybeRehashOnUnlock` runs as
>   fire-and-forget on the next event tick after every
>   successful unlock. When `needsRehash` is true, it
>   re-derives the hash via `SecurityService.hashPassword` (now
>   defaults to Argon2id) and persists via the supplied
>   `savePasswordHash` callback. Failures are silent: the user
>   just keeps the legacy hash for one more session.
>
> **Net effect**: every existing user transparently migrates from
> PBKDF2 → Argon2id on their next unlock without any UI prompt or
> latency penalty (the unlock UX returns immediately; the rehash
> runs in the background). Bundle cost remains zero until the
> rehash actually fires (`hash-wasm` is lazy-imported).

---

## 1 · Why we are looking at this

The current master-password pipeline
(`services/securityService.ts`) derives the AES-GCM-256 key with
**PBKDF2-SHA256 at 600 000 iterations** (`OWASP 2026` baseline). The
hash format `pbkdf2-sha256:v1:<iter>:<base64>` already records the
iteration count and the verifier already supports opportunistic
re-mint via `needsRehash()`, so the code-path is well-positioned
for a KDF upgrade.

PBKDF2's weakness is well-documented: it is **CPU-only** and
**memory-cheap**, which means a determined attacker with a GPU farm
or an ASIC sees roughly a 100×–10 000× speed-up over the defender's
single-thread CPU. The mitigation is a memory-hard KDF;
[Argon2id](https://datatracker.ietf.org/doc/html/rfc9106) is the
[OWASP-recommended choice for password storage in 2024+](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id).

This document records the proof-of-concept, the benchmark on a
representative dev machine, the migration design, and the
go/no-go decision.

---

## 2 · Threat model

VECTOR is **local-first / zero-knowledge**: ciphertext never
leaves the device unless the user explicitly exports it. The
threats Argon2id buys real protection against are:

| #   | Threat                                              | Plausibility        | PBKDF2 600k                               | Argon2id 64 MiB            |
| --- | --------------------------------------------------- | ------------------- | ----------------------------------------- | -------------------------- |
| T1  | Lost / stolen device, encrypted vault still on disk | High                | GPU offline brute-force feasible (~10⁹/s) | Memory-bound to ~10⁵/s/GPU |
| T2  | Device exfiltration via OS-level malware            | Medium              | Same as T1                                | Same as T1                 |
| T3  | Cloud sync incident (future, opt-in)                | Low (no sync today) | Same as T1                                | Same as T1                 |
| T4  | Server-side break-in                                | N/A                 | Server holds no secrets                   | Server holds no secrets    |
| T5  | Side-channel timing attack on `verify`              | Low                 | `constantTimeEqual` already in place      | Same                       |

The dominant attack is **T1 + T2**: an attacker who has the
encrypted blob plus unbounded offline compute. PBKDF2 at 600 k
iterations buys the attacker roughly the same `cost-per-guess` as
50 000 SHA-256 invocations on a high-end GPU — fast enough that
weak human-memorable passwords (≤ 11 chars, ≤ 50 bits of entropy)
fall in days. Argon2id at 64 MiB / 3 t collapses the GPU's
parallelism factor from ~3 200 cores to ~14 cores worth of
useful work (memory-bandwidth bound), an effective ~200×
slowdown for the attacker.

---

## 3 · Library choice

**`hash-wasm` 4.12** (devDep, [npm/hash-wasm](https://www.npmjs.com/package/hash-wasm))
was selected over the alternatives:

| Lib                    | Type         | ↓Bundle (gz) |    ↑Speed    |      Audit      |  Maintained   |   Verdict   |
| ---------------------- | ------------ | -----------: | :----------: | :-------------: | :-----------: | :---------: |
| **`hash-wasm`** 4.12   | WASM (32 KB) |       ~12 KB |     best     |    informal     |      ✅       | **chosen**  |
| `argon2-browser`       | WASM         |       ~28 KB |     good     |    informal     | ⚠️ stale (2y) |   reject    |
| `@noble/hashes/argon2` | pure JS      |       ~10 KB | 8–15× slower | formal (Cure53) |      ✅       | reject (UX) |
| `node:crypto.argon2id` | native       |         0 KB |     best     |     formal      |      ✅       | server only |

`@noble/hashes` is closest to ideologically right (no WASM, no
binary blob), but at OWASP_REC parameters it derives a key in
~600 ms on the same hardware — borderline for unlock UX. We
revisit when V8 / SpiderMonkey gain native WASM-tier perf on
ChaCha-style memory-hard inner loops.

The hash-wasm payload is **lazy-loaded**: `services/argon2idPoc.ts`
uses dynamic `import('hash-wasm')` so the WASM blob is only
fetched after the user opts into the new vault format
(zero impact on first-paint / cover-screen TTI).

---

## 4 · Hash format

```
argon2id:v1:<m>:<t>:<p>:<saltB64>:<hashB64>
```

| Field     | Type   | Range         | Notes                          |
| --------- | ------ | ------------- | ------------------------------ |
| `m`       | int    | 8 — 1 048 576 | Memory cost in **KiB**         |
| `t`       | int    | 1 — 32        | Iteration count                |
| `p`       | int    | 1 — 16        | Parallelism (always 1 in WASM) |
| `saltB64` | base64 | 16 bytes      | Per-mint random salt           |
| `hashB64` | base64 | 32 bytes      | Derived key bits               |

This mirrors the existing
`pbkdf2-sha256:v1:<iter>:<base64>` shape so the verifier can
multiplex on the prefix without conditional schema work in the
caller. The full self-describing layout means the verifier needs
**zero out-of-band parameter context** — every cell needed to
re-derive lives in the stored string.

---

## 5 · Benchmark

Hardware: 2025 Apple M4 / 16 GB / Node 24 / hash-wasm 4.12.
Methodology: `npm run bench:argon2` (`scripts/argon2-bench.ts`),
n=5 runs, warm-up discarded. Baseline PBKDF2 cost factor = 600 000
iterations (current production).

```text
# Argon2id vs PBKDF2 — n=5 runs (warm-up discarded)

| Configuration                          |   Mean   |    Min   |   Max    | Notes                                                |
| -------------------------------------- | -------: | -------: | -------: | ---------------------------------------------------- |
| PBKDF2-SHA256 (600,000 iter)           |  43.8 ms |  43.0 ms |  45.3 ms | WebCrypto baseline — current production cost factor  |
| Argon2id OWASP_MIN (19 MiB / 2t / 1p)  |  17.5 ms |  16.7 ms |  18.1 ms | OWASP 2024+ minimum acceptable                       |
| Argon2id OWASP_REC (64 MiB / 3t / 1p)  |  99.2 ms |  92.6 ms | 119.6 ms | Recommended for high-value secrets — VECTOR target   |
| Argon2id STRICT (128 MiB / 3t / 1p)    | 200.2 ms | 193.5 ms | 213.5 ms | Paranoid bracket — too slow for low-spec mobile UX   |
```

Translation to user-perceived latency under realistic field
conditions (browser, ARM mobile, ~2× the M4 wall time):

| Cost factor            |     Mac M4 | Pixel 6 / iPhone 12 (est.) | Pixel 4a / iPhone SE (est.) |
| ---------------------- | ---------: | -------------------------: | --------------------------: |
| PBKDF2 600k (current)  |     ~44 ms |                     ~80 ms |                     ~150 ms |
| **Argon2id OWASP_REC** | **~99 ms** |                **~180 ms** |                 **~340 ms** |
| Argon2id STRICT        |    ~200 ms |                    ~360 ms |                     ~700 ms |

**OWASP_REC is the operating point.** It buys ~5× the attacker's
memory-bound cost vs PBKDF2 and stays under the 350 ms UX
threshold (the latency budget below which an unlock animation
masks the wait) on every device class we currently support
(modern desktop Chrome / Firefox / Safari + iOS Safari 15+ +
Android Chrome 100+).

STRICT is documented for completeness but explicitly rejected —
the iPhone SE / Pixel 4a tail leaves the spinner visible and
hurts perceived responsiveness without buying a meaningful security
margin (an attacker who can pay for 64 MiB of GPU memory can pay
for 128 MiB).

---

## 6 · Migration design

The plan follows the same opportunistic re-mint pattern that we
already use for the PBKDF2 cost-factor bumps:

### 6.1 Verifier dispatch

`SecurityService.verifyPassword` becomes a multiplexer:

```
if (storedHash.startsWith('argon2id:v1'))   → verifyArgon2idPassword(...)
if (storedHash.startsWith('pbkdf2-sha256:v1')) → verifyPbkdf2Password(...)  // existing
if (storedHash.startsWith('recovery-sha256')) → … // existing recovery branch
else                                            → legacyHashPassword(...)   // existing
```

No data loss is possible because the verifier never deletes a
working hash; the worst case is "user types correct password →
old PBKDF2 hash validates → opportunistic re-mint upgrades to
Argon2id on next save".

### 6.2 Minter switch

`SecurityService.hashPassword` switches its **default minter** to
Argon2id once the rollout is approved. PBKDF2 minting is moved to
`hashPbkdf2Password` and kept available for environments where
WASM is blocked (CSP `'unsafe-eval'` denied, sandboxed iframe in
strict mode) — the verifier still understands both, but new
hashes default to Argon2id.

### 6.3 `needsRehash` extension

`needsRehash()` is extended to return `true` when:

- the stored hash starts with `pbkdf2-sha256:v1` (any iteration
  count) — i.e. **every** PBKDF2 hash is "stale" once Argon2id
  is the default;
- OR the stored hash starts with `argon2id:v1:<m>:<t>:<p>:…`
  with `m < CURRENT_M` or `t < CURRENT_T` (future-proofing for
  parameter bumps).

### 6.4 AES-GCM derivation path

`SecurityService.encrypt` / `decrypt` already takes a salt out
of the wire format (`[salt(16)][iv(12)][ciphertext]`). Switching
the KDF only affects how that salt → AES-GCM key derivation
happens. The AES-GCM ciphertext byte format stays identical, so
**existing encrypted entries and backup files keep decrypting
without re-encryption** — only the password-hash file is upgraded.

### 6.5 Backup / restore compatibility

Backup files (`vector-backup-v3.json`) carry the password hash as
a string. Importing an old backup with a `pbkdf2-sha256:v1:…`
hash works unchanged; the new device verifies via the PBKDF2
branch and (if approved) re-mints to Argon2id on the first
successful unlock.

### 6.6 Recovery key

The recovery-key path (`recovery-sha256:v1:…`) is a single
SHA-256 of the normalised key — it is **not** a password-style
KDF and does not benefit from Argon2id. No change planned.

### 6.7 Rollback

The kill switch is a single edit in `SecurityService.hashPassword`
flipping the default minter back to PBKDF2. Verification of
existing Argon2id hashes still works (the verifier always reads
the embedded parameters), so no data loss is possible.

---

## 7 · Browser compatibility matrix

| Browser                                          | WebCrypto PBKDF2 | WASM | Notes                              |
| ------------------------------------------------ | :--------------: | :--: | ---------------------------------- |
| Chrome 100+                                      |        ✅        |  ✅  | green                              |
| Firefox 100+                                     |        ✅        |  ✅  | green                              |
| Safari 15+                                       |        ✅        |  ✅  | green                              |
| iOS Safari 15+                                   |        ✅        |  ✅  | green                              |
| Chrome on Android (any modern)                   |        ✅        |  ✅  | green                              |
| Sandboxed iframe + CSP `wasm-unsafe-eval` denied |        ✅        |  ❌  | falls back to PBKDF2 minter        |
| `data:` URL embed                                |        ⚠️        |  ⚠️  | not a supported deployment surface |

Coverage gaps are the same set already documented for the
existing WebAuthn / IndexedDB usage; no new capability cliff.

---

## 8 · Risks

| Risk                                   | Likelihood | Mitigation                                                                                                               |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| WASM fetch blocked by CSP              | Low        | Lazy-load + PBKDF2 minter fallback (§6.2)                                                                                |
| `hash-wasm` becomes unmaintained       | Low        | Switch to `@noble/hashes/argon2` (slower; same hash format)                                                              |
| Tail-latency spike on low-end Android  | Medium     | OWASP_REC stays under 350 ms on tested devices; can downgrade to OWASP_MIN per device cohort if telemetry says otherwise |
| Forgotten parameter at verify-time     | None       | Parameters are embedded in the stored hash (§4)                                                                          |
| Parameter-set DoS (`m=1 GiB` injected) | Low        | `verifyArgon2idPassword` clamps `m ≤ 1 048 576` (1 GiB) before calling the KDF                                           |

---

## 9 · Decision

**✅ GO** with the following gates before flipping the default
minter:

1. **Phase 3 §3.e — DONE**: this evaluation document, the
   `hash-wasm` PoC (`services/argon2idPoc.ts`), 7 unit cases
   (`services/argon2idPoc.test.ts`) and the benchmark harness
   (`scripts/argon2-bench.ts` + `npm run bench:argon2`) — done in
   this branch. **Argon2id is NOT yet wired into the production
   auth path; this lands the infrastructure only.**
2. **Phase 3 §3.e-2** (follow-up): wire the Argon2id branch into
   `SecurityService.verifyPassword` (verifier-only, no minter
   change). Land behind a `localStorage` feature flag
   (`vector_argon2_minter`) defaulting to `false`.
3. **Phase 4** (production rollout): flip the minter default to
   Argon2id. The opportunistic-re-mint pipeline already in place
   (§6.1) handles the upgrade transparently — users see no UX
   change beyond a one-time ~50 ms unlock-latency bump.
4. **Phase 4 + N** (parameter bumps): track the OWASP recommendation
   and bump `m` / `t` annually. The format (§4) carries enough
   metadata to re-mint without ceremony.

---

## 10 · Reproducing the benchmark

```bash
# Run locally
npm run bench:argon2

# Pin the run count
VECTOR_BENCH_RUNS=10 npm run bench:argon2

# Pin the PBKDF2 baseline (default 600 000)
VECTOR_PBKDF2_ITERATIONS=1200000 npm run bench:argon2

# Machine-readable output
npm run bench:argon2 -- --json
```

The harness lives in `scripts/argon2-bench.ts` (TypeScript, run
through `tsx`). It pulls Argon2id parameters from
`services/argon2idPoc.ts` so future parameter bumps re-bench
automatically.
