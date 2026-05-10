import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Download, Fingerprint, ShieldCheck, Smartphone, X } from 'lucide-react';
import type { CustomPersona, DiaryEntry, Memory, PendingLetter, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { buildMigrationPackage, type MigrationPackage } from '../services/migrationPackage';
import { downloadTextFile } from '../services/fileDownload';
import { FingerprintQr } from './FingerprintQr';

/**
 * Phase 4.5 §E (Cross-device migration wizard) —
 * `MigrationExportModal`
 *
 * Source-side surface. Lives behind a Settings CTA — the user
 * who opens this modal is preparing to move to a new device.
 *
 * Flow:
 *   1. Modal opens with a checkbox "Include my master password
 *      (recommended for same-user migration)" — defaulted ON when
 *      the source has a password set, OFF + greyed otherwise.
 *   2. Click "Generate package" → builds the v4 backup with all
 *      personas / memories / letters / (optional) credential
 *      snapshot.
 *   3. Modal flips to a confirm pane: shows the 6-char short code
 *      + the file size + a single big "Download .vectormigration"
 *      button.
 *   4. After download, the user sees a help line: "Now open
 *      VECTOR on the new device, tap '从旧设备迁移' on the cover
 *      screen, and load this file. The 6 character code on the
 *      new device should match the one above."
 *
 * Visual posture: same warm cream / amber palette as Letter Mode
 * (this is also a "ritual transfer" surface).
 */

interface MigrationExportModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  /** Live device state piped in by the consumer (App / Settings). */
  version: string;
  entries: readonly DiaryEntry[];
  customPersonas: readonly CustomPersona[];
  memories: readonly Memory[];
  letters: readonly PendingLetter[];
  currentUser: string | null;
  passwordHash: string | null;
  passwordSalt: string | null;
  /** Phase 4 §4.b-3 — Ed25519 signing material from the device
   *  keypair. When BOTH are present, the package gets signed and
   *  the success pane displays the device fingerprint. When either
   *  is null (e.g. the device has no keypair yet), the package is
   *  produced unsigned and the modal renders an amber "no signature"
   *  warning so the user knows the receiving side will be in
   *  short-code-only verification mode. */
  signingSecretKey?: Uint8Array | null;
  signingPublicKey?: string | null;
  /** Phase 4 §4.b-3 — when the user has a keypair but it's locked
   *  (because we don't keep the master password in memory), the
   *  modal shows a small "Unlock to sign" pane that fetches the
   *  secret key on-demand. Optional: callers that already have the
   *  secret in hand pass `signingSecretKey` directly. */
  onUnlockSigningKey?: () => Promise<{ secretKey: Uint8Array; publicKey: string } | null>;
}

