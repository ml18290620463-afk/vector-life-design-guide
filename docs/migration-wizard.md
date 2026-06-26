# Cross-device migration wizard

> Phase 4.5 §E — 跨设备迁移向导. Companion design note for `services/migrationPackage.ts`,
> `hooks/useMigrationWizard.ts`, `components/MigrationExportModal.tsx`, and
> `components/MigrationImportWizard.tsx`. Privacy + terms framing in
> [`PRIVACY.md`](../PRIVACY.md) §3d and [`TERMS.md`](../TERMS.md) §3d.

## Why a wizard

The single most-requested upgrade after Phase 4 close was **"how do I move
everything to my new phone?"** Pre-§E, the answer was a 4-step manual
ritual:

1. Open Settings → Export Star Map → save the JSON file.
2. Manually carry the file to the new device (any way you choose).
3. Open the new device, set up a master password.
4. Open Settings → Import Backup → pick the file.

This worked, but had three failure modes nobody enjoyed:

- **Custom personas, Memoirs, memories, and pending letters were all
  in the same JSON since Phase 4 §5.1.A/B**, but the user had to know
  the file held all of it. Many users assumed it was "just journals"
  and re-built their persona library by hand.
- **Pending Letter Mode letters were NEVER in the regular export.** A
  user who switched devices would silently lose any "letter scheduled
  for next week" they'd written.
- **The master password did not transfer.** The user had to set up a
  fresh password on the new device, which meant existing
  PBKDF2-encrypted entries became unreadable until they manually
  re-encrypted everything.

The wizard fixes all three by bundling everything into one file with a
clear preview surface and an opt-in credential snapshot.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  source device                                                │
│                                                                │
│  Settings → "Migrate to a new device"                         │
│         │                                                       │
│         ▼                                                       │
│  MigrationExportModal                                         │
│    └─ buildMigrationPackage()                                  │
│         └─ buildBackupExport()  (v4 schema, opt-in creds)      │
│              └─ download .vectormigration file                 │
└─────────────────────────────────────────────────────────────┘

   ───── user transfers file (AirDrop / USB / cloud / …) ─────

┌─────────────────────────────────────────────────────────────┐
│  target device                                                │
│                                                                │
│  CoverScreen → "Migrate from another device"                  │
│  (or Settings → "Migrate from another device" once unlocked)  │
│         │                                                       │
│         ▼                                                       │
│  MigrationImportWizard  (uses useMigrationWizard hook)        │
│    Phase 1 — pick-file:  drop / picker → loadFromText()        │
│    Phase 2 — preview:    parseMigrationPackage() summary       │
│    Phase 3 — verifying:  SecurityService.verifyPassword()      │
│    Phase 4 — applying:   applyMigrationPackage() → all hooks   │
│    Phase 5 — done:       outcome counts + partial-failure list │
│    Phase 6 — error:      terminal failure                      │
└─────────────────────────────────────────────────────────────┘
```

### Module map

| Layer        | File                                      | Lines (logical) |
| ------------ | ----------------------------------------- | --------------- |
| Schema       | `services/dashboardExport.ts` (v4 bump)   | +30             |
| Schema       | `services/dashboardImport.ts` (v4 reader) | +35             |
| Service      | `services/migrationPackage.ts`            | ~280            |
| Hook         | `hooks/useMigrationWizard.ts`             | ~190            |
| UI (export)  | `components/MigrationExportModal.tsx`     | ~280            |
| UI (import)  | `components/MigrationImportWizard.tsx`    | ~290            |
| Wire (App)   | `App.tsx` (state + wizard mount)          | +40             |
| Wire (Cover) | `components/CoverScreen.tsx` (CTA)        | +15             |
| Wire (Sett.) | `components/SettingsPanel.tsx` (CTA row)  | +35             |
| i18n         | `i18n/locales/{zh,en}.ts`                 | ~70 keys × 2    |

## Schema v3 → v4

The backup payload grew two fields. Both are **optional** — v1/v2/v3
importers ignore them, and v4 importers reading older payloads default
them to `[]` / `undefined`.

```ts
interface BackupPayload {
  type: 'vector-vault-backup';
  schemaVersion: 4; // bumped from 3
  // ... existing fields (entries, customPersonas, memories) ...
  letters?: PendingLetter[]; // NEW v4
  passwordHashSnapshot?: string; // NEW v4 (opt-in carry)
  passwordSaltSnapshot?: string; // NEW v4 (opt-in carry)
}
```

The credential snapshot is **only** ever populated by the migration
export path — the regular `Settings → Export Star Map` flow leaves the
two fields undefined so casual backups don't carry password material.
This is enforced at the call site (`useDashboardExport` doesn't pass
`passwordHash` to `buildBackupExport`), not in the type system, but it
is a documented invariant.

## Verification code

`computeShortCode(serialized)` derives a 6-character base32 short code
from `SHA-256(packageJson)`:

- Browser path: `crypto.subtle.digest('SHA-256', body)` → first 5
  bytes → 6 base32 characters from the RFC 4648 alphabet (no padding).
- Test-env fallback: a deterministic djb2-flavoured 32-bit hash
  rendered as base36, padded to 6 chars. Tests assert determinism +
  collision avoidance, not cryptographic strength.

The code is **not** a signature. An attacker who can swap the file in
transit can also swap the displayed code on the receiving screen if
they control that screen. The code defends against accidental
corruption / "wrong file picked", which is the realistic threat model
for the local-trust transfer channels (USB, AirDrop) we recommend.

For real authenticity guarantees we tracked Ed25519 signed backups
under Phase 4 §4.b-3.

## Credential snapshot semantics

When the user checks "Include my master password" in the export modal:

1. The migration package carries `{ passwordHashSnapshot,
passwordSaltSnapshot }` (the existing `SecurityService.hashPassword`
   format — PBKDF2 OR Argon2id, since the verifier supports both).
2. On the target device, the wizard shows a password field whose
   placeholder reads "Old-device master password".
3. When the user clicks Import, the wizard runs
   `SecurityService.verifyPassword(typed, salt, hash)` BEFORE any
   data is written. A wrong password aborts the import (returning
   the user to the preview pane with a `PASSWORD_MISMATCH` banner).
4. On success, the wizard:
   - Writes the salt + hash via `savePasswordSalt` / `savePasswordHash`.
   - Sets `masterPassword=null` and `isUnlocked=false`, forcing the user
     back through MasterLock so they re-type the password (we
     deliberately do NOT auto-unlock — typing it on the new device
     cements muscle memory).

When the user does NOT include the credential snapshot:

- The migration package omits both fields.
- The target wizard skips the password input + verification step.
- The new device boots into "no password set" mode and the user can
  set a fresh password normally.

## State machine

`useMigrationWizard` exposes 6 phases:

```
pick-file ──┐
            ▼
         preview ──verifying ──applying ──done
            ▲                                │
            │                                ▼
            └──────────error◄────────────────┘
                        │
                        └──reset()──→ pick-file
