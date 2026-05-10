import React, { useId, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Clock, Mail, MailX, X } from 'lucide-react';
import type { CustomPersona, PendingLetter, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

/**
 * Phase 4.5 follow-ups (F1) — `LetterHistoryPanel`
 *
 * Companion surface to `LetterComposeModal` and the in-Dashboard
 * `LetterArrivedCard` stack: lets the user inspect every letter
 * they have ever written to a Memoir, regardless of status.
 *
 * Three sections:
 *   - **Pending** (`status: 'pending'`) — sorted by `deliverAt`
 *     ASC so the next-to-arrive sits on top. Each row shows the
 *     "delivers in N days" countdown plus a cancel button.
 *   - **Delivered** (`status: 'delivered'`) — sorted by
 *     `composedAt` DESC (most recent first). Each row links to
 *     the `replyEntryId` so the user can re-open the AI reply.
 *   - **Other** (`status: 'cancelled' | 'failed'`) — folded into
 *     a collapsed footer block. Cancelled is benign; failed
 *     surfaces the attempt count.
 *
 * Privacy posture: nothing leaves the device. The panel only
 * reads from `useLetterStore` (already mounted at App level for
 * §E migration) and routes back to the parent via callbacks.
 *
 * Future surface: a Settings → Memoirs picker → "see letter
 * history" CTA. For this sprint the panel is built + tested in
 * isolation; wiring into the Settings tree is a follow-up sprint.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface LetterHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  /** The memoir whose letter history is being inspected. */
  memoir: CustomPersona;
  /** All letters the user has ever produced for ANY memoir; the
   *  panel filters down to this memoir.id internally. */
  letters: readonly PendingLetter[];
  /** User-initiated cancel of a pending letter. */
  onCancelLetter: (letterId: string) => Promise<void> | void;
  /** Jump to the reply entry minted for a delivered letter. */
  onOpenReply: (letter: PendingLetter) => void;
  /** Optional clock injection for deterministic tests. Defaults
   *  to `Date.now()` at first render — we DO NOT subscribe to a
   *  ticker since the panel is short-lived and a stale countdown
   *  to the minute is acceptable here. */
  now?: number;
}

const formatRelative = (ms: number, t: TranslationDictionary): string => {
  if (ms <= 0) return (t.letterHistoryArrivingNow as string) ?? 'Arriving now';
  const days = Math.floor(ms / DAY_MS);
  if (days >= 1) {
    const tmpl = (t.letterHistoryArrivesInDays as string) ?? 'Arrives in {days} day(s)';
    return tmpl.replace('{days}', String(days));
  }
  const hours = Math.max(1, Math.floor(ms / HOUR_MS));
  const tmpl = (t.letterHistoryArrivesInHours as string) ?? 'Arrives in {hours} hour(s)';
  return tmpl.replace('{hours}', String(hours));
};

const formatComposedDate = (ms: number): string => {
  // Locale-friendly short date; explicit en-CA gives YYYY-MM-DD which
  // is unambiguous in both zh and en UIs without a heavy intl dep.
  return new Date(ms).toISOString().slice(0, 10);
};