export const MigrationExportModal: React.FC<MigrationExportModalProps> = ({
  open,
  onClose,
  theme,
  t,
  version,
  entries,
  customPersonas,
  memories,
  letters,
  currentUser,
  passwordHash,
  passwordSalt,
  signingSecretKey,
  signingPublicKey,
  onUnlockSigningKey,
}) => {
  const [includeCredentials, setIncludeCredentials] = useState(true);
  const [building, setBuilding] = useState(false);
  const [pkg, setPkg] = useState<MigrationPackage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const headerId = useId();
  const credentialsId = useId();

  useEffect(() => {
    if (!open) return;
    setIncludeCredentials(!!passwordHash);
    setBuilding(false);
    setPkg(null);
    setErrorMessage(null);
    setDownloaded(false);
  }, [open, passwordHash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const surface =
    theme === 'light'
      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
      : 'bg-amber-500/5 border-amber-500/30 text-amber-100';
  const subtle = theme === 'light' ? 'text-amber-900/70' : 'text-amber-200/70';

  const credentialsAvailable = !!passwordHash && !!passwordSalt;

  const handleGenerate = async () => {
    setErrorMessage(null);
    setBuilding(true);
    let resolvedSecret: Uint8Array | null = signingSecretKey ?? null;
    let resolvedPublic: string | null = signingPublicKey ?? null;
    try {
      // Phase 4 §4.b-3 — when the secret key wasn't passed but an
      // unlock callback is wired, fetch the signing material on-demand.
      if (!resolvedSecret && onUnlockSigningKey) {
        const unlocked = await onUnlockSigningKey();
        if (unlocked) {
          resolvedSecret = unlocked.secretKey;
          resolvedPublic = unlocked.publicKey;
        }
      }
      const built = await buildMigrationPackage({
        version,
        entries,
        currentUser,
        customPersonas,
        memories,
        letters,
        passwordHash: includeCredentials ? passwordHash : null,
        passwordSalt: includeCredentials ? passwordSalt : null,
        signingSecretKey: resolvedSecret,
        signingPublicKey: resolvedPublic,
      });
      setPkg(built);
    } catch (err) {
      console.warn('MigrationExportModal: build failed', err);
      setErrorMessage(
        (t.migrationExportFailed as string) ?? 'Could not build the migration package.',
      );
    } finally {
      // Best-effort scrub of the on-stack secret reference.
      if (resolvedSecret) resolvedSecret.fill(0);
      setBuilding(false);
    }
  };

  const handleDownload = () => {
    if (!pkg) return;
    downloadTextFile(pkg.content, pkg.filename);
    setDownloaded(true);
  };

  const sizeKb = pkg ? Math.max(1, Math.round(pkg.content.length / 1024)) : 0;

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
              className="absolute top-4 right-4 p-2 rounded-md hover:bg-amber-500/10 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-amber-500" aria-hidden="true" />
              <h2 id={headerId} className="text-xl font-bold tracking-wide">
                {(t.migrationExportTitle as string) ?? 'Migrate to a new device'}
              </h2>
            </div>
            <p className={`text-xs leading-relaxed ${subtle} mb-6`}>
              {(t.migrationExportSubtitle as string) ??
                'This builds a single .vectormigration file that carries every entry, memoir, memory, and pending letter to your new device. Transfer the file via AirDrop, USB, or any other channel you trust — VECTOR never sends it to a server.'}
            </p>

            {!pkg && (
              <>
                <label
                  htmlFor={credentialsId}
                  aria-label={
                    (t.migrationExportIncludeCreds as string) ?? 'Include my master password'
                  }
                  className={`flex items-start gap-3 mb-6 p-3 rounded-md border cursor-pointer ${theme === 'light' ? 'bg-amber-100/40 border-amber-200' : 'bg-amber-500/5 border-amber-500/30'} ${!credentialsAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    id={credentialsId}
                    type="checkbox"
                    checked={includeCredentials && credentialsAvailable}
                    onChange={(e) => setIncludeCredentials(e.target.checked)}
                    disabled={!credentialsAvailable || building}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span className="text-[12px] leading-relaxed">
                    <span className="font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      {(t.migrationExportIncludeCreds as string) ??
                        'Include my master password (recommended)'}
                    </span>
                    <span className={`block mt-1 ${subtle}`}>
                      {credentialsAvailable
                        ? ((t.migrationExportIncludeCredsBody as string) ??
                          'When checked, the new device can unlock the migrated vault with the same master password — no separate credential transfer needed. Uncheck only if a different person will be the owner of the new device.')
                        : ((t.migrationExportNoPassword as string) ??
                          'You have no master password set, so there is no credential to carry.')}
                    </span>
                  </span>
                </label>

                {errorMessage && (
                  <p role="status" className="text-[11px] text-rose-500 font-mono mb-4">
                    {errorMessage}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={building}
                    className={`text-[11px] underline-offset-4 hover:underline ${subtle} disabled:opacity-30`}
                  >
                    {t.cancel ?? 'Cancel'}
                  </button>
                  <CyberButton
                    onClick={() => void handleGenerate()}
                    theme={theme}
                    disabled={building}
                    aria-label={(t.migrationExportGenerate as string) ?? 'Generate package'}
                  >
                    {building
                      ? ((t.migrationExportGenerating as string) ?? 'Building…')
                      : ((t.migrationExportGenerate as string) ?? 'Generate package')}
                  </CyberButton>
                </div>
              </>
            )}

            {pkg && (
              <div className="flex flex-col gap-4">
                <div
                  className={`p-4 rounded-md border ${theme === 'light' ? 'bg-white border-amber-200' : 'bg-vector-night-deep/40 border-amber-500/30'}`}
                  data-testid="migration-export-summary"
                >
                  <p className={`text-[10px] uppercase tracking-widest mb-1 ${subtle}`}>
                    {(t.migrationExportShortCode as string) ?? 'Verification code'}
                  </p>
                  <p className="text-2xl font-mono font-bold tracking-[0.4em]">{pkg.shortCode}</p>
                  <p className={`text-[11px] mt-2 ${subtle}`}>
                    {(t.migrationExportShortCodeHint as string) ??
                      'On the new device, after you load the file, you should see this same 6-character code.'}
                  </p>
                </div>

                <div className={`text-[11px] ${subtle}`}>
                  {`${entries.length} entries · ${customPersonas.length} personas · ${memories.length} memories · ${letters.length} letters · ${sizeKb} KB`}
                  {pkg.hasCredentials && (
                    <span className="ml-2 text-amber-500">
                      ✓ {(t.migrationExportCredsIncluded as string) ?? 'Password included'}
                    </span>
                  )}
                </div>

                {/* Phase 4 §4.b-3 — fingerprint surface. When the
                    package is signed, show the fingerprint so the
                    user can read it on the receiving device. When
                    unsigned, render an amber warning so the user
                    knows the receiving side will fall back to
                    short-code-only verification. */}
                {pkg.isSigned && pkg.fingerprint && (
                  <div
                    className={`p-3 rounded-md border ${theme === 'light' ? 'bg-emerald-50/40 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/30'}`}
                    data-testid="migration-export-fingerprint"
                  >
                    <p
                      className={`text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 ${subtle}`}
                    >
                      <Fingerprint className="w-3 h-3" aria-hidden="true" />
                      {(t.migrationExportFingerprint as string) ?? 'Device fingerprint'}
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-mono font-bold tracking-[0.25em] flex-1">
                        {pkg.fingerprint}
                      </p>
                      {/* K2 — QR makes the visual compare across two
                          screens basically a one-glance check. */}
                      <FingerprintQr
                        fingerprint={pkg.fingerprint}
                        size={88}
                        ariaLabel={
                          (t.fingerprintQrAria as string | undefined)?.replace(
                            '{fingerprint}',
                            pkg.fingerprint,
                          ) ?? `QR of fingerprint ${pkg.fingerprint}`
                        }
                        className={theme === 'light' ? 'text-emerald-900' : 'text-emerald-200'}
                      />
                    </div>
                    <p className={`text-[10px] mt-2 ${subtle}`}>
                      {(t.migrationExportFingerprintHint as string) ??
                        'On the new device, when the wizard asks to confirm the source, this fingerprint should match.'}
                    </p>
                  </div>
                )}
                {!pkg.isSigned && (
                  <div
                    className={`p-3 rounded-md border ${theme === 'light' ? 'bg-amber-50 border-amber-300' : 'bg-amber-500/10 border-amber-500/40'}`}
                    data-testid="migration-export-unsigned-warning"
                  >
                    <p className="text-[11px] text-amber-600 leading-relaxed">
                      {(t.migrationExportUnsignedWarning as string) ??
                        'This package is not cryptographically signed (no device key on this install). The new device can only check the 6-character code; consider regenerating device keys before exporting.'}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPkg(null);
                      setDownloaded(false);
                    }}
                    className={`text-[11px] underline-offset-4 hover:underline ${subtle}`}
                  >
                    {(t.migrationExportRebuild as string) ?? 'Rebuild'}
                  </button>
                  <CyberButton
                    onClick={handleDownload}
                    theme={theme}
                    aria-label={
                      ((t.migrationExportDownload as string) ?? 'Download') + ` (${pkg.filename})`
                    }
                  >
                    {downloaded ? (
                      <CheckCircle2 className="w-4 h-4 mr-2" aria-hidden="true" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                    )}
                    {downloaded
                      ? ((t.migrationExportDownloaded as string) ?? 'Downloaded')
                      : ((t.migrationExportDownload as string) ?? 'Download')}
                  </CyberButton>
                </div>

                {downloaded && (
                  <p
                    className={`text-[11px] leading-relaxed mt-2 ${subtle}`}
                    data-testid="migration-export-next-steps"
                  >
                    {(t.migrationExportNextSteps as string) ??
                      'Now open VECTOR on the new device, tap "Migrate from another device" on the cover screen, and load this file. The 6-character code should match.'}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
