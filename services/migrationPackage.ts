import type { CustomPersona, DiaryEntry, Memory, PendingLetter } from '../types';
import { buildBackupExport } from './dashboardExport';
import {
  parseBackupImport,
  isBackupParseFailure,
  type BackupParseResult,
  type BackupParseSuccess,
} from './dashboardImport';
import { signBackup, verifyBackup, isBodySigned } from './backupSignature';
import { fingerprintFromPublicKey } from './deviceKeypair';

/**
 * Phase 4.5 §E (Cross-device migration wizard) —
 * `services/migrationPackage.ts`
 *
 * The complete-device handoff. Sister to `dashboardExport.ts` /
 * `dashboardImport.ts`, but with a single, opinionated bundle:
 * **everything** (entries + custom personas + memories + pending
 * letters + the password hash + salt) goes in one file. The
 * receiving device can unlock with the SAME master password the
 * source device used.
 *
 * Why a separate service vs reusing the regular Settings export:
 *   - The regular export deliberately **omits** the credential
 *     snapshot so casual backups never carry password material.
 *   - The migration export bundles the credential snapshot so the
 *     wizard can validate the password client-side BEFORE applying
 *     the import (so the user knows immediately if they typed it
 *     wrong, rather than discovering after the import that every
 *     entry is unreadable).
 *   - A wizard preview surface needs a structural summary
 *     (`MigrationPackageSummary`) the regular import flow doesn't
 *     surface — `entriesCount` / `memoirsCount` / `memoriesCount`
 *     etc. so the user knows what they're about to overwrite.
 *
 * Privacy posture: the package is local-only. The wizard writes a
 * file the user transfers manually (file upload, AirDrop, USB) —
 * no cloud, no QR code transit at this sprint. The 6-character
 * "shortCode" is a checksum of the package body so the user can
 * confirm "this is the right file" on the receiving device
 * without opening it.
 *
 * The shortCode is purely informational — it does NOT authenticate
 * the file (an attacker who controls the network can swap the
 * file AND the displayed shortCode). For real integrity, see
 * Phase 4 §4.b-3 (Ed25519 signed backups).
 */

const ENCODER = new TextEncoder();

/** Build a stable 6-character base32-ish short code from the
 *  serialized package. Used by the wizard so source + target
 *  devices can confirm "this is the same file".
 *
 *  Algorithm: SHA-256 → base32 → first 6 chars. SHA-256 is
 *  available in `crypto.subtle` in every browser we ship to AND
 *  in node ≥ 16 via the same API. */
export const computeShortCode = async (serialized: string): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Test-env fallback. Returns a deterministic-but-not-secure
    // checksum so unit tests don't have to mock subtle crypto.
    let h = 5381;
    for (let i = 0; i < serialized.length; i += 1) {
      h = ((h << 5) + h + serialized.charCodeAt(i)) >>> 0;
    }
    return h.toString(36).toUpperCase().padStart(6, 'X').slice(0, 6);
  }
  const buf = await crypto.subtle.digest('SHA-256', ENCODER.encode(serialized));
  // Base32 RFC 4648 alphabet, no padding.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[bytes[i] & 0x1f];
  }
  out += alphabet[bytes[4] >> 3];
  out += alphabet[((bytes[4] & 0x07) << 2) | (bytes[5] >> 6)];
  return out;
};

/* ------------------------------------------------------------------ */
/*  Build (source device)                                              */
/* ------------------------------------------------------------------ */

