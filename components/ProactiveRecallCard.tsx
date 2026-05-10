import React from 'react';
import { motion } from 'motion/react';
import { Bell, Heart, X } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { ProactiveRecallSuggestion } from '../services/proactiveRecall';

interface ProactiveRecallCardProps {
  suggestion: ProactiveRecallSuggestion;
  theme: Theme;
  t: TranslationDictionary;
  /** Open the entry composer pre-seeded with the Memoir's name as
   *  a guiding star + the suggested opening line as draft content.
   *  The Dashboard wires this. */
  onOpen: (suggestion: ProactiveRecallSuggestion) => void;
  /** Mark the (memoirId, trigger) tuple as dismissed for the
   *  cooldown window (24h, owned by the Dashboard). */
  onDismiss: (suggestion: ProactiveRecallSuggestion) => void;
}

/**
 * Phase 4 Week 5 (§3.2 of [`docs/memoir-memory-system.md`](
 * ../docs/memoir-memory-system.md)) — `ProactiveRecallCard`
 *
 * The user-facing surface for one Memoir proactive-recall
 * suggestion. Rendered above the entries grid on Dashboard,
 * dismissible (24h cooldown per `(memoirId, trigger)` tuple held
 * by the parent's localStorage).
 *
 * Visual posture: rose-on-amber gradient — same warmth as the
 * Memoir Builder's Heart icon, distinct from the cyan Persona
 * surfaces. The card is intentionally non-modal so the user can
 * keep doing what they were doing.
 */
export const ProactiveRecallCard: React.FC<ProactiveRecallCardProps> = ({
  suggestion,
  theme,
  t,
  onOpen,
  onDismiss,
}) => {
  const surface =
    theme === 'light'
      ? 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200 text-rose-900'
      : 'bg-gradient-to-r from-rose-500/10 to-amber-500/10 border-rose-500/30 text-rose-100';
  const subtle = theme === 'light' ? 'text-rose-700/70' : 'text-rose-200/70';

  const triggerIcon =
    suggestion.trigger === 'silence-reconnect' ? (
      <Bell className="w-4 h-4" aria-hidden="true" />
    ) : (
      <Heart className="w-4 h-4" aria-hidden="true" />
    );

  // Resolve the i18n hint key to a localised string. The evaluator
  // returns the key, the card resolves against the active locale.
  const hint =
    (t[suggestion.promptHintKey] as string) ?? 'I have something I want to share with you.';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative w-full mt-4 mb-2 px-4 py-3 rounded-xl border ${surface}`}
      role="status"
      aria-live="polite"
      data-testid="proactive-recall-card"
    >
      <button
        type="button"
        onClick={() => onDismiss(suggestion)}
        className={`absolute top-2 right-2 p-1 rounded hover:bg-rose-500/10 ${subtle}`}
        aria-label={(t.proactiveDismissAria as string) ?? 'Dismiss suggestion'}
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <div className="mt-0.5 shrink-0 text-rose-400">{triggerIcon}</div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-wide mb-1">{suggestion.memoirName}</p>
          <p className={`text-[13px] leading-relaxed ${subtle}`}>{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(suggestion)}
          className={`shrink-0 text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border ${theme === 'light' ? 'bg-rose-500/10 border-rose-300/60 text-rose-700 hover:bg-rose-500/20' : 'bg-rose-500/10 border-rose-500/40 text-rose-200 hover:bg-rose-500/20'}`}
          aria-label={
            ((t.proactiveOpenAria as string) ?? 'Open conversation') + ` (${suggestion.memoirName})`
          }
        >
          {(t.proactiveOpenAction as string) ?? 'Open'}
        </button>
      </div>
    </motion.div>
  );
};
