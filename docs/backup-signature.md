# Backup integrity (Ed25519 signed migration packages)

> Phase 4 §4.b-3. Companion design note for `services/deviceKeypair.ts`,
> `services/backupSignature.ts`, `services/trustedDevices.ts`, and the
> Phase 4.5 §E migration wizard's verify-trust phase. Privacy framing
> in [`PRIVACY.md`](../PRIVACY.md) §3e and [`TERMS.md`](../TERMS.md) §3e.

## Why a signature

Phase 4.5 §E shipped the cross-device migration wizard with a
6-character `shortCode` (SHA-256 → base32) so users could confirm
"this is the right file" between devices. We were honest about its
limits in §3d:

> The 6-character verification code shown by the wizard is an
> informational checksum, NOT a cryptographic signature. It helps
> you spot accidental corruption or "wrong file picked", but does
> NOT defend against an attacker who can also alter the displayed code.

§4.b-3 closes that gap. Each device gets its own Ed25519 keypair
the first time the user sets a master password. The migration export
flow signs the payload with the device's secret key and embeds the
public key + signature alongside the data. The receiving device runs
`Ed25519.verify(...)` and routes off the result.

The threat model we now defend against:

- An attacker who can replace the file in transit (compromised cloud
  drive, MITM email).
- A user who downloads the wrong file by accident (still detected via
  the short-code, but now confirmed by signature too).
- A bit-rot / silent corruption in transit (any single byte flip
  invalidates the signature).

Out-of-scope (deliberately):

- An attacker who has the user's source-device IndexedDB blob
  AND the master password. With both, the attacker IS the user — no
  scheme can defend against compromise of the keypair itself.
- An attacker who can compromise the receiving device's TOFU store.
  We rely on the user trusting their own physical control of the
  target device.

## Why Ed25519 (vs HMAC, RSA, Web Crypto native)

| Option              | Verdict                                                           |
| ------------------- | ----------------------------------------------------------------- |
| HMAC + shared key   | Rejected: rendezvous problem (how do new devices get the secret?) |
| RSA-2048+ signature | Rejected: 256-byte signature, 256-byte key, slow on mobile        |
| Web Crypto Ed25519  | Rejected: Safari < 17 missing, format quirks (raw vs PKCS8)       |
| `@noble/ed25519`    | **Picked**: ~5 KB pure-JS, audited, uniform across runtimes       |

`@noble/ed25519` has been audited by Cure53 (2022) + multiple
independent reviewers. Total dep-tree cost: ~5 KB minified for
ed25519 + ~6 KB for `@noble/hashes` (SHA-512 needed by ed25519's
signing algorithm).

## Module map

| Layer         | File                                          | LOC          |
| ------------- | --------------------------------------------- | ------------ |
| Crypto wire   | `services/edBootstrap.ts`                     | ~30          |
| Keypair       | `services/deviceKeypair.ts`                   | ~210         |
| Sign / verify | `services/backupSignature.ts`                 | ~170         |
| Trust store   | `services/trustedDevices.ts`                  | ~150         |
| Schema        | `services/dashboardExport.ts` (v4 → v5)       | +5           |
| Wizard        | `hooks/useMigrationWizard.ts` (+verify-trust) | +60          |
| Wizard        | `services/migrationPackage.ts` (+sign/verify) | +90          |
| UI (export)   | `components/MigrationExportModal.tsx`         | +40          |
| UI (import)   | `components/MigrationImportWizard.tsx`        | +130         |
| UI (settings) | `components/SettingsPanel.tsx`                | +30          |
| App wiring    | `App.tsx` (+ensure / regen / unlock-sign)     | +60          |
| i18n          | `i18n/locales/{zh,en}.ts`                     | +35 keys × 2 |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  source device                                                    │
│                                                                    │
│  Onboarding / first unlock:                                       │
│    handleSetPassword(pw) → ensureDeviceKeypair(pw)                │
│      └─ noble.utils.randomSecretKey() → 32-byte secret             │
│      └─ noble.getPublicKeyAsync(secret) → 32-byte public           │
│      └─ SecurityService.encrypt(secret, pw) → encryptedSecret     │
│      └─ idb.set('vector_master_vault_device_keypair', { ... })    │
│                                                                    │
│  Settings → Migrate to a new device:                              │
│    MigrationExportModal opens                                     │
│      onUnlockSigningKey() → unlockSecretKey(pw) → 32-byte secret  │
│      buildMigrationPackage({ ..., signingSecretKey, signingPub }) │
│        └─ buildBackupExport(...) → unsignedBody (canonical JSON)  │
│        └─ signBackup({ unsignedBody, secretKey, publicKey })       │
│          └─ noble.signAsync(encode(unsignedBody), secretKey)       │
│          └─ injects { signature, publicKey } into top of JSON      │
│        └─ computeShortCode(signedBody)                            │
│      Modal shows: shortCode + fingerprint + Download CTA          │
└─────────────────────────────────────────────────────────────────┘

   ───── user transfers .vectormigration file ─────

