import React, { useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { useMigrationWizard, type UseMigrationWizardArgs } from '../hooks/useMigrationWizard';
import { MIGRATION_FILE_ACCEPT } from '../services/migrationPackage';
import { FingerprintQr } from './FingerprintQr';

/**
 * Phase 4.5 §E (Cross-device migration wizard) —
 * `MigrationImportWizard`
 *
 * Target-side surface. Lives behind a CTA on the cover screen
 * (so users can run it BEFORE setting up a master password) and
 * also as a Settings entry (for re-imports).
 *
 * The hook owns the state machine (`useMigrationWizard`); this
 * component is presentational + form glue.
 */

interface MigrationImportWizardProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  /** Callbacks the wizard hook will use to commit the package. */
  onReplaceEntries: UseMigrationWizardArgs['onReplaceEntries'];
  onReplaceCustomPersonas?: UseMigrationWizardArgs['onReplaceCustomPersonas'];
  onReplaceMemories?: UseMigrationWizardArgs['onReplaceMemories'];
  onReplaceLetters?: UseMigrationWizardArgs['onReplaceLetters'];
  onApplyCredentialSnapshot?: UseMigrationWizardArgs['onApplyCredentialSnapshot'];
  /** Called once the wizard finishes the apply step successfully.
   *  Consumer typically routes to Dashboard / triggers re-mount. */
  onComplete?: () => void;
}