export interface BuildMigrationPackageArgs {
  version: string;
  entries: readonly DiaryEntry[];
  currentUser: string | null;
  customPersonas: readonly CustomPersona[];
  memories: readonly Memory[];
  letters: readonly PendingLetter[];
  /** Source device's password hash + salt. The wizard validates
   *  these client-side before applying the import. */
  passwordHash: string | null;
  passwordSalt: string | null;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
  /**
   * Phase 4 §4.b-3 — Ed25519 signing material from
   * `services/deviceKeypair.ts`. When BOTH fields are present, the
   * package is signed (schemaVersion 5 + `signature` + `publicKey`
   * sibling fields injected via `signBackup`). When either is null
   * — e.g. the device has no keypair yet, or the user opted out —
   * the package is left unsigned (schemaVersion is still 5; the
   * importer falls back to short-code-only verification).
   *
   * Signing is opt-in at the call site (App / Dashboard) so a
   * pre-§4.b-3 user without a keypair can still produce migration
   * packages without forcing them into key generation.
   */
  signingSecretKey?: Uint8Array | null;
  signingPublicKey?: string | null;
}

export interface MigrationPackage {
  /** Serialized JSON ready to write to disk. */
  content: string;
  /** Suggested filename (carries `.vectormigration` extension so
   *  the file picker on the target side can filter). */
  filename: string;
  /** 6-char informational checksum the user can read aloud /
   *  compare visually between source and target devices. */
  shortCode: string;
  /** Whether the package carries the credential snapshot. False
   *  if the source device has no password set yet (the migration
   *  is still legal — the target just won't auto-unlock). */
  hasCredentials: boolean;
  /** Phase 4 §4.b-3 — whether the package is Ed25519-signed. False
   *  when the source device has no keypair yet OR signing was
   *  explicitly skipped at build time. */
  isSigned: boolean;
  /** Phase 4 §4.b-3 — 16-char fingerprint of the signing public
   *  key (`fingerprintFromPublicKey`) when signed, else null.
   *  The export modal displays this so the user can read it on
   *  the target device's confirmation prompt. */
  fingerprint: string | null;
}

const exportTimestamp = (now = new Date()) => now.toISOString().replace(/[:.]/g, '-');
const exportUser = (currentUser: string | null) =>
  (currentUser || 'GUEST').toUpperCase().replace('@', '_');

export const buildMigrationPackage = async (
  args: BuildMigrationPackageArgs,
): Promise<MigrationPackage> => {
  const { content: unsignedContent } = buildBackupExport({
    version: args.version,
    entries: args.entries as DiaryEntry[],
    currentUser: args.currentUser,
    now: args.now,
    customPersonas: args.customPersonas as CustomPersona[],
    memories: args.memories as Memory[],
    letters: args.letters as PendingLetter[],
    // Credential snapshot: only carried when both fields are
    // present. The wizard's source-side surface decides whether
    // to even offer the option (greyed out when the user has no
    // password set, since there's nothing to snapshot).
    passwordHashSnapshot: args.passwordHash ?? undefined,
    passwordSaltSnapshot: args.passwordSalt ?? undefined,
  });

  // Phase 4 §4.b-3 — sign opportunistically. When the device has
  // no keypair (signing material missing), fall back to unsigned
  // — the importer's verify phase reports `unsigned` and the user
  // gets the v4-style "short-code-only" warning.
  let content = unsignedContent;
  let isSigned = false;
  let fingerprint: string | null = null;
  if (args.signingSecretKey && args.signingPublicKey) {
    try {
      const { signedBody } = await signBackup({
        unsignedBody: unsignedContent,
        secretKey: args.signingSecretKey,
        publicKey: args.signingPublicKey,
      });
      content = signedBody;
      isSigned = true;
      fingerprint = fingerprintFromPublicKey(args.signingPublicKey);
    } catch (err) {
      console.warn('migrationPackage: signing failed, falling back to unsigned', err);
    }
  }

  const shortCode = await computeShortCode(content);
  const filename = `VECTOR_${exportUser(args.currentUser)}_MIGRATION_${exportTimestamp(args.now)}.vectormigration`;
  return {
    content,
    filename,
    shortCode,
    hasCredentials: !!args.passwordHash && !!args.passwordSalt,
    isSigned,
    fingerprint,
  };
};

/* ------------------------------------------------------------------ */
/*  Preview (target device, before commit)                             */
/* ------------------------------------------------------------------ */