┌─────────────────────────────────────────────────────────────────┐
│  target device                                                    │
│                                                                    │
│  CoverScreen → Migrate from another device → file picker          │
│    useMigrationWizard.loadFromText(raw)                            │
│      parseMigrationPackage(raw)                                   │
│        └─ parseBackupImport (v5 schema, accepts signature fields) │
│        └─ verifyBackup(raw)                                       │
│          ├─ valid:    summary.signature = { kind: 'valid', ... }  │
│          ├─ unsigned: summary.signature = { kind: 'unsigned' }    │
│          └─ invalid:  summary.signature = { kind: 'invalid', ... }│
│        └─ trustKnown = isPublicKeyTrusted(publicKey)              │
│      Wizard renders preview pane with:                            │
│        - Green badge: "Cryptographically signed (from <fp>)"      │
│        - Amber: "Not signed; check the box to continue"           │
│        - Red:   "Signature invalid; refuse"                       │
│                                                                    │
│  User clicks Apply:                                                │
│    Signature gate (BEFORE password / apply):                      │
│      invalid                  → block with SIGNATURE_INVALID       │
│      unsigned + !accepted     → block with UNSIGNED_NOT_ACCEPTED   │
│      valid + !trustKnown      → route to verify-trust phase        │
│      valid + trustKnown       → continue to credential / apply     │
│                                                                    │
│  verify-trust phase:                                               │
│    Show fingerprint + label input + accept/reject CTAs.            │
│    acceptTrust(label) → trustPublicKey(pk, label) → preview        │
│    rejectTrust()      → preview with TRUST_REJECTED banner         │
└─────────────────────────────────────────────────────────────────┘
```

## Schema v4 → v5

Two new optional top-level fields:

```ts
interface BackupPayload {
  type: 'vector-vault-backup';
  schemaVersion: 5; // bumped from 4
  signature?: string; // NEW v5 — base64 64-byte Ed25519 signature
  publicKey?: string; // NEW v5 — base64 32-byte raw Ed25519 public key
  // ...all v4 fields...
}
```

Backwards-compatible:

- v1-v4 importers ignore the new fields.
- v5 importers reading a v4 file see `signature: undefined`,
  treat the file as `signature.kind = 'unsigned'`, and route through
  the "user must check the unsigned-accept box" gate.
- An unsigned v5 file (signing material missing on source) is still
  valid; same fallback path as a v4 file.

## What gets signed

The signature covers the **canonical body** — the unsigned
`buildBackupExport` output as a UTF-8-encoded byte string. The
signer:

1. Calls `buildBackupExport({ ... })` → unsigned 2-space-indent JSON.
2. Calls `signBackup({ unsignedBody, secretKey, publicKey })`.
3. The result is a re-stringified object with `signature` + `publicKey`
   inserted as top-level siblings, in the order:
   `{ type, schemaVersion, signature, publicKey, ...rest }`.

The verifier:

1. Parses the file.
2. Captures `signature` + `publicKey`.
3. Removes those two keys from the parsed object.
4. Re-stringifies the rest with `null, 2` indent.
5. Calls `Ed25519.verify(signature, encode(reconstructedBody), publicKey)`.

This works **without** a formal canonicalization spec (JCS / RFC 8785)
because:

- ECMAScript guarantees insertion-order iteration of string keys
  (since ES2015), so `JSON.stringify` is deterministic.
- We control both ends of the wire.

If we ever interop with a non-VECTOR signer, swapping in JCS is a
one-line change in `backupSignature.ts`.

## Fingerprint format

`fingerprintFromPublicKey(publicKey)` →
`SHA-512(publicKey)[0..12] → base32 → 16 chars → ABCD-EFGH-IJKL-MNOP`.

96 bits of fingerprint is plenty for the local "did I just hand-copy
the right code" threat model and short enough to read across two
screens. The base32 alphabet (RFC 4648 capital letters + 2-7) avoids
the `0/O`, `1/I/l` ambiguity that base16 would have.

## TOFU (trust-on-first-use) trust store

`services/trustedDevices.ts` is a CRUD wrapper around an IDB-backed
list of `{ publicKey, fingerprint, label, trustedAt }` records.

Lifecycle:

1. **First import** from an unknown publicKey → wizard parks at
   `verify-trust` phase, shows the fingerprint, asks the user to
   read it from their old device's Settings page, optionally label
   the source ("My old iPhone").
2. User taps **Yes, trust this device** → `trustPublicKey(pk, label)`
   adds the record; wizard resumes.
3. **Subsequent imports** from the same publicKey → `isPublicKeyTrusted`
   returns true → `verify-trust` phase is skipped entirely.
4. **Rotate keys** on the source device (Settings → Regenerate device
   keys) → new publicKey → old packages are now "unknown publisher"
   on receiving devices and re-trigger TOFU.

Out-of-scope for v1: a Settings UI to view / revoke trusted devices.
The data layer (`listTrustedDevices`, `revokeTrustedPublicKey`) is
ready; surfacing it is a follow-up sprint.

## Key rotation + revocation

The user can hit **Settings → Regenerate device keys** at any time.
This wipes the existing keypair and mints a fresh one. Effects:

- Migration packages signed by the OLD keypair will now verify with
  a key that nobody trusts on the receiving device → `verify-trust`
  phase fires fresh.
- The old publicKey may still be trusted on other devices that
  imported from it before the rotation. Those entries are stale
  but harmless (they trust a key whose secret no longer exists).

We deliberately don't ship a centralised "revoke this key everywhere"
path — that would require a relay server, which violates the
zero-server tenet.

## Tests

- `services/deviceKeypair.test.ts` — 10 cases (mint, idempotent,
  regenerate, public-only load, secret unlock + wrong-password,
  fingerprint stability).
- `services/backupSignature.test.ts` — 11 cases (sign/verify
  roundtrip, key order, tamper, swapped publicKey, 4 error reasons,
  isBodySigned 3 branches).
- `services/trustedDevices.test.ts` — 14 cases (hydrate, addTrust,
  isTrusted, revokeTrust, IDB roundtrip, sort, idempotent revoke).
- `services/migrationPackage.test.ts` — 4 new cases (sig roundtrip,
  unsigned, tampered, fallback).
- `hooks/useMigrationWizard.test.ts` — 7 new cases (unsigned
  block + accept, verify-trust route, accept/reject trust, trusted
  skip, tampered block).
- `components/MigrationImportWizard.test.tsx` — 4 new cases (badge
  variants, verify-trust pane).

Total: **50 new tests** (1095 → 1145).

## Out of scope for §4.b-3

- Multi-device trust **graph** (existing trusted device endorses a
  new one). Too complex for v1.
- ~~Trust list UI in Settings (data layer ready; surface in
  follow-up).~~ **Done by §4.b-3 follow-up K1** —
  `components/TrustedDevicesPanel.tsx` + `hooks/useTrustedDevices.ts`
  added the audit / revoke / relabel surface, mounted at App level
  and reachable from Settings.
- HSM / WebAuthn-backed private keys.
- Transparency log for issued keypairs.
- Key compromise recovery beyond "rotate + re-import".
- Test-env subtle.crypto for keypair generation (`@noble/ed25519`
  works uniformly in node / happy-dom; we use `fake-indexeddb` to
  give the keypair store a real IDB to talk to in tests).

## Phase 4 §4.b-3 follow-ups (K1 + K2)

A 1.5-day sprint that closes two ergonomic gaps in the original
§4.b-3 ship.

### K1 · Trusted devices audit panel

The original §4.b-3 ship persisted trust records to
`vector_master_vault_trusted_devices` but had no surface for the
user to inspect / revoke them. K1 adds:

- **`services/trustedDevices.ts`** — new pure helper
  `relabelTrust(trusted, publicKey, nextLabel)` that updates a
  record's label without touching `trustedAt`. Returns the same
  array reference when the label is unchanged or the key is absent
  (cheap no-op for React renders). Plus an IDB-backed wrapper
  `relabelTrustedPublicKey(publicKey, nextLabel)`.
- **`hooks/useTrustedDevices.ts`** — React hook with optimistic
  local update + IDB persistence. Exposes `trusted`, `loading`,
  `reload`, `revoke`, `relabel`. The wizard's TOFU path
  (`trustPublicKey` from `services/trustedDevices.ts`) writes
  directly to IDB; this hook calls `reload()` on panel open so
  newly-trusted entries appear without a hard refresh.
- **`components/TrustedDevicesPanel.tsx`** — modal listing every
  trusted public key, most-recently-trusted first, with:
  - Fingerprint chip (`ABCD-EFGH-IJKL-MNOP` font-mono).
  - Inline label edit (pencil icon → text input → Save).
  - Revoke action with the same two-step "tap-to-arm,
    confirm-within-5s" pattern used by `MemoryManagementPanel`.
- **App wiring** — `App.tsx` mounts the panel at root, exposes
  `setShowTrustedDevices` via `Dashboard` →
  `DashboardSettingsModal` → `SettingsPanel`. The Settings device
  fingerprint chip gains a "Trusted devices" link next to
  "Regenerate device keys".
- **i18n** — 11 new keys per locale.

What's still out of scope for the panel (deliberately minimal):

- Adding trust records manually — the migration wizard's
  verify-trust phase is the only entry point.
- Per-package audit log ("which packages did this device send me?")
  — no audit log of past imports exists.
- Cross-device trust sync — violates the zero-server tenet.

### K2 · Fingerprint QR codes

The 16-character fingerprint (`ABCD-EFGH-IJKL-MNOP`) is short
enough to read, but reading 16 base32 chars across two screens
still has a non-trivial error rate ("did the user say `O` or
`0`?"). Visual side-by-side QR comparison is dramatically faster
and harder to get wrong.

- **Library**: `qrcode-svg` (~10 KB minified pure-JS, no canvas
  dependency, generates inline SVG strings). Picked over `qrcode`
  (~46 KB) because we just need to display 16 chars; canvas /
  dataURL conversions would be overkill.
- **`lib/fingerprintQr.ts`** — pure encoder
  `fingerprintToQrSvg(fingerprint, options)`. Uses ECC level `M`
  (~15% redundancy, plenty for screen-to-screen viewing distance),
  zero padding, and `currentColor` foreground / `transparent`
  background so the QR adopts the parent's text colour
  automatically (no theme palette lookup at render time). Strips
  the leading `<?xml ...?>` declaration since React refuses it
  inside `dangerouslySetInnerHTML`.
- **`components/FingerprintQr.tsx`** — `useMemo`-wrapped React
  component. Renders the SVG via `dangerouslySetInnerHTML` (safe
  because the input is a fingerprint we just produced + the
  generator is non-templating). Exposes `aria-label` for screen
  readers; the data is also displayed adjacent to the QR in every
  consumer surface so the QR is purely a visual aid.
- **Three consumer surfaces**:
  - **`MigrationExportModal`** — when a signed package is built,
    the success pane shows the fingerprint string side-by-side
    with an 88 px QR.
  - **`MigrationImportWizard.VerifyTrustPane`** — the verify-trust
    phase shows the incoming package's fingerprint side-by-side
    with a 112 px QR (slightly larger so the user can grab their
    other phone and visually compare).
  - **`SettingsPanel` device fingerprint chip** — an 80 px QR
    next to the user's own device fingerprint, so they can scan
    it from another device with any QR app.
- **What's NOT scanning**: the QR is a "compare two pictures"
  aid. We don't ship a QR scanner because:
  - Both fingerprints are human-readable strings; the user can
    always cross-check by reading.
  - A scanner would need camera permissions + a heavy library
    and adds zero security (the fingerprint is a public checksum;
    encoding it as a QR doesn't authenticate it).
  - Future sprint can add scanning if the visual-compare workflow
    proves slower than expected.
