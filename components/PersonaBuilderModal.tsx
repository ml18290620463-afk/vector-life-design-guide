import React, { useEffect, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { CustomPersona } from '../types';
import type { PaywallVerdict } from '../services/quotaService';
import { CyberButton } from './CyberButton';
import { usePersonaBuilder } from '../hooks/usePersonaBuilder';
import { PersonaPreview } from './PersonaPreview';

interface PersonaBuilderModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  /** Pre-flight quota check from `quotaService.canCreateCustomPersona`.
   *  When `blocked: true` the modal renders the upgrade prompt instead
   *  of the wizard. */
  paywallVerdict: PaywallVerdict;
  /** Click handler for the upgrade CTA inside the paywall surface
   *  (Day 5 wires this to whatever the upgrade flow becomes). */
  onUpgrade?: () => void;
  /** Persist the freshly minted persona. Called once the user
   *  confirms the preview. */
  onPersonaCreated: (persona: CustomPersona) => Promise<void> | void;
}

/**
 * Phase 4 Week 2 Day 3 — `PersonaBuilderModal`
 *
 * 6-step "tell me about your custom 启明星" wizard. Owns:
 *   - the `usePersonaBuilder` state machine
 *   - per-step UI (label / textarea / character counter)
 *   - the AI-synthesis loading + error surface
 *   - the paywall surface (rendered when `paywallVerdict.blocked`)
 *   - hand-off to `<PersonaPreview>` once the LLM returns
 *
 * Privacy guardrail: the modal renders a single inline reminder in
 * its header — "the description goes through our AI proxy; do not
 * paste anyone else's private contact details" — so users opt in to
 * the data flow knowingly. Server enforcement lives in
 * `server/personaBuilderPrompt.ts`'s ANTI_PII_BLOCK.
 */
