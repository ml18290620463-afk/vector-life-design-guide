import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Edit3, Fingerprint, ShieldOff, Trash2, X } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { TrustedDevice } from '../services/trustedDevices';
import { CyberButton } from './CyberButton';

/**
 * Phase 4 §4.b-3 follow-up (K1) — `TrustedDevicesPanel`
 *
 * Settings-mounted modal that lets the user **audit** and
 * **revoke** the Ed25519 public keys they have trusted via the
 * cross-device migration wizard's TOFU flow (`verify-trust` phase).
 *
 * Capabilities (deliberately thin):
 *   - List every trust record, most-recently-trusted first.
 *   - Show fingerprint + label + trustedAt date.
 *   - Edit label inline (pencil icon → text input → save).
 *   - Revoke a trust record (two-step "tap-to-arm,
 *     confirm-within-5s" pattern, mirrors `MemoryManagementPanel`).
 *
 * Out of scope (intentionally):
 *   - Adding trust records manually — they are only ever added via
 *     the migration wizard's verify-trust path.
 *   - Showing which device produced which migration packages —
 *     no audit log of past imports exists.
 *   - Sharing trust records across devices — out-of-scope by the
 *     zero-server tenet.
 */

interface TrustedDevicesPanelProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  trusted: readonly TrustedDevice[];
  loading?: boolean;
  onRevoke: (publicKey: string) => Promise<void> | void;
  onRelabel: (publicKey: string, nextLabel: string) => Promise<void> | void;
}

const formatDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const TrustedDevicesPanel: React.FC<TrustedDevicesPanelProps> = ({
  open,
  onClose,
  theme,
  t,
  trusted,
  loading,
  onRevoke,
  onRelabel,
}) => {
  const headerId = useId();
  // editingId: which row is in label-edit mode, plus the staged
  // input value. Save commits via onRelabel; cancel discards.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  // armedRevokeId: which row's revoke button is in "armed" state.
  // Mirrors the two-step pattern from MemoryManagementPanel.
  const [armedRevokeId, setArmedRevokeId] = useState<string | null>(null);
  const [armedAt, setArmedAt] = useState<number | null>(null);

  const startEdit = (entry: TrustedDevice) => {
    setEditingId(entry.publicKey);
    setDraftLabel(entry.label);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftLabel('');
  };
  const saveEdit = (entry: TrustedDevice) => {
    void onRelabel(entry.publicKey, draftLabel.trim());
    setEditingId(null);
    setDraftLabel('');
  };

  const handleRevokeClick = (publicKey: string) => {
    const now = Date.now();
    if (armedRevokeId === publicKey && armedAt && now - armedAt < 5000) {
      void onRevoke(publicKey);
      setArmedRevokeId(null);
      setArmedAt(null);
      return;
    }
    setArmedRevokeId(publicKey);
    setArmedAt(now);
  };

  const surface =
    theme === 'light'
      ? 'bg-vector-paper-white border-slate-200 text-vector-ink-strong'
      : 'bg-vector-night-navy border-cyan-950/60 text-cyan-100';
  const subtle = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  const inputClass = `flex-1 p-2 text-[12px] rounded-md border ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100'}`;

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
            data-testid="trusted-devices-panel"
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
              <Fingerprint className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
              <h2 id={headerId} className="text-xl font-bold tracking-wide">
                {(t.trustedDevicesTitle as string) ?? 'Trusted devices'}
              </h2>
            </div>
            <p className={`text-xs leading-relaxed ${subtle} mb-6`}>
              {(t.trustedDevicesSubtitle as string) ??
                'Public keys you have confirmed belong to one of your own devices via the migration wizard. Revoking a key forces a fresh fingerprint confirmation the next time it tries to send you a migration package.'}
            </p>

            {loading ? (
              <p className={`text-xs ${subtle}`} data-testid="trusted-devices-loading">
                {(t.trustedDevicesLoading as string) ?? 'Loading…'}
              </p>
            ) : trusted.length === 0 ? (
              <p className={`text-xs ${subtle}`} data-testid="trusted-devices-empty">
                {(t.trustedDevicesEmpty as string) ??
                  'No trusted devices yet. The first cross-device migration you confirm will land here.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-3" data-testid="trusted-devices-list">
                {trusted.map((entry) => {
                  const isEditing = editingId === entry.publicKey;
                  const isArmed =
                    armedRevokeId === entry.publicKey &&
                    armedAt !== null &&
                    Date.now() - armedAt < 5000;
                  return (
                    <li
                      key={entry.publicKey}
                      className={`p-3 rounded-md border ${theme === 'light' ? 'bg-cyan-50/30 border-cyan-100' : 'bg-vector-night-deep/30 border-cyan-900/40'}`}
                      data-testid={`trusted-devices-row-${entry.fingerprint}`}
                    >
                      <p
                        className={`text-[10px] uppercase tracking-widest mb-1 font-bold ${theme === 'light' ? 'text-cyan-700' : 'text-cyan-300'}`}
                      >
                        {entry.fingerprint}
                      </p>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={draftLabel}
                              onChange={(e) => setDraftLabel(e.target.value)}
                              autoFocus
                              maxLength={80}
                              className={inputClass}
                              data-testid={`trusted-devices-edit-input-${entry.fingerprint}`}
                            />
                            <CyberButton
                              theme={theme}
                              onClick={() => saveEdit(entry)}
                              aria-label={(t.trustedDevicesSave as string) ?? 'Save label'}
                              data-testid={`trusted-devices-save-${entry.fingerprint}`}
                            >
                              {(t.trustedDevicesSave as string) ?? 'Save'}
                            </CyberButton>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className={`text-[11px] underline-offset-4 hover:underline ${subtle}`}
                              aria-label={t.cancel ?? 'Cancel'}
                            >
                              {t.cancel ?? 'Cancel'}
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="flex-1 text-[13px] truncate">
                              {entry.label || (
                                <span className={`italic ${subtle}`}>
                                  {(t.trustedDevicesNoLabel as string) ?? '(no label)'}
                                </span>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className={`p-1 rounded-md hover:bg-cyan-500/10 ${subtle}`}
                              aria-label={(t.trustedDevicesEditLabel as string) ?? 'Edit label'}
                              data-testid={`trusted-devices-edit-${entry.fingerprint}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <p className={`text-[10px] ${subtle}`}>
                          {(t.trustedDevicesTrustedAt as string) ?? 'Trusted'}{' '}
                          {formatDate(entry.trustedAt)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRevokeClick(entry.publicKey)}
                          className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-rose-400 hover:text-rose-300"
                          aria-label={
                            (t.trustedDevicesRevokeAria as string) ?? 'Revoke trust for this device'
                          }
                          data-testid={`trusted-devices-revoke-${entry.fingerprint}`}
                        >
                          {isArmed ? (
                            <>
                              <Trash2 className="w-3 h-3" aria-hidden="true" />
                              {(t.trustedDevicesRevokeConfirm as string) ?? 'Tap again to revoke'}
                            </>
                          ) : (
                            <>
                              <ShieldOff className="w-3 h-3" aria-hidden="true" />
                              {(t.trustedDevicesRevoke as string) ?? 'Revoke'}
                            </>
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