export const MigrationImportWizard: React.FC<MigrationImportWizardProps> = ({
  open,
  onClose,
  theme,
  t,
  onReplaceEntries,
  onReplaceCustomPersonas,
  onReplaceMemories,
  onReplaceLetters,
  onApplyCredentialSnapshot,
  onComplete,
}) => {
  const wizard = useMigrationWizard({
    onReplaceEntries,
    onReplaceCustomPersonas,
    onReplaceMemories,
    onReplaceLetters,
    onApplyCredentialSnapshot,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerId = useId();
  const passwordId = useId();

  React.useEffect(() => {
    if (!open) wizard.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const surface =
    theme === 'light'
      ? 'bg-vector-paper-white border-cyan-200 text-vector-ink-strong'
      : 'bg-vector-night-navy border-cyan-500/30 text-cyan-100';
  const subtle = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  const inputClass = `w-full p-3 rounded-md border ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100'} focus:outline-none focus:border-vector-cyan-neon/60`;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    await wizard.loadFromText(text);
  };

  const errorBanner = (msg: string | null) =>
    msg ? (
      <p
        role="status"
        className="text-[11px] text-rose-400 font-mono mt-2"
        data-testid="migration-wizard-error"
      >
        {(t[`migrationWizardError_${msg}`] as string | undefined) ?? msg}
      </p>
    ) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headerId}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className={`relative w-full max-w-xl border rounded-2xl p-8 my-12 shadow-2xl ${surface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close ?? 'Close'}
              className="absolute top-4 right-4 p-2 rounded-md hover:bg-cyan-500/10 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
              <h2 id={headerId} className="text-xl font-bold tracking-wide">
                {(t.migrationImportTitle as string) ?? 'Migrate from another device'}
              </h2>
            </div>

            {/* Phase 1 — pick file */}
            {wizard.phase === 'pick-file' && (
              <div className="flex flex-col gap-4">
                <p className={`text-xs leading-relaxed ${subtle}`}>
                  {(t.migrationImportPickHint as string) ??
                    'Select the .vectormigration file you exported from your old device. The file stays on this device — VECTOR never sends it to a server.'}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={MIGRATION_FILE_ACCEPT}
                  className="hidden"
                  data-testid="migration-wizard-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    void handleFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-6 rounded-md border-2 border-dashed ${theme === 'light' ? 'border-cyan-200 hover:border-cyan-300 text-cyan-700' : 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300'}`}
                  data-testid="migration-wizard-file-cta"
                >
                  <FileUp className="w-4 h-4" aria-hidden="true" />
                  {(t.migrationImportPickCta as string) ?? 'Choose a migration file'}
                </button>

                {errorBanner(wizard.errorMessage)}

                <p className={`text-[10px] leading-relaxed ${subtle} mt-4`}>
                  {(t.migrationImportPickFooter as string) ??
                    "If you haven't exported yet, open VECTOR on your old device → Settings → Migrate to a new device."}
                </p>
              </div>
            )}

            {/* Phase 2 — preview + confirm */}
            {wizard.phase === 'preview' && wizard.summary && (
              <div className="flex flex-col gap-4">
                <p className={`text-xs leading-relaxed ${subtle}`}>
                  {(t.migrationImportPreviewHint as string) ??
                    'Review what will be imported. The 6-character code below should match the one shown on your old device.'}
                </p>

                <div
                  className={`p-4 rounded-md border ${theme === 'light' ? 'bg-cyan-50/40 border-cyan-100' : 'bg-vector-night-deep/30 border-cyan-900/40'}`}
                  data-testid="migration-wizard-summary"
                >
                  <p className={`text-[10px] uppercase tracking-widest mb-1 ${subtle}`}>
                    {(t.migrationExportShortCode as string) ?? 'Verification code'}
                  </p>
                  <p className="text-2xl font-mono font-bold tracking-[0.4em] mb-3">
                    {wizard.summary.shortCode}
                  </p>
                  <ul className={`text-[12px] grid grid-cols-2 gap-y-1 ${subtle}`}>
                    <li>
                      {(t.migrationImportEntries as string) ?? 'Entries'}:{' '}
                      {wizard.summary.entriesCount}
                    </li>
                    <li>
                      {(t.migrationImportPersonas as string) ?? 'Personas'}:{' '}
                      {wizard.summary.customPersonasCount}
                    </li>
                    <li>
                      {(t.migrationImportMemoirs as string) ?? 'Memoirs'}:{' '}
                      {wizard.summary.memoirsCount}
                    </li>
                    <li>
                      {(t.migrationImportMemories as string) ?? 'Memories'}:{' '}
                      {wizard.summary.memoriesCount}
                    </li>
                    <li>
                      {(t.migrationImportLetters as string) ?? 'Letters'}:{' '}
                      {wizard.summary.lettersCount}
                    </li>
                    <li>
                      {(t.migrationImportCredentials as string) ?? 'Password'}:{' '}
                      {wizard.summary.hasCredentials
                        ? ((t.migrationImportCredsIncluded as string) ?? 'included')
                        : ((t.migrationImportCredsNone as string) ?? 'not included')}
                    </li>
                  </ul>
                </div>

                {/* Phase 4 §4.b-3 — signature badge + unsigned opt-in */}
                <SignatureBadge
                  signature={wizard.summary.signature}
                  theme={theme}
                  t={t}
                  acceptedUnsigned={wizard.acceptedUnsigned}
                  onChangeAcceptedUnsigned={wizard.setAcceptedUnsigned}
                />

                <fieldset className="flex flex-col gap-2">
                  <legend className={`text-[11px] font-bold uppercase tracking-widest ${subtle}`}>
                    {(t.migrationImportMode as string) ?? 'Mode'}
                  </legend>
                  <div className="flex gap-3" role="radiogroup">
                    {(['replace', 'merge'] as const).map((m) => (
                      <label
                        key={m}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-xs ${wizard.mode === m ? (theme === 'light' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200') : `${subtle} border-transparent`}`}
                      >
                        <input
                          type="radio"
                          name="migration-mode"
                          value={m}
                          checked={wizard.mode === m}
                          onChange={() => wizard.setMode(m)}
                          className="sr-only"
                          aria-label={(t[`migrationImportMode_${m}`] as string | undefined) ?? m}
                        />
                        {(t[`migrationImportMode_${m}`] as string | undefined) ?? m}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {wizard.summary.hasCredentials && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={passwordId}
                      className={`text-[11px] font-bold uppercase tracking-widest ${subtle}`}
                    >
                      {(t.migrationImportPasswordLabel as string) ?? 'Old device master password'}
                    </label>
                    <input
                      id={passwordId}
                      type="password"
                      autoComplete="current-password"
                      value={wizard.password}
                      onChange={(e) => wizard.setPassword(e.target.value)}
                      placeholder={(t.migrationImportPasswordPlaceholder as string) ?? '...'}
                      className={inputClass}
                      data-testid="migration-wizard-password"
                    />
                  </div>
                )}

                {errorBanner(wizard.errorMessage)}

                <div className="flex items-center justify-between gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => wizard.reset()}
                    className={`text-[11px] underline-offset-4 hover:underline ${subtle}`}
                  >
                    {(t.migrationImportPickAgain as string) ?? 'Choose a different file'}
                  </button>
                  <CyberButton
                    onClick={() => void wizard.confirmAndApply()}
                    theme={theme}
                    aria-label={(t.migrationImportApply as string) ?? 'Import'}
                    data-testid="migration-wizard-apply"
                  >
                    {(t.migrationImportApply as string) ?? 'Import'}
                  </CyberButton>
                </div>
              </div>
            )}

            {/* Phase 4 §4.b-3 — verify-trust (TOFU bootstrap). */}
            {wizard.phase === 'verify-trust' &&
              wizard.summary &&
              wizard.summary.signature.kind === 'valid' && (
                <VerifyTrustPane
                  fingerprint={wizard.summary.signature.fingerprint}
                  theme={theme}
                  t={t}
                  onAccept={(label) => void wizard.acceptTrust(label)}
                  onReject={() => wizard.rejectTrust()}
                />
              )}

            {/* Phase 3/4 — verifying / applying */}
            {(wizard.phase === 'verifying' || wizard.phase === 'applying') && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2
                  className="w-6 h-6 animate-spin text-vector-cyan-neon"
                  aria-hidden="true"
                />
                <p className={`text-sm ${subtle}`}>
                  {wizard.phase === 'verifying'
                    ? ((t.migrationImportVerifying as string) ?? 'Verifying password…')
                    : ((t.migrationImportApplying as string) ?? 'Migrating data…')}
                </p>
              </div>
            )}

            {/* Phase 5 — done */}
            {wizard.phase === 'done' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  <p className="text-sm font-bold">
                    {(t.migrationImportDone as string) ?? 'Migration complete'}
                  </p>
                </div>
                {wizard.outcome && (
                  <ul className={`text-[12px] ${subtle} grid grid-cols-2 gap-y-1`}>
                    <li>
                      {(t.migrationImportEntries as string) ?? 'Entries'}:{' '}
                      {wizard.outcome.entriesApplied}
                    </li>
                    <li>
                      {(t.migrationImportPersonas as string) ?? 'Personas'}:{' '}
                      {wizard.outcome.customPersonasApplied}
                    </li>
                    <li>
                      {(t.migrationImportMemories as string) ?? 'Memories'}:{' '}
                      {wizard.outcome.memoriesApplied}
                    </li>
                    <li>
                      {(t.migrationImportLetters as string) ?? 'Letters'}:{' '}
                      {wizard.outcome.lettersApplied}
                    </li>
                  </ul>
                )}
                {wizard.errors.length > 0 && (
                  <div
                    className={`text-[11px] font-mono p-3 rounded-md border border-amber-500/30 bg-amber-500/5`}
                  >
                    <p className="flex items-center gap-1 text-amber-500 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      {(t.migrationImportPartialFailures as string) ??
                        'Some sections did not transfer:'}
                    </p>
                    <ul className="list-disc pl-4">
                      {wizard.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <CyberButton
                    onClick={() => {
                      onComplete?.();
                      onClose();
                    }}
                    theme={theme}
                    aria-label={(t.migrationImportClose as string) ?? 'Close'}
                  >
                    {(t.migrationImportClose as string) ?? 'Continue'}
                  </CyberButton>
                </div>
              </div>
            )}

            {/* Phase 6 — terminal error */}
            {wizard.phase === 'error' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                  <p className="text-sm font-bold">
                    {(t.migrationImportFailed as string) ?? 'Could not load the file'}
                  </p>
                </div>
                <p className={`text-[11px] font-mono ${subtle}`}>{wizard.errorMessage ?? '?'}</p>
                <div className="flex items-center justify-end gap-3">
                  <CyberButton
                    onClick={() => wizard.reset()}
                    theme={theme}
                    aria-label={(t.migrationImportRetry as string) ?? 'Try again'}
                  >
                    {(t.migrationImportRetry as string) ?? 'Try again'}
                  </CyberButton>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-components (Phase 4 §4.b-3)                                    */
/* ------------------------------------------------------------------ */

interface SignatureBadgeProps {
  signature: NonNullable<ReturnType<typeof useMigrationWizard>['summary']>['signature'];
  theme: Theme;
  t: TranslationDictionary;
  acceptedUnsigned: boolean;
  onChangeAcceptedUnsigned: (value: boolean) => void;
}

const SignatureBadge: React.FC<SignatureBadgeProps> = ({
  signature,
  theme,
  t,
  acceptedUnsigned,
  onChangeAcceptedUnsigned,
}) => {
  if (signature.kind === 'valid') {
    return (
      <div
        className={`p-3 rounded-md border flex items-start gap-2 ${theme === 'light' ? 'bg-emerald-50/40 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/30'}`}
        data-testid="migration-wizard-signature-valid"
      >
        <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-500" aria-hidden="true" />
        <div className="flex-1">
          <p
            className={`text-[11px] font-bold ${theme === 'light' ? 'text-emerald-900' : 'text-emerald-200'}`}
          >
            {(t.migrationImportSignatureValid as string) ?? 'Cryptographically signed'}
          </p>
          <p
            className={`text-[10px] mt-0.5 ${theme === 'light' ? 'text-emerald-900/70' : 'text-emerald-200/70'}`}
          >
            {(t.migrationImportFingerprintFromSource as string) ?? 'From device'}
            {': '}
            <span className="font-mono">{signature.fingerprint}</span>
          </p>
        </div>
      </div>
    );
  }
  if (signature.kind === 'invalid') {
    return (
      <div
        className="p-3 rounded-md border bg-rose-500/10 border-rose-500/40"
        data-testid="migration-wizard-signature-invalid"
      >
        <p className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          {(t.migrationImportSignatureInvalid as string) ??
            'Signature is invalid — file was altered'}
        </p>
        <p className="text-[10px] mt-1 text-rose-300/80">
          {(t.migrationImportSignatureInvalidHint as string) ??
            'Re-export the file from your source device and try again.'}
        </p>
      </div>
    );
  }
  return (
    <div
      className={`p-3 rounded-md border ${theme === 'light' ? 'bg-amber-50 border-amber-300' : 'bg-amber-500/10 border-amber-500/40'}`}
      data-testid="migration-wizard-signature-unsigned"
    >
      <p className="text-[11px] text-amber-600 leading-relaxed flex items-start gap-1">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5" aria-hidden="true" />
        <span>
          {(t.migrationImportSignatureUnsigned as string) ??
            'Package is not signed. The 6-character code above is the only verification you have.'}
        </span>
      </p>
      <label className="text-[11px] mt-2 flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedUnsigned}
          onChange={(e) => onChangeAcceptedUnsigned(e.target.checked)}
          className="accent-amber-500"
          data-testid="migration-wizard-accept-unsigned"
        />
        <span>
          {(t.migrationImportAcceptUnsigned as string) ??
            'I have verified the 6-character code matches and want to import this unsigned file.'}
        </span>
      </label>
    </div>
  );
};

interface VerifyTrustPaneProps {
  fingerprint: string;
  theme: Theme;
  t: TranslationDictionary;
  onAccept: (label?: string) => void;
  onReject: () => void;
}

const VerifyTrustPane: React.FC<VerifyTrustPaneProps> = ({
  fingerprint,
  theme,
  t,
  onAccept,
  onReject,
}) => {
  const [label, setLabel] = useState('');
  const labelId = useId();
  const subtle = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  return (
    <div className="flex flex-col gap-4" data-testid="migration-wizard-verify-trust">
      <div className="flex items-center gap-2">
        <Fingerprint className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
        <p className="text-sm font-bold">
          {(t.migrationImportVerifyTrustTitle as string) ?? 'Confirm source device'}
        </p>
      </div>
      <p className={`text-xs leading-relaxed ${subtle}`}>
        {(t.migrationImportVerifyTrustHint as string) ??
          'On your source device, open Settings → Device fingerprint. The fingerprint shown there should match the one below. Only continue if the codes match.'}
      </p>
      <div
        className={`p-4 rounded-md border ${theme === 'light' ? 'bg-cyan-50/40 border-cyan-200' : 'bg-cyan-500/5 border-cyan-500/30'}`}
      >
        <p className={`text-[10px] uppercase tracking-widest mb-2 ${subtle}`}>
          {(t.migrationExportFingerprint as string) ?? 'Device fingerprint'}
        </p>
        <div className="flex items-center gap-4">
          <p className="text-xl font-mono font-bold tracking-[0.3em] flex-1">{fingerprint}</p>
          {/* K2 — QR for screen-to-screen visual compare. */}
          <FingerprintQr
            fingerprint={fingerprint}
            size={112}
            ariaLabel={
              (t.fingerprintQrAria as string | undefined)?.replace('{fingerprint}', fingerprint) ??
              `QR of fingerprint ${fingerprint}`
            }
            className={theme === 'light' ? 'text-cyan-900' : 'text-cyan-200'}
          />
        </div>
      </div>
      <label
        htmlFor={labelId}
        className={`text-[11px] font-bold uppercase tracking-widest ${subtle}`}
      >
        {(t.migrationImportTrustLabel as string) ?? 'Optional label for this device'}
      </label>
      <input
        id={labelId}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value.slice(0, 80))}
        placeholder={(t.migrationImportTrustLabelPlaceholder as string) ?? 'My old iPhone'}
        className={`w-full p-3 rounded-md border ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100'}`}
        data-testid="migration-wizard-trust-label"
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReject}
          className={`text-[11px] underline-offset-4 hover:underline ${subtle}`}
          data-testid="migration-wizard-trust-reject"
        >
          {(t.migrationImportTrustReject as string) ?? 'Codes do not match — abort'}
        </button>
        <CyberButton
          onClick={() => onAccept(label.trim() || undefined)}
          theme={theme}
          aria-label={(t.migrationImportTrustAccept as string) ?? 'Yes, this is my device'}
          data-testid="migration-wizard-trust-accept"
        >
          {(t.migrationImportTrustAccept as string) ?? 'Yes, trust this device'}
        </CyberButton>
      </div>
    </div>
  );
};
