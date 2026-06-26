import React from 'react';
import { motion } from 'motion/react';
import { Mail, X } from 'lucide-react';
import type { CustomPersona, PendingLetter, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface LetterArrivedCardProps {
  letter: PendingLetter;
  /** Resolved Memoir persona for this letter — used to render the
   *  recipient's name. The Dashboard does the lookup. Pass
   *  `undefined` to keep the card hidden (orphaned letter). */
  memoir: CustomPersona | undefined;
  theme: Theme;
  t: TranslationDictionary;
  /** Open the reply entry. The Dashboard wires this to its
   *  `onSelectEntry` (using `letter.replyEntryId`). */
  onOpenReply: (letter: PendingLetter) => void;
  /** Hide this card from future Dashboard mounts. Persisted to
   *  localStorage by `useLetterArrivedDismissals` (lives in the
   *  Dashboard wiring layer). */
  onDismiss: (letter: PendingLetter) => void;
}

/**
 * Phase 4.5 §A — `LetterArrivedCard`
 *
 * Sister surface to `ProactiveRecallCard`. Notifies the user that
 * a Memoir has replied to one of their letters. Rendered in the
 * Dashboard's top stack, dismissible per-letter for 7 days
 * (cooldown handled by the parent — this component is purely
 * presentational).
 *
 * Visual posture: same warm gradient as ProactiveRecallCard
 * (rose-on-amber) — keeps Memoir-related surfaces visually
 * coherent. Mail icon distinguishes it from the Bell / Heart
 * icons of proactive cards.
 */
export const LetterArrivedCard: React.FC<LetterArrivedCardProps> = ({
  letter,
  memoir,
  theme,
  t,
  onOpenReply,
  onDismiss,
}) => {
  if (!memoir) return null;

  const surface =
    theme === 'light'
      ? 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200 text-rose-900'
      : 'bg-gradient-to-r from-rose-500/10 to-amber-500/10 border-rose-500/30 text-rose-100';
  const subtle = theme === 'light' ? 'text-rose-700/70' : 'text-rose-200/70';

  const headlineTpl = (t.letterArrivedHeadline as string) ?? 'A letter from {name} has arrived';
  const headline = headlineTpl.replace('{name}', memoir.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative w-full mt-4 mb-2 px-4 py-3 rounded-xl border ${surface}`}
      role="status"
      aria-live="polite"
      data-testid="letter-arrived-card"
    >
      <button
        type="button"
        onClick={() => onDismiss(letter)}
        className={`absolute top-2 right-2 p-1 rounded hover:bg-rose-500/10 ${subtle}`}
        aria-label={(t.letterArrivedDismissAria as string) ?? 'Dismiss this notification'}
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <div className="mt-0.5 shrink-0 text-rose-400">
          <Mail className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-wide mb-1">{headline}</p>
          <p className={`text-[13px] leading-relaxed ${subtle}`}>
            {(t.letterArrivedSubtitle as string) ?? 'Open it to read what they wrote back.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenReply(letter)}
          className={`shrink-0 text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border ${theme === 'light' ? 'bg-rose-500/10 border-rose-300/60 text-rose-700 hover:bg-rose-500/20' : 'bg-rose-500/10 border-rose-500/40 text-rose-200 hover:bg-rose-500/20'}`}
          aria-label={
            ((t.letterArrivedOpenAria as string) ?? 'Open the reply') + ` (${memoir.name})`
          }
        >
          {(t.letterArrivedOpenAction as string) ?? 'Open'}
        </button>
      </div>
    </motion.div>
  );
};
