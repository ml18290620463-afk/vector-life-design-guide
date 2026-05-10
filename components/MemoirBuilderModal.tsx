import React, { useEffect, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Heart, Loader2, Sparkles, X } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { CustomPersona } from '../types';
import type { PaywallVerdict } from '../services/quotaService';
import { CyberButton } from './CyberButton';
import { useMemoirBuilder } from '../hooks/useMemoirBuilder';
import { PersonaPreview } from './PersonaPreview';

interface MemoirBuilderModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  /** Pre-flight quota check from `quotaService.canCreateMemoir`.
   *  When `blocked: true` the modal renders the upgrade prompt
   *  instead of the wizard. Free tier always lands here because
   *  Memoirs are a paid-tier feature. */
  paywallVerdict: PaywallVerdict;
  /** Click handler for the upgrade CTA inside the paywall surface.
   *  Day 7's Settings integration wires this to the upgrade flow
   *  (currently a stub that logs + closes the modal). */
  onUpgrade?: () => void;
  /** Persist the freshly minted Memoir. Called once the user
   *  confirms the preview. */
  onMemoirCreated: (memoir: CustomPersona) => Promise<void> | void;
}

/**
 * Phase 4 Week 3 Day 4 — `MemoirBuilderModal`
 *
 * 5-step "为心中的人立一座心象" wizard. Sister to
 * [`PersonaBuilderModal`](./PersonaBuilderModal.tsx) but with three
 * UX differences that flow from the higher emotional stakes:
 *
 *   1. **Softer copy + Heart icon** — the modal opens with a quiet
 *      one-line preface ("这个流程是为心中那个真正重要的人设立的")
 *      rather than the technical Persona Builder framing.
 *   2. **Mandatory consent checkbox** — on the final wizard step
 *      the user must tick the safety acknowledgement before the
 *      "Generate" button enables. The checkbox copy is owned by
 *      `t.memoirBuilderConsent`.
 *   3. **Stricter paywall surface** — the Free tier paywall copy
 *      explains why the feature is paid (per-Memoir cost + emotional
 *      sustainability) rather than just "upgrade to unlock".
 *
 * Privacy + safety guardrails:
 *   - Server-side: `server/memoirBuilderPrompt.ts` carries
 *     ANTI_PII + memory-of-them + psychological-safety blocks.
 *   - Client-side: this modal renders the consent checkbox + a
 *     "the description goes through our AI proxy" reminder in
 *     the header, mirroring `PersonaBuilderModal`.
 */