export const PersonaBuilderModal: React.FC<PersonaBuilderModalProps> = ({
  open,
  onClose,
  theme,
  language,
  t,
  paywallVerdict,
  onUpgrade,
  onPersonaCreated,
}) => {
  const builder = usePersonaBuilder();

  // Reset the wizard whenever the modal opens fresh — otherwise a
  // user who closed mid-flow would re-open onto stale answers /
  // phase=preview from the previous session.
  useEffect(() => {
    if (open) builder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes — matches `ShareCardModal` / `SettingsPanel` posture.
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

  const handlePersonaConfirmed = async (persona: CustomPersona) => {
    await onPersonaCreated(persona);
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
          aria-label={t.personaBuilderTitle ?? 'Add a custom guiding star'}
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
              <PaywallSurface
                verdict={paywallVerdict}
                theme={theme}
                t={t}
                onUpgrade={onUpgrade}
                onClose={onClose}
                subtleText={subtleText}
              />
            ) : (
              <WizardSurface
                builder={builder}
                stepLabel={stepLabel}
                language={language}
                theme={theme}
                t={t}
                subtleText={subtleText}
                onPersonaConfirmed={handlePersonaConfirmed}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Paywall surface (Free tier)                                       */
/* ------------------------------------------------------------------ */

interface PaywallSurfaceProps {
  verdict: PaywallVerdict;
  theme: Theme;
  t: TranslationDictionary;
  onUpgrade?: () => void;
  onClose: () => void;
  subtleText: string;
}

const PaywallSurface: React.FC<PaywallSurfaceProps> = ({
  verdict,
  theme,
  t,
  onUpgrade,
  onClose,
  subtleText,
}) => {
  const isFreeNoPersonas = verdict.reason === 'free-tier-no-personas';
  const headline = isFreeNoPersonas
    ? (t.personaPaywallHeadlineFree ?? 'Custom guiding stars are a Stardust feature')
    : (t.personaPaywallHeadlineLimit ?? 'You\u2019ve reached this tier\u2019s limit');
  const body = isFreeNoPersonas
    ? (t.personaPaywallBodyFree ??
      'Free accounts include the 7 built-in guiding stars. Upgrade to Stardust to add up to 5 custom personas of your own.')
    : (t.personaPaywallBodyLimit ??
      `You currently have ${verdict.used} of ${verdict.limit} custom personas allowed by your plan.`);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
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
          aria-label={t.personaPaywallUpgradeAction ?? 'Upgrade'}
        >
          <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
          {verdict.suggestedUpgrade
            ? `${t.personaPaywallUpgradeAction ?? 'Upgrade to'} ${verdict.suggestedUpgrade.charAt(0).toUpperCase() + verdict.suggestedUpgrade.slice(1)}`
            : (t.personaPaywallContact ?? 'Contact us')}
        </CyberButton>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Wizard surface (paid tier)                                        */
/* ------------------------------------------------------------------ */

interface WizardSurfaceProps {
  builder: ReturnType<typeof usePersonaBuilder>;
  stepLabel: string;
  language: Language;
  theme: Theme;
  t: TranslationDictionary;
  subtleText: string;
  onPersonaConfirmed: (persona: CustomPersona) => Promise<void> | void;
}

const WizardSurface: React.FC<WizardSurfaceProps> = ({
  builder,
  stepLabel,
  language,
  theme,
  t,
  subtleText,
  onPersonaConfirmed,
}) => {
  const inputId = useId();

  if (builder.phase === 'preview' && builder.generatedPersona) {
    return (
      <PersonaPreview
        persona={builder.generatedPersona}
        theme={theme}
        t={t}
        onConfirm={onPersonaConfirmed}
        onRetry={builder.reset}
      />
    );
  }

  const isSubmitStep = builder.stepIndex === builder.totalSteps - 1;
  const submitting = builder.phase === 'submitting';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-wide">
          {t.personaBuilderTitle ?? 'Add a custom guiding star'}
        </h2>
      </div>
      <p className={`text-xs leading-relaxed ${subtleText}`}>
        {t.personaBuilderSubtitle ??
          'Answer a few questions and AI will draft a system prompt for your new guiding star. Avoid pasting anyone else\u2019s private contact details — those go through our AI proxy.'}
      </p>

      <div
        className={`flex items-center gap-2 text-[10px] uppercase tracking-widest ${subtleText}`}
      >
        <span>
          {t.personaBuilderStep ?? 'Step'} {builder.stepIndex + 1} / {builder.totalSteps}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-bold">
          {stepLabel}
          {!builder.currentStep.required && (
            <span className={`ml-2 text-[10px] font-normal ${subtleText}`}>
              ({t.personaBuilderOptional ?? 'optional'})
            </span>
          )}
        </label>
        <textarea
          id={inputId}
          rows={builder.currentStep.maxChars > 200 ? 5 : 2}
          maxLength={builder.currentStep.maxChars}
          value={builder.answers[builder.currentStep.id] ?? ''}
          onChange={(e) => builder.setAnswer(builder.currentStep.id, e.target.value)}
          disabled={submitting}
          placeholder={t.personaBuilderPlaceholder ?? '...'}
          className={`w-full p-3 rounded-md border resize-none ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong placeholder-vector-slate-soft' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100 placeholder-vector-slate-chrome'} focus:outline-none focus:border-vector-cyan-neon/60`}
        />
        <div className={`text-[10px] font-mono text-right ${subtleText}`} aria-live="polite">
          {(builder.answers[builder.currentStep.id] ?? '').length} / {builder.currentStep.maxChars}
        </div>
      </div>

      {builder.phase === 'error' && (
        <p
          role="status"
          className="text-[11px] text-rose-400 font-mono"
          data-testid="persona-builder-error"
        >
          {t.personaBuilderError ?? 'Something went wrong:'} {builder.errorMessage ?? '?'}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mt-4">
        <button
          type="button"
          onClick={builder.goBack}
          disabled={builder.stepIndex === 0 || submitting}
          aria-label={t.personaBuilderBack ?? 'Back'}
          className={`flex items-center gap-1 text-[11px] uppercase tracking-widest disabled:opacity-30 ${subtleText} hover:text-vector-cyan-neon`}
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          {t.personaBuilderBack ?? 'Back'}
        </button>
        {isSubmitStep ? (
          <CyberButton
            onClick={() => {
              void builder.submit();
            }}
            theme={theme}
            disabled={!builder.isReadyToSubmit || submitting}
            aria-label={t.personaBuilderSubmit ?? 'Generate'}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
            )}
            {submitting
              ? (t.personaBuilderSubmitting ?? 'Generating\u2026')
              : (t.personaBuilderSubmit ?? 'Generate persona')}
          </CyberButton>
        ) : (
          <CyberButton
            onClick={builder.goNext}
            theme={theme}
            disabled={!builder.isCurrentStepValid}
            aria-label={t.personaBuilderNext ?? 'Next'}
          >
            {t.personaBuilderNext ?? 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </CyberButton>
        )}
      </div>
    </div>
  );
};
