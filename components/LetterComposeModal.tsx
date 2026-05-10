import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Mail, Send, X } from 'lucide-react';
import type { CustomPersona, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { LETTER_LIMITS } from '../services/letterService';

/**
 * Phase 4.5 §A — `LetterComposeModal`
 *
 * The compose surface for **写信模式**. Visually distinct from the
 * Memoir conversation modal:
 *   - **No AI progress bar** during compose. The point of letter
 *     mode is the user-facing *delay* — the AI doesn't run until
 *     the delivery sweep, far in the future.
 *   - Soft cream / amber palette (envelope feel) instead of the
 *     cool blue / cyan of the regular Morning Star surface.
 *   - "Send" CTA reads more like "drop in mailbox" than "submit"
 *     — labelled with a Send icon + the chosen delivery delay
 *     ("Delivers in 24 hours").
 *
 * The modal is presentational + form-state only. The Dashboard
 * wires the actual `useLetterStore.add` call via the
 * `onSendLetter` callback.
 */

export interface LetterComposeOptions {
  memoirId: string;
  body: string;
  delayMs: number;
}

interface LetterComposeModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  /** All Memoir personas the user owns. Compose modal renders a
   *  selector when there are multiple; auto-selects when there's
   *  exactly one. */
  memoirs: readonly CustomPersona[];
  /** Optional pre-selected Memoir id (e.g. "write a letter to
   *  this Memoir" entry point from Settings). When provided,
   *  the selector is hidden. */
  initialMemoirId?: string;
  /** Persist the letter. Returns `false` when validation rejected
   *  it (the modal stays open + surfaces the inline error). */
  onSendLetter: (options: LetterComposeOptions) => Promise<boolean>;
}

/** Delivery presets the modal exposes. Locked here (not in i18n)
 *  because the labels are localised but the underlying ms values
 *  are universal. The service clamps anything outside the
 *  `LETTER_LIMITS` band — these presets all sit safely inside. */
const DELAY_PRESETS: readonly { id: string; ms: number; labelKey: string }[] = [
  { id: '1h', ms: 60 * 60 * 1000, labelKey: 'letterDelay1h' },
  { id: '24h', ms: 24 * 60 * 60 * 1000, labelKey: 'letterDelay24h' },
  { id: '3d', ms: 3 * 24 * 60 * 60 * 1000, labelKey: 'letterDelay3d' },
];

const DEFAULT_DELAY_ID = '24h';