```

- `pick-file` → `preview`: `loadFromText(raw)` on success.
- `pick-file` → `error`: `loadFromText(raw)` on parse failure.
- `preview` → `verifying`: `confirmAndApply()` when the package has
  credentials AND the user typed a password.
- `verifying` → `preview`: password mismatch (`PASSWORD_MISMATCH`).
- `verifying` → `applying`: password verified.
- `preview` → `applying`: directly when the package has no credentials.
- `applying` → `done`: regardless of partial errors (errors land in
  the `errors[]` array and render in the done pane).

## Error handling

| Reason / message      | Where it surfaces       |
| --------------------- | ----------------------- |
| `invalid-json`        | `error` phase banner    |
| `wrong-shape`         | `error` phase banner    |
| `wrong-type`          | `error` phase banner    |
| `unsupported-version` | `error` phase banner    |
| `count-mismatch`      | `error` phase banner    |
| `PASSWORD_MISMATCH`   | preview phase inline    |
| `PASSWORD_REQUIRED`   | preview phase inline    |
| Partial apply failure | `done` phase amber list |

`applyMigrationPackage` never throws — each callback (`onReplaceEntries`,
`onReplaceCustomPersonas`, `onReplaceMemories`, `onReplaceLetters`,
`onApplyCredentialSnapshot`) is wrapped in its own try/catch so failures
in one section don't poison the others.

## Tests

- `services/dashboardExport.test.ts` (existing, 1 case adjusted).
- `services/dashboardImport.test.ts` (5 new v4 cases).
- `services/migrationPackage.test.ts` (11 cases).
- `hooks/useMigrationWizard.test.ts` (9 cases).
- `components/MigrationExportModal.test.tsx` (3 cases).
- `components/MigrationImportWizard.test.tsx` (4 cases).

Total: **32 new tests** + 1 adjusted, taking the suite from 1063 → 1095.

## Out of scope (tracked separately)

- **Cloud relay** for the file transfer. Violates the "local-first" tenet.
- **QR-code transfer** for the file. Files are too big for QR; we
  initially considered base64-chunked QR pages (the source displays
  N codes, target reads them in sequence) but dropped it: it's a 1-
  to-2-minute UX for a flow that should take 10 seconds.
- **Ed25519 signed backups**. Tracked as Phase 4 §4.b-3.
- **Selective import** ("merge only memories, skip entries"). The
  wizard exposes only `replace` vs `merge`. Per-section toggles
  add UI complexity without a clear user need; we'll revisit if
  feedback asks for it.
- **Server-mediated rendezvous** ("type a 6-character code on both
  devices to pair"). Requires a relay server, which violates the
  zero-server tenet. The 6-char code we DO have is a passive
  checksum, not an active pairing protocol.
