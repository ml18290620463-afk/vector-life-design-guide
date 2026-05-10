import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyMigrationPackage,
  parseMigrationPackage,
  type ApplyMigrationArgs,
  type ApplyMigrationMode,
  type ApplyMigrationOutcome,
  type MigrationPackageSummary,
} from '../services/migrationPackage';
import { SecurityService } from '../services/securityService';
import type { BackupParseSuccess } from '../services/dashboardImport';
import { isPublicKeyTrusted, trustPublicKey } from '../services/trustedDevices';

/**
 * Phase 4.5 §E (Cross-device migration wizard) —
 * `useMigrationWizard`
 *
 * State machine + dispatch for the import side of the wizard.
 * The export side is a single-shot service call (`buildMigrationPackage`
 * → `downloadTextFile`) that doesn't need a hook.
 *
 * Wizard phases:
 *   1. `'pick-file'`  — show the file picker / drop zone.
 *   2. `'preview'`    — file parsed; show summary + ask confirm
 *                        (replace vs merge) and password.
 *   3. `'verifying'`  — verifying the entered password against the
 *                        package's credential snapshot (when present).
 *   4. `'applying'`   — calling each callback in turn.
 *   5. `'done'`       — success terminal; outcome + errors visible.
 *   6. `'error'`      — parse / verify / apply failure terminal.
 *
 * The hook deliberately doesn't own the persistence callbacks
 * (entries / personas / memories / letters / credentials). Those
 * come from the consumer (App / Settings) so the same wizard can
 * run from BOTH the Cover screen (vault still locked, no
 * `useDiaryData` mounted yet — App level wires custom shims) and
 * Settings (full-power callbacks already there).
 */

export type MigrationWizardPhase =
  | 'pick-file'
  | 'preview'
  | 'verify-trust'
  | 'verifying'
  | 'applying'
  | 'done'
  | 'error';

export interface UseMigrationWizardArgs {
  /** Persistence callbacks the wizard threads into
   *  `applyMigrationPackage`. */
  onReplaceEntries: ApplyMigrationArgs['onReplaceEntries'];
  onReplaceCustomPersonas?: ApplyMigrationArgs['onReplaceCustomPersonas'];
  onReplaceMemories?: ApplyMigrationArgs['onReplaceMemories'];
  onReplaceLetters?: ApplyMigrationArgs['onReplaceLetters'];
  /** Optional credential apply hook. When omitted (e.g. the wizard
   *  is invoked from the cover screen and the App hasn't decided
   *  the credential strategy yet), the hook silently skips the
   *  credential step even if the package carries one. */
  onApplyCredentialSnapshot?: ApplyMigrationArgs['onApplyCredentialSnapshot'];
  /** Optional `SecurityService.verifyPassword` override (tests). */
  verifyPassword?: typeof SecurityService.verifyPassword;
}

export interface UseMigrationWizardResult {
  phase: MigrationWizardPhase;
  /** Parsed package summary (only set in `preview` / `verifying`
   *  / `applying` / `done` / `error` after a successful parse). */
  summary: MigrationPackageSummary | null;
  /** Final outcome (only set in `done` / partial-error). */
  outcome: ApplyMigrationOutcome | null;
  /** Errors from the apply step (empty array when fully clean). */
  errors: string[];
  /** Last user-facing error message — surfaces parse failures,
   *  password mismatches, and apply failures. */
  errorMessage: string | null;
  /** Merge vs replace toggle, initialised to `'replace'` because
   *  the migration use case is "I just got a new device, swap
   *  everything". The wizard renders both options. */
  mode: ApplyMigrationMode;
  setMode: (mode: ApplyMigrationMode) => void;
  /** Master password the user typed on the target device. Echoes
   *  back to the wizard input (controlled). */
  password: string;
  setPassword: (value: string) => void;
  /** Step 1 → step 2 — parse a file body. */
  loadFromText: (raw: string) => Promise<void>;
  /** Step 2 → step 3+4 — verify password (when a snapshot is
   *  present) and apply. Resolves once the wizard reaches a
   *  terminal phase. */
  confirmAndApply: () => Promise<void>;
  /**
   * Phase 4 §4.b-3 — when the wizard is parked at `verify-trust`
   * the user has read the publisher's fingerprint on the source
   * device's Settings page and clicked "yes, this is mine". This
   * persists the trust + advances the wizard. Optional `label` is
   * the friendly "My old iPhone" name the user typed.
   */
  acceptTrust: (label?: string) => Promise<void>;
  /** Phase 4 §4.b-3 — opt out of trust-bootstrap (e.g. the user
   *  realised they picked the wrong file). Routes back to preview. */
  rejectTrust: () => void;
  /**
   * Phase 4 §4.b-3 — when the file is unsigned, the wizard refuses
   * to advance until the user explicitly acknowledges they trust
   * the file via this checkbox. Defaults to false.
   */
  acceptedUnsigned: boolean;
  setAcceptedUnsigned: (value: boolean) => void;
  /** Reset back to `'pick-file'` with empty state. */
  reset: () => void;
}