export const LetterComposeModal: React.FC<LetterComposeModalProps> = ({
  open,
  onClose,
  theme,
  t,
  memoirs,
  initialMemoirId,
  onSendLetter,
}) => {
  const [memoirId, setMemoirId] = useState<string>('');
  const [body, setBody] = useState('');
  const [delayId, setDelayId] = useState<string>(DEFAULT_DELAY_ID);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const headerId = useId();
  const bodyId = useId();
  const memoirSelectId = useId();

  // Reset form whenever the modal opens. Same posture as
  // MemoirBuilderModal — re-opening should land on a clean form.
  useEffect(() => {
    if (!open) return;
    const fallback =
      initialMemoirId && memoirs.find((m) => m.id === initialMemoirId)
        ? initialMemoirId
        : (memoirs.find((m) => m.kind === 'memoir')?.id ?? '');
    setMemoirId(fallback);
    setBody('');
    setDelayId(DEFAULT_DELAY_ID);
    setErrorMessage(null);
    setSubmitting(false);
  }, [open, initialMemoirId, memoirs]);

  // Esc closes — same posture as the Persona / Memoir builders.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const memoirOptions = memoirs.filter((m) => m.kind === 'memoir');

  const surface =
    theme === 'light'
      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
      : 'bg-amber-500/5 border-amber-500/30 text-amber-100';
  const subtle = theme === 'light' ? 'text-amber-900/70' : 'text-amber-200/70';
  const inputClass = `w-full p-3 rounded-md border ${theme === 'light' ? 'bg-white border-amber-200 text-amber-950 placeholder-amber-700/50' : 'bg-vector-night-deep/40 border-amber-500/30 text-amber-100 placeholder-amber-200/40'} focus:outline-none focus:border-rose-400/60`;

  const selectedDelay = DELAY_PRESETS.find((p) => p.id === delayId) ?? DELAY_PRESETS[1];

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!memoirId) {
      setErrorMessage((t.letterComposeNoMemoir as string) ?? 'Please pick a memoir to write to.');
      return;
    }
    if (body.trim().length === 0) {
      setErrorMessage((t.letterComposeEmpty as string) ?? 'Letter body cannot be empty.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onSendLetter({
        memoirId,
        body,
        delayMs: selectedDelay.ms,
      });
      if (ok) {
        onClose();
      } else {
        setErrorMessage(
          (t.letterComposeFailed as string) ?? 'Could not send the letter — please try again.',
        );
      }
    } catch (err) {
      console.warn('LetterComposeModal: onSendLetter threw', err);
      setErrorMessage(
        (t.letterComposeFailed as string) ?? 'Could not send the letter — please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            className={`relative w-full max-w-2xl border rounded-2xl p-8 my-12 shadow-2xl ${surface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close ?? 'Close'}
              className="absolute top-4 right-4 p-2 rounded-md hover:bg-rose-500/10 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-rose-400" aria-hidden="true" />
              <h2 id={headerId} className="text-xl font-bold tracking-wide">
                {(t.letterComposeTitle as string) ?? 'Write a letter'}
              </h2>
            </div>
            <p className={`text-xs leading-relaxed ${subtle} mb-6`}>
              {(t.letterComposeSubtitle as string) ??
                'Letters are not instant chats — your memoir will reply later, after the delivery delay you choose. Use this when you want to sit with a thought.'}
            </p>

            {memoirOptions.length === 0 ? (
              <div className={`text-sm ${subtle} py-8 text-center`} role="status">
                {(t.letterComposeNoMemoirsHint as string) ??
                  'You need at least one memoir before you can write a letter.'}
              </div>
            ) : (
              <>
                {memoirOptions.length > 1 && !initialMemoirId && (
                  <div className="flex flex-col gap-2 mb-4">
                    <label
                      htmlFor={memoirSelectId}
                      className="text-[11px] font-bold uppercase tracking-widest"
                    >
                      {(t.letterComposeRecipient as string) ?? 'Recipient'}
                    </label>
                    <select
                      id={memoirSelectId}
                      value={memoirId}
                      onChange={(e) => setMemoirId(e.target.value)}
                      disabled={submitting}
                      className={inputClass}
                    >
                      {memoirOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-2 mb-4">
                  <label
                    htmlFor={bodyId}
                    className="text-[11px] font-bold uppercase tracking-widest"
                  >
                    {(t.letterComposeBody as string) ?? 'Your letter'}
                  </label>
                  <textarea
                    id={bodyId}
                    rows={10}
                    maxLength={LETTER_LIMITS.body}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={submitting}
                    placeholder={(t.letterComposePlaceholder as string) ?? '...'}
                    className={`${inputClass} font-serif leading-relaxed`}
                    data-testid="letter-compose-body"
                  />
                  <div className={`text-[10px] font-mono text-right ${subtle}`} aria-live="polite">
                    {body.length} / {LETTER_LIMITS.body}
                  </div>
                </div>

                <fieldset className="flex flex-col gap-2 mb-6">
                  <legend className="text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {(t.letterComposeDeliverIn as string) ?? 'Deliver in'}
                  </legend>
                  <div role="radiogroup" className="flex gap-2 flex-wrap">
                    {DELAY_PRESETS.map((preset) => {
                      const checked = preset.id === delayId;
                      return (
                        <label
                          key={preset.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-xs ${checked ? (theme === 'light' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-500/10 border-rose-500/40 text-rose-200') : `${subtle} border-transparent`}`}
                        >
                          <input
                            type="radio"
                            name="letter-delay"
                            value={preset.id}
                            checked={checked}
                            onChange={() => setDelayId(preset.id)}
                            disabled={submitting}
                            className="sr-only"
                            aria-label={(t[preset.labelKey] as string) ?? preset.id}
                          />
                          {(t[preset.labelKey] as string) ?? preset.id}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {errorMessage && (
                  <p
                    role="status"
                    className="text-[11px] text-rose-500 font-mono mb-4"
                    data-testid="letter-compose-error"
                  >
                    {errorMessage}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className={`text-[11px] underline-offset-4 hover:underline ${subtle} disabled:opacity-30`}
                  >
                    {t.cancel ?? 'Cancel'}
                  </button>
                  <CyberButton
                    onClick={() => void handleSubmit()}
                    theme={theme}
                    disabled={submitting || body.trim().length === 0 || !memoirId}
                    aria-label={(t.letterComposeSend as string) ?? 'Send letter'}
                  >
                    <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                    {submitting
                      ? ((t.letterComposeSending as string) ?? 'Sealing\u2026')
                      : ((t.letterComposeSend as string) ?? 'Send letter')}
                  </CyberButton>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