export type MigrationSignatureStatus =
  | { kind: 'unsigned' }
  | {
      kind: 'valid';
      publicKey: string;
      fingerprint: string;
    }
  | {
      kind: 'invalid';
      reason: 'malformed-signature' | 'malformed-public-key' | 'signature-invalid';
    };

export interface MigrationPackageSummary {
  schemaVersion: number;
  exportedAt?: string;
  sourceVersion?: string;
  entriesCount: number;
  customPersonasCount: number;
  memoirsCount: number;
  memoriesCount: number;
  lettersCount: number;
  hasCredentials: boolean;
  /** Recomputed at parse time so the wizard can show "this file
   *  matches the code your old device shows: ABCDEF". */
  shortCode: string;
  /** Phase 4 §4.b-3 — signature verification outcome. The wizard
   *  routes off this:
   *    - `unsigned` → show v4-style short-code-only warning.
   *    - `valid` → check `trustedDevices`; if known, auto-pass; if
   *      unknown, ask user "is this your device with fingerprint
   *      `ABCD-EFGH-IJKL-MNOP`?" then add to TOFU on confirm.
   *    - `invalid` → hard-block import; the file has been altered
   *      OR was signed by a corrupted key. */
  signature: MigrationSignatureStatus;
}

export type ParseMigrationPackageResult =
  | { ok: true; summary: MigrationPackageSummary; parsed: BackupParseSuccess }
  | { ok: false; reason: string; detail?: string };

/**
 * Parse a `.vectormigration` (or `.json`) file body into a
 * `MigrationPackageSummary` ready for the wizard's preview screen.
 *
 * We deliberately funnel through `parseBackupImport` rather than
 * re-implementing schema validation — they share the `v4`
 * payload shape, so the parser stays in one place. The wrapper
 * just adds the human-friendly `summary` object on top.
 */
export const parseMigrationPackage = async (
  serialized: string,
): Promise<ParseMigrationPackageResult> => {
  const parsed: BackupParseResult = parseBackupImport(serialized);
  if (isBackupParseFailure(parsed)) {
    return { ok: false, reason: parsed.reason, detail: parsed.detail };
  }
  // Recompute the short code from the raw text so the wizard can
  // display it on the target side. The exporter uses the same
  // serialization (vite's JSON.stringify with 2-space indent), so
  // the codes match byte-for-byte.
  const shortCode = await computeShortCode(serialized);
  const memoirsCount = parsed.customPersonas.filter((p) => p.kind === 'memoir').length;
  const customPersonasCount = parsed.customPersonas.length - memoirsCount;

  // Phase 4 §4.b-3 — signature evaluation. We deliberately don't
  // FAIL the parse here when the signature is invalid; the wizard
  // routes off `summary.signature.kind` so the user-visible error
  // surface stays consistent with the other wizard reasons.
  let signature: MigrationSignatureStatus;
  if (!isBodySigned(serialized)) {
    signature = { kind: 'unsigned' };
  } else {
    const verdict = await verifyBackup(serialized);
    if (verdict.ok === true) {
      signature = {
        kind: 'valid',
        publicKey: verdict.publicKey,
        fingerprint: fingerprintFromPublicKey(verdict.publicKey),
      };
    } else if (verdict.reason === 'unsigned') {
      // verifyBackup says "unsigned" → the parsed object lost the
      // sig field somewhere; treat as unsigned for the wizard.
      signature = { kind: 'unsigned' };
    } else {
      signature = { kind: 'invalid', reason: verdict.reason };
    }
  }

  return {
    ok: true,
    parsed,
    summary: {
      schemaVersion: parsed.meta.schemaVersion ?? 1,
      exportedAt: parsed.meta.exportedAt,
      sourceVersion: parsed.meta.version,
      entriesCount: parsed.entries.length,
      customPersonasCount,
      memoirsCount,
      memoriesCount: parsed.memories.length,
      lettersCount: parsed.letters.length,
      hasCredentials: !!parsed.passwordHashSnapshot && !!parsed.passwordSaltSnapshot,
      shortCode,
      signature,
    },
  };
};