export const useMigrationWizard = (args: UseMigrationWizardArgs): UseMigrationWizardResult => {
  const verifyPassword =
    args.verifyPassword ?? SecurityService.verifyPassword.bind(SecurityService);

  const [phase, setPhase] = useState<MigrationWizardPhase>('pick-file');
  const [summary, setSummary] = useState<MigrationPackageSummary | null>(null);
  const [parsedPayload, setParsedPayload] = useState<BackupParseSuccess | null>(null);
  const [outcome, setOutcome] = useState<ApplyMigrationOutcome | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<ApplyMigrationMode>('replace');
  const [password, setPassword] = useState('');
  // Phase 4 §4.b-3 — known-trust cache for the currently-parsed
  // package, so we don't re-query IDB on every UI tick. Reset on
  // `loadFromText` / `reset`.
  const [trustKnown, setTrustKnown] = useState<boolean>(false);
  const [acceptedUnsigned, setAcceptedUnsigned] = useState<boolean>(false);

  const reset = useCallback(() => {
    setPhase('pick-file');
    setSummary(null);
    setParsedPayload(null);
    setOutcome(null);
    setErrors([]);
    setErrorMessage(null);
    setMode('replace');
    setPassword('');
    setTrustKnown(false);
    setAcceptedUnsigned(false);
  }, []);

  const loadFromText = useCallback(async (raw: string) => {
    setErrorMessage(null);
    setAcceptedUnsigned(false);
    setTrustKnown(false);
    const result = await parseMigrationPackage(raw);
    if (result.ok === false) {
      setPhase('error');
      setErrorMessage(result.detail || result.reason);
      return;
    }
    setSummary(result.summary);
    setParsedPayload(result.parsed);
    // Phase 4 §4.b-3 — pre-check the TOFU store so the preview pane
    // can show "✓ trusted device" inline without a second IDB roundtrip.
    if (result.summary.signature.kind === 'valid') {
      try {
        const known = await isPublicKeyTrusted(result.summary.signature.publicKey);
        setTrustKnown(known);
      } catch (err) {
        console.warn('useMigrationWizard: trust pre-check failed', err);
      }
    }
    setPhase('preview');
  }, []);

  const confirmAndApply = useCallback(async () => {
    if (!parsedPayload || !summary) {
      setErrorMessage('NO_PARSED_PAYLOAD');
      setPhase('error');
      return;
    }

    // Phase 4 §4.b-3 — signature gate (BEFORE credential / apply).
    //   - `invalid`: hard block — Apply was already disabled in UI,
    //     defensive check here.
    //   - `unsigned`: require `acceptedUnsigned` checkbox — block
    //     with a tagged error otherwise.
    //   - `valid` + already trusted: continue.
    //   - `valid` + unknown: route to `verify-trust` phase.
    const sig = summary.signature;
    if (sig.kind === 'invalid') {
      setErrorMessage('SIGNATURE_INVALID');
      return;
    }
    if (sig.kind === 'unsigned' && !acceptedUnsigned) {
      setErrorMessage('UNSIGNED_NOT_ACCEPTED');
      return;
    }
    if (sig.kind === 'valid' && !trustKnown) {
      setErrorMessage(null);
      setPhase('verify-trust');
      return;
    }

    // Step 3 — credential verification (only when both the package
    // carries a snapshot AND the user has typed a password). When
    // either is missing, skip verification: a vault that has no
    // password set on the source has nothing to verify against.
    if (
      parsedPayload.passwordHashSnapshot &&
      parsedPayload.passwordSaltSnapshot &&
      password.length > 0
    ) {
      setPhase('verifying');
      let ok = false;
      try {
        ok = await verifyPassword(
          password,
          parsedPayload.passwordSaltSnapshot,
          parsedPayload.passwordHashSnapshot,
        );
      } catch (err) {
        ok = false;
        console.warn('useMigrationWizard: verifyPassword threw', err);
      }
      if (!ok) {
        setPhase('preview');
        setErrorMessage('PASSWORD_MISMATCH');
        return;
      }
    } else if (
      parsedPayload.passwordHashSnapshot &&
      parsedPayload.passwordSaltSnapshot &&
      password.length === 0
    ) {
      // Snapshot present but user didn't type a password. Don't
      // proceed silently — the user must either type the password
      // or explicitly decide to skip credentials (a future toggle).
      setErrorMessage('PASSWORD_REQUIRED');
      return;
    }

    // Step 4 — apply.
    setErrorMessage(null);
    setPhase('applying');
    const result = await applyMigrationPackage({
      parsed: parsedPayload,
      mode,
      onReplaceEntries: args.onReplaceEntries,
      onReplaceCustomPersonas: args.onReplaceCustomPersonas,
      onReplaceMemories: args.onReplaceMemories,
      onReplaceLetters: args.onReplaceLetters,
      onApplyCredentialSnapshot: args.onApplyCredentialSnapshot,
    });
    setOutcome(result.outcome);
    setErrors(result.errors);
    setPhase('done');
  }, [
    parsedPayload,
    summary,
    password,
    mode,
    trustKnown,
    acceptedUnsigned,
    args.onReplaceEntries,
    args.onReplaceCustomPersonas,
    args.onReplaceMemories,
    args.onReplaceLetters,
    args.onApplyCredentialSnapshot,
    verifyPassword,
  ]);

  const acceptTrust = useCallback(
    async (label?: string) => {
      if (!summary || summary.signature.kind !== 'valid') return;
      try {
        await trustPublicKey(summary.signature.publicKey, label ?? '');
        setTrustKnown(true);
        // Re-trigger the apply pipeline now that the gate is past.
        setPhase('preview');
        // Defer: setPhase queues; the next confirmAndApply call from
        // the UI will re-enter the function with `trustKnown=true`.
        // We DON'T auto-call confirmAndApply here so the user retains
        // explicit control over mode / password before applying.
      } catch (err) {
        console.warn('useMigrationWizard: acceptTrust failed', err);
        setErrorMessage('TRUST_PERSIST_FAILED');
      }
    },
    [summary],
  );

  const rejectTrust = useCallback(() => {
    setPhase('preview');
    setErrorMessage('TRUST_REJECTED');
  }, []);

  // Phase 4 §4.b-3 — when the user accepts trust, advance the
  // wizard with the next confirmAndApply call. We auto-trigger
  // it from a useEffect so the user perceives "Yes → done"
  // without an extra click.
  useEffect(() => {
    if (phase === 'preview' && trustKnown && !errorMessage) {
      // No-op: wait for the user's explicit Apply tap. The trust
      // banner now shows "✓ trusted" and the Apply button works
      // normally. (We considered auto-applying after acceptTrust,
      // but the user needs to confirm mode + password first.)
    }
  }, [phase, trustKnown, errorMessage]);

  return useMemo(
    () => ({
      phase,
      summary,
      outcome,
      errors,
      errorMessage,
      mode,
      setMode,
      password,
      setPassword,
      loadFromText,
      confirmAndApply,
      acceptTrust,
      rejectTrust,
      acceptedUnsigned,
      setAcceptedUnsigned,
      reset,
    }),
    [
      phase,
      summary,
      outcome,
      errors,
      errorMessage,
      mode,
      password,
      loadFromText,
      confirmAndApply,
      acceptTrust,
      rejectTrust,
      acceptedUnsigned,
      reset,
    ],
  );
};