export const MemoirBuilderModal: React.FC<MemoirBuilderModalProps> = ({
  open,
  onClose,
  theme,
  language,
  t,
  paywallVerdict,
  onUpgrade,
  onMemoirCreated,
}) => {
  const builder = useMemoirBuilder();

  // Reset on open — same posture as PersonaBuilderModal.
  useEffect(() => {
    if (open) builder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      ? 'bg-vector-paper-white border-slate-200 text-vector-ink-strong'
      : 'bg-vector-night-navy border-cyan-950/60 text-cyan-100';
  const subtleText = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';

  const stepLabel = useMemo(() => {
    if (builder.phase !== 'asking') return '';
    return language === 'zh' ? builder.currentStep.zhLabel : builder.currentStep.enLabel;
  }, [builder.currentStep, builder.phase, language]);

  const stepHint = useMemo(() => {
    if (builder.phase !== 'asking') return '';
    return language === 'zh' ? builder.currentStep.zhHint : builder.currentStep.enHint;
  }, [builder.currentStep, builder.phase, language]);

  const handleMemoirConfirmed = async (memoir: CustomPersona) => {
    await onMemoirCreated(memoir);
    onClose();
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
          aria-label={t.memoirBuilderTitle ?? 'Create a memoir'}
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
              className="absolute top-4 right-4 p-2 rounded-md hover:bg-cyan-500/10 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            {paywallVerdict.blocked ? (
              <MemoirPaywallSurface
                verdict={paywallVerdict}
                theme={theme}
                t={t}
                onUpgrade={onUpgrade}
                onClose={onClose}
                subtleText={subtleText}
              />
            ) : (
              <MemoirWizardSurface
                builder={builder}
                stepLabel={stepLabel}
                stepHint={stepHint}
                language={language}
                theme={theme}
                t={t}
                subtleText={subtleText}
                onMemoirConfirmed={handleMemoirConfirmed}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Paywall surface (Free tier + over-cap paid tiers)                 */
/* ------------------------------------------------------------------ */

interface MemoirPaywallSurfaceProps {
  verdict: PaywallVerdict;
  theme: Theme;
  t: TranslationDictionary;
  onUpgrade?: () => void;
  onClose: () => void;
  subtleText: string;
}

const MemoirPaywallSurface: React.FC<MemoirPaywallSurfaceProps> = ({
  verdict,
  theme,
  t,
  onUpgrade,
  onClose,
  subtleText,
}) => {
  const isFreeNoMemoirs = verdict.reason === 'free-tier-no-memoirs';
  const headline = isFreeNoMemoirs
    ? (t.memoirPaywallHeadlineFree ?? 'Memoirs are a paid feature')
    : (t.memoirPaywallHeadlineLimit ?? 'You\u2019ve reached this tier\u2019s memoir limit');
  const body = isFreeNoMemoirs
    ? (t.memoirPaywallBodyFree ??
      'Memoirs run a separate AI pipeline with stronger safety guardrails and long-term memory. Each memoir is included with a paid plan.')
    : (t.memoirPaywallBodyLimit ??
      `You currently own ${verdict.used} of ${verdict.limit} memoirs allowed by your plan.`);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-400" aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-wide">{headline}</h2>
      </div>
      <p className={`text-sm leading-relaxed ${subtleText}`}>{body}</p>
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className={`text-[11px] underline-offset-4 hover:underline ${subtleText}`}
        >
          {t.cancel ?? 'Maybe later'}
        </button>
        <CyberButton
          onClick={() => {
            if (onUpgrade) onUpgrade();
            else onClose();
          }}
          theme={theme}
          aria-label={t.memoirPaywallUpgradeAction ?? 'Upgrade'}
        >
          <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
          {verdict.suggestedUpgrade
            ? `${t.memoirPaywallUpgradeAction ?? 'Upgrade to'} ${verdict.suggestedUpgrade.charAt(0).toUpperCase() + verdict.suggestedUpgrade.slice(1)}`
            : (t.memoirPaywallContact ?? 'Contact us')}
        </CyberButton>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Wizard surface                                                     */
/* ------------------------------------------------------------------ */

interface MemoirWizardSurfaceProps {
  builder: ReturnType<typeof useMemoirBuilder>;
  stepLabel: string;
  stepHint: string;
  language: Language;
  theme: Theme;
  t: TranslationDictionary;
  subtleText: string;
  onMemoirConfirmed: (memoir: CustomPersona) => Promise<void> | void;
}

const MemoirWizardSurface: React.FC<MemoirWizardSurfaceProps> = ({
  builder,
  stepLabel,
  stepHint,
  language: _language,
  theme,
  t,
  subtleText,
  onMemoirConfirmed,
}) => {
  const inputId = useId();
  const consentId = useId();

  if (builder.phase === 'preview' && builder.generatedMemoir) {
    return (
      <PersonaPreview
        persona={builder.generatedMemoir}
        theme={theme}
        t={t}
        onConfirm={onMemoirConfirmed}
        onRetry={builder.reset}
      />
    );
  }

  const isSubmitStep = builder.stepIndex === builder.totalSteps - 1;
  const submitting = builder.phase === 'submitting';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-400" aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-wide">
          {t.memoirBuilderTitle ?? 'Create a memoir'}
        </h2>
      </div>
      <p className={`text-xs leading-relaxed ${subtleText}`}>
        {t.memoirBuilderSubtitle ??
          'A memoir is YOUR memory of someone meaningful — brought into a private space where you can keep talking with them. Avoid sharing anyone else\u2019s private contact details.'}
      </p>

      <div
        className={`flex items-center gap-2 text-[10px] uppercase tracking-widest ${subtleText}`}
      >
        <span>
          {t.memoirBuilderStep ?? 'Step'} {builder.stepIndex + 1} / {builder.totalSteps}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-bold">
          {stepLabel}
          {!builder.currentStep.required && (
            <span className={`ml-2 text-[10px] font-normal ${subtleText}`}>
              ({t.memoirBuilderOptional ?? 'optional'})
            </span>
          )}
        </label>
        {stepHint && <p className={`text-[11px] leading-relaxed ${subtleText}`}>{stepHint}</p>}
        <textarea
          id={inputId}
          rows={builder.currentStep.maxChars > 200 ? 5 : 2}
          maxLength={builder.currentStep.maxChars}
          value={builder.answers[builder.currentStep.id] ?? ''}
          onChange={(e) => builder.setAnswer(builder.currentStep.id, e.target.value)}
          disabled={submitting}
          placeholder={t.memoirBuilderPlaceholder ?? '...'}
          className={`w-full p-3 rounded-md border resize-none ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong placeholder-vector-slate-soft' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100 placeholder-vector-slate-chrome'} focus:outline-none focus:border-vector-cyan-neon/60`}
        />
        <div className={`text-[10px] font-mono text-right ${subtleText}`} aria-live="polite">
          {(builder.answers[builder.currentStep.id] ?? '').length} / {builder.currentStep.maxChars}
        </div>
      </div>

      {/* Mandatory safety acknowledgement — gates the submit button
          on the final step. The checkbox copy explicitly addresses
          the three critical reframes (memory, not the person; not a
          replacement for therapy; never claims to BE them). */}
      {isSubmitStep && (
        <label
          htmlFor={consentId}
          className={`flex items-start gap-3 mt-2 p-3 rounded-md border cursor-pointer ${theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/5 border-amber-500/30 text-amber-200'}`}
        >
          <input
            id={consentId}
            type="checkbox"
            checked={builder.consentAcknowledged}
            onChange={(e) => builder.setConsentAcknowledged(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 accent-amber-500"
            aria-label={t.memoirBuilderConsentAria ?? 'Acknowledge memoir guidance'}
          />
          <span className="text-[11px] leading-relaxed">
            {t.memoirBuilderConsent ??
              'I understand: this memoir is my own memory of this person, not the person themselves. It will not replace professional support if I need it.'}
          </span>
        </label>
      )}

      {builder.phase === 'error' && (
        <p
          role="status"
          className="text-[11px] text-rose-400 font-mono"
          data-testid="memoir-builder-error"
        >
          {t.memoirBuilderError ?? 'Something went wrong:'} {builder.errorMessage ?? '?'}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mt-4">
        <button
          type="button"
          onClick={builder.goBack}
          disabled={builder.stepIndex === 0 || submitting}
          aria-label={t.memoirBuilderBack ?? 'Back'}
          className={`flex items-center gap-1 text-[11px] uppercase tracking-widest disabled:opacity-30 ${subtleText} hover:text-vector-cyan-neon`}
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          {t.memoirBuilderBack ?? 'Back'}
        </button>
        {isSubmitStep ? (
          <CyberButton
            onClick={() => {
              void builder.submit();
            }}
            theme={theme}
            disabled={!builder.isReadyToSubmit || !builder.consentAcknowledged || submitting}
            aria-label={t.memoirBuilderSubmit ?? 'Generate memoir'}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Heart className="w-4 h-4 mr-2" aria-hidden="true" />
            )}
            {submitting
              ? (t.memoirBuilderSubmitting ?? 'Generating\u2026')
              : (t.memoirBuilderSubmit ?? 'Generate memoir')}
          </CyberButton>
        ) : (
          <CyberButton
            onClick={builder.goNext}
            theme={theme}
            disabled={!builder.isCurrentStepValid}
            aria-label={t.memoirBuilderNext ?? 'Next'}
          >
            {t.memoirBuilderNext ?? 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </CyberButton>
        )}
      </div>
    </div>
  );
};