export const LetterHistoryPanel: React.FC<LetterHistoryPanelProps> = ({
  open,
  onClose,
  theme,
  t,
  memoir,
  letters,
  onCancelLetter,
  onOpenReply,
  now,
}) => {
  const headerId = useId();
  const currentTime = now ?? Date.now();

  const { pending, delivered, other } = useMemo(() => {
    const mine = letters.filter((l) => l.memoirId === memoir.id);
    return {
      pending: mine.filter((l) => l.status === 'pending').sort((a, b) => a.deliverAt - b.deliverAt),
      delivered: mine
        .filter((l) => l.status === 'delivered')
        .sort((a, b) => b.composedAt - a.composedAt),
      other: mine
        .filter((l) => l.status === 'cancelled' || l.status === 'failed')
        .sort((a, b) => b.composedAt - a.composedAt),
    };
  }, [letters, memoir.id]);

  // Mirrors the warm cream / amber palette of LetterComposeModal +
  // LetterArrivedCard so users perceive the three surfaces as a
  // family.
  const surface =
    theme === 'light'
      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
      : 'bg-amber-500/5 border-amber-500/30 text-amber-100';
  const subtle = theme === 'light' ? 'text-amber-900/70' : 'text-amber-200/70';
  const sectionDivider = theme === 'light' ? 'border-amber-200/60' : 'border-amber-500/20';

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
            data-testid="letter-history-panel"
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
              <Mail className="w-5 h-5 text-amber-500" aria-hidden="true" />
              <h2 id={headerId} className="text-xl font-bold tracking-wide">
                {(t.letterHistoryTitle as string) ?? 'Letter history'} · {memoir.name}
              </h2>
            </div>
            <p className={`text-xs leading-relaxed ${subtle} mb-6`}>
              {(t.letterHistorySubtitle as string) ??
                'Every letter you have written to this memoir, regardless of status. Pending letters can still be cancelled.'}
            </p>

            {/* Pending */}
            <section
              className="mb-6"
              data-testid="letter-history-pending"
              aria-labelledby={`${headerId}-pending`}
            >
              <h3
                id={`${headerId}-pending`}
                className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest mb-2 ${subtle}`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {(t.letterHistoryPending as string) ?? 'Pending'} ({pending.length})
              </h3>
              {pending.length === 0 ? (
                <p className={`text-[11px] ${subtle}`}>
                  {(t.letterHistoryEmptyPending as string) ?? 'No pending letters.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pending.map((letter) => (
                    <li
                      key={letter.id}
                      className={`flex items-start gap-3 p-3 rounded-md border ${theme === 'light' ? 'bg-white/50 border-amber-200' : 'bg-vector-night-deep/40 border-amber-500/20'}`}
                      data-testid={`letter-history-row-${letter.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] line-clamp-2 break-words">{letter.body}</p>
                        <p className={`text-[10px] mt-1 ${subtle}`}>
                          {formatRelative(letter.deliverAt - currentTime, t)} ·{' '}
                          {formatComposedDate(letter.composedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onCancelLetter(letter.id)}
                        className="text-[11px] uppercase tracking-widest text-rose-400 hover:text-rose-300"
                        aria-label={
                          (t.letterHistoryCancelAria as string) ?? 'Cancel this pending letter'
                        }
                        data-testid={`letter-history-cancel-${letter.id}`}
                      >
                        {(t.letterHistoryCancel as string) ?? 'Cancel'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Delivered */}
            <section
              className="mb-6"
              data-testid="letter-history-delivered"
              aria-labelledby={`${headerId}-delivered`}
            >
              <h3
                id={`${headerId}-delivered`}
                className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest mb-2 ${subtle}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {(t.letterHistoryDelivered as string) ?? 'Delivered'} ({delivered.length})
              </h3>
              {delivered.length === 0 ? (
                <p className={`text-[11px] ${subtle}`}>
                  {(t.letterHistoryEmptyDelivered as string) ?? 'No delivered letters yet.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {delivered.map((letter) => (
                    <li
                      key={letter.id}
                      className={`flex items-start gap-3 p-3 rounded-md border ${theme === 'light' ? 'bg-white/50 border-amber-200' : 'bg-vector-night-deep/40 border-amber-500/20'}`}
                      data-testid={`letter-history-row-${letter.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] line-clamp-2 break-words">{letter.body}</p>
                        <p className={`text-[10px] mt-1 ${subtle}`}>
                          {formatComposedDate(letter.composedAt)}
                        </p>
                      </div>
                      {letter.replyEntryId && (
                        <button
                          type="button"
                          onClick={() => onOpenReply(letter)}
                          className="text-[11px] uppercase tracking-widest text-amber-500 hover:text-amber-400"
                          aria-label={
                            (t.letterHistoryOpenReplyAria as string) ??
                            'Open the reply this letter received'
                          }
                          data-testid={`letter-history-open-reply-${letter.id}`}
                        >
                          {(t.letterHistoryOpenReply as string) ?? 'Open reply'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Other (cancelled / failed) — collapsed when empty. */}
            {other.length > 0 && (
              <section
                className={`pt-4 border-t ${sectionDivider}`}
                data-testid="letter-history-other"
                aria-labelledby={`${headerId}-other`}
              >
                <h3
                  id={`${headerId}-other`}
                  className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest mb-2 ${subtle}`}
                >
                  <MailX className="w-3.5 h-3.5" aria-hidden="true" />
                  {(t.letterHistoryOther as string) ?? 'Cancelled / failed'} ({other.length})
                </h3>
                <ul className="flex flex-col gap-1">
                  {other.map((letter) => (
                    <li
                      key={letter.id}
                      className={`flex items-center justify-between gap-2 text-[11px] ${subtle}`}
                      data-testid={`letter-history-row-${letter.id}`}
                    >
                      <span className="truncate flex-1">{letter.body}</span>
                      <span className="font-mono shrink-0">
                        {letter.status === 'failed'
                          ? `⚠ ${(t.letterHistoryFailed as string) ?? 'failed'}` +
                            (letter.attempts ? ` (${letter.attempts}×)` : '')
                          : `⊘ ${(t.letterHistoryCancelled as string) ?? 'cancelled'}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