/* ------------------------------------------------------------------ */
/*  Apply (target device, after user confirms)                         */
/* ------------------------------------------------------------------ */

export type ApplyMigrationMode = 'replace' | 'merge';

export interface ApplyMigrationArgs {
  parsed: BackupParseSuccess;
  mode: ApplyMigrationMode;
  /** Persistence callbacks the wizard wires from the App-level
   *  hooks. Each is async to mirror their real signatures. */
  onReplaceEntries: (entries: DiaryEntry[], mode: 'merge' | 'replace') => Promise<unknown>;
  onReplaceCustomPersonas?: (personas: CustomPersona[]) => Promise<void> | void;
  onReplaceMemories?: (memories: Memory[]) => Promise<void> | void;
  onReplaceLetters?: (letters: PendingLetter[]) => Promise<void> | void;
  /** Wire the credential snapshot. Only called when the package
   *  carries one. */
  onApplyCredentialSnapshot?: (hash: string, salt: string) => Promise<void> | void;
}

export interface ApplyMigrationOutcome {
  entriesApplied: number;
  customPersonasApplied: number;
  memoriesApplied: number;
  lettersApplied: number;
  credentialApplied: boolean;
}

/** Apply a parsed migration package to the device. Each callback
 *  is fire-and-await; failures inside any single callback are
 *  caught and reported via the `errors` array — the function
 *  never throws to the caller so the wizard can surface partial
 *  successes (e.g. "entries imported, but custom personas
 *  failed: <reason>"). */
export const applyMigrationPackage = async (
  args: ApplyMigrationArgs,
): Promise<{ outcome: ApplyMigrationOutcome; errors: string[] }> => {
  const errors: string[] = [];
  const outcome: ApplyMigrationOutcome = {
    entriesApplied: 0,
    customPersonasApplied: 0,
    memoriesApplied: 0,
    lettersApplied: 0,
    credentialApplied: false,
  };

  try {
    await args.onReplaceEntries(args.parsed.entries, args.mode);
    outcome.entriesApplied = args.parsed.entries.length;
  } catch (err) {
    errors.push(`entries: ${(err as Error).message ?? String(err)}`);
  }

  if (args.onReplaceCustomPersonas && args.parsed.customPersonas.length > 0) {
    try {
      await args.onReplaceCustomPersonas(args.parsed.customPersonas);
      outcome.customPersonasApplied = args.parsed.customPersonas.length;
    } catch (err) {
      errors.push(`customPersonas: ${(err as Error).message ?? String(err)}`);
    }
  }

  if (args.onReplaceMemories && args.parsed.memories.length > 0) {
    try {
      await args.onReplaceMemories(args.parsed.memories);
      outcome.memoriesApplied = args.parsed.memories.length;
    } catch (err) {
      errors.push(`memories: ${(err as Error).message ?? String(err)}`);
    }
  }

  if (args.onReplaceLetters && args.parsed.letters.length > 0) {
    try {
      await args.onReplaceLetters(args.parsed.letters);
      outcome.lettersApplied = args.parsed.letters.length;
    } catch (err) {
      errors.push(`letters: ${(err as Error).message ?? String(err)}`);
    }
  }

  if (
    args.onApplyCredentialSnapshot &&
    args.parsed.passwordHashSnapshot &&
    args.parsed.passwordSaltSnapshot
  ) {
    try {
      await args.onApplyCredentialSnapshot(
        args.parsed.passwordHashSnapshot,
        args.parsed.passwordSaltSnapshot,
      );
      outcome.credentialApplied = true;
    } catch (err) {
      errors.push(`credentials: ${(err as Error).message ?? String(err)}`);
    }
  }

  return { outcome, errors };
};

/** Convenience: file-extension list the file picker should accept. */
export const MIGRATION_FILE_ACCEPT = '.vectormigration,.json,application/json';
