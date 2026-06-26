import React, { useEffect, useId, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Loader2, RefreshCw, Save, Sparkles, Users, X } from 'lucide-react';
import type { CustomPersona, Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { PaywallVerdict } from '../services/quotaService';
import { CyberButton } from './CyberButton';
import { useEchoChamber } from '../hooks/useEchoChamber';
import { ECHO_CHAMBER_LIMITS } from '../lib/echoChamberSchema';
import { buildViewerMarkdownComponents } from './viewerMarkdown';

/**
 * Phase 4.5 §B (Echo Chamber) — `EchoChamberModal`
 *
 * Multi-persona round-table compose surface. Sister to the Letter
 * compose modal in shape (cream-on-amber palette, fixed-bottom-right
 * FAB entry point) but with a fundamentally different lifecycle:
 *   - The user types ONE question + picks 3-7 personas in step 1.
 *   - On Send the modal flips to a streaming-ish loading state
 *     (we are buffered today; the visual is a cycling dot that
 *     keeps the "thinking" rhythm), then renders the markdown
 *     reply once the AI returns.
 *   - The user can (a) Save to vault — mints a `DiaryEntry` with
 *     `isEchoChamber: true` + `echoChamberQuery`, (b) Try again —
 *     resets the wizard to compose state (the answer text +
 *     personas are kept), (c) Discard — closes without persisting.
 *
 * Visual posture: cyan / sky accent (the "many voices" surface)
 * vs the rose / amber of Letter Mode (the "one quiet voice"
 * surface). Both stand apart from the cool blue of regular
 * Morning Star reflection.
 *
 * The modal is presentational + form-state only. Dashboard wires
 * the actual persistence call through `onSave` — same pattern as
 * `LetterComposeModal.onSendLetter`.
 */
export interface EchoChamberSavePayload {
  query: string;
  personaNames: readonly string[];
  resultMarkdown: string;
}

interface EchoChamberModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  /** Pre-flight quota check from `quotaService.canStartEchoChamber`.
   *  When `blocked: true`, the modal renders the upgrade prompt
   *  instead of the wizard surface. */
  paywallVerdict: PaywallVerdict;
  /** Click handler for the upgrade CTA inside the paywall surface. */
  onUpgrade?: () => void;
  /** Live persona pool — built-in 7 sages + user's custom personas
   *  + Memoirs. The modal renders these as toggleable chips. */
  availablePersonas: readonly string[];
  /** All `CustomPersona` records (used to build the per-persona
   *  prompt + recall maps the underlying request needs).
   *  Kept as a flat list so the modal can intersect by name. */
  customPersonas?: readonly CustomPersona[];
  /** `name → top-N memory bodies` map for any Memoir personas the
   *  user picks. Computed by the consumer (Dashboard) using
   *  `useMemoryStore.recallForMemoir(memoirId, query)`. The modal
   *  does NOT compute recall itself — it doesn't know about
   *  memories. */
  buildRecallMap?: (
    query: string,
    selectedPersonaNames: readonly string[],
  ) => Record<string, ReadonlyArray<{ body: string }>>;
  /** Persist the round-table reply as a DiaryEntry. Called when
   *  the user hits Save on the result screen. Returning `false`
   *  keeps the modal open (with an inline error). */
  onSave: (payload: EchoChamberSavePayload) => Promise<boolean>;
}

export const EchoChamberModal: React.FC<EchoChamberModalProps> = ({
  open,
  onClose,
  theme,
  language,
  t,
  paywallVerdict,
  onUpgrade,
  availablePersonas,
  customPersonas,
  buildRecallMap,
  onSave,
}) => {
  void language;
  const echo = useEchoChamber();
  const headerId = useId();
  const queryId = useId();
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Reset on open — same posture as the Persona / Memoir builders.
  useEffect(() => {
    if (!open) return;
    echo.reset();
    setSaveError(null);
    setSaving(false);
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

  // Cancel any in-flight call when the modal closes.
  useEffect(
    () => () => {
      echo.cancel();
    },
    // We intentionally bind to a ref-stable cancel; deps left empty
    // is the standard "on unmount" pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const customPersonaPromptsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of customPersonas ?? []) {
      map[p.name] = p.systemPrompt;
    }
    return map;
  }, [customPersonas]);

  const surface =
    theme === 'light'
      ? 'bg-vector-paper-white border-cyan-200 text-vector-ink-strong'
      : 'bg-vector-night-navy border-cyan-500/30 text-cyan-100';
  const subtle = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  const inputClass = `w-full p-3 rounded-md border ${theme === 'light' ? 'bg-white border-slate-300 text-vector-ink-strong placeholder-vector-slate-soft' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100 placeholder-vector-slate-chrome'} focus:outline-none focus:border-vector-cyan-neon/60`;

  const markdownComponents = useMemo(() => buildViewerMarkdownComponents(theme), [theme]);

  const handleSubmit = async () => {
    const recall = buildRecallMap ? buildRecallMap(echo.query, echo.selectedPersonas) : undefined;
    await echo.submit({
      customPersonaPrompts: customPersonaPromptsMap,
      memoirRecallByPersona: recall,
    });
  };

  const handleSave = async () => {
    if (!echo.resultMarkdown) return;
    setSaveError(null);
    setSaving(true);
    try {
      const ok = await onSave({
        query: echo.query,
        personaNames: echo.selectedPersonas,
        resultMarkdown: echo.resultMarkdown,
      });
      if (ok) {
        onClose();
      } else {
        setSaveError((t.echoChamberSaveFailed as string) ?? 'Could not save the result.');
      }
    } catch (err) {
      console.warn('EchoChamberModal: save threw', err);
      setSaveError((t.echoChamberSaveFailed as string) ?? 'Could not save the result.');
    } finally {
      setSaving(false);
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
            className={`relative w-full max-w-3xl border rounded-2xl p-8 my-12 shadow-2xl ${surface}`}
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
                subtle={subtle}
                headerId={headerId}
              />
            ) : echo.phase === 'success' && echo.resultMarkdown ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  <h2 id={headerId} className="text-xl font-bold tracking-wide">
                    {(t.echoChamberResultHeadline as string) ?? '圆桌已成形'}
                  </h2>
                </div>
                <p className={`text-xs ${subtle}`}>
                  {(t.echoChamberResultSubtitle as string) ??
                    'Each voice spoke. Save the round to your vault for later reflection, try again with a tweaked question, or close to discard.'}
                </p>
                <div
                  className={`prose prose-sm max-w-none p-4 rounded-md border ${theme === 'light' ? 'bg-cyan-50/40 border-cyan-100' : 'bg-vector-night-deep/30 border-cyan-900/40'}`}
                  data-testid="echo-chamber-result"
                >
                  <ReactMarkdown components={markdownComponents}>
                    {echo.resultMarkdown}
                  </ReactMarkdown>
                </div>
                {saveError && (
                  <p
                    role="status"
                    className="text-[11px] text-rose-400 font-mono"
                    data-testid="echo-chamber-save-error"
                  >
                    {saveError}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => echo.reset()}
                    disabled={saving}
                    className={`flex items-center gap-1 text-[11px] uppercase tracking-widest ${subtle} hover:text-vector-cyan-neon disabled:opacity-30`}
                    aria-label={(t.echoChamberRetry as string) ?? 'Try again'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    {(t.echoChamberRetry as string) ?? 'Try again'}
                  </button>
                  <CyberButton
                    onClick={() => void handleSave()}
                    theme={theme}
                    disabled={saving}
                    aria-label={(t.echoChamberSave as string) ?? 'Save to vault'}
                  >
                    <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                    {saving
                      ? ((t.echoChamberSaving as string) ?? 'Saving…')
                      : ((t.echoChamberSave as string) ?? 'Save to vault')}
                  </CyberButton>
                </div>
              </div>
            ) : (
              <ComposeSurface
                echo={echo}
                onSubmit={handleSubmit}
                onClose={onClose}
                availablePersonas={availablePersonas}
                theme={theme}
                t={t}
                inputClass={inputClass}
                subtle={subtle}
                headerId={headerId}
                queryId={queryId}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Compose surface (idle / submitting / error / cancelled phases)     */
/* ------------------------------------------------------------------ */

interface ComposeSurfaceProps {
  echo: ReturnType<typeof useEchoChamber>;
  onSubmit: () => void;
  onClose: () => void;
  availablePersonas: readonly string[];
  theme: Theme;
  t: TranslationDictionary;
  inputClass: string;
  subtle: string;
  headerId: string;
  queryId: string;
}

const ComposeSurface: React.FC<ComposeSurfaceProps> = ({
  echo,
  onSubmit,
  onClose,
  availablePersonas,
  theme,
  t,
  inputClass,
  subtle,
  headerId,
  queryId,
}) => {
  void onClose;
  const submitting = echo.phase === 'submitting';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
        <h2 id={headerId} className="text-xl font-bold tracking-wide">
          {(t.echoChamberTitle as string) ?? 'Round table'}
        </h2>
      </div>
      <p className={`text-xs leading-relaxed ${subtle}`}>
        {(t.echoChamberSubtitle as string) ??
          'Pose one question to several voices at once. They will each reply, and the synthesis will surface where they agree — and where they disagree.'}
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor={queryId} className="text-[11px] font-bold uppercase tracking-widest">
          {(t.echoChamberQuery as string) ?? 'Your question'}
        </label>
        <textarea
          id={queryId}
          rows={4}
          maxLength={ECHO_CHAMBER_LIMITS.maxQueryChars}
          value={echo.query}
          onChange={(e) => echo.setQuery(e.target.value)}
          disabled={submitting}
          placeholder={(t.echoChamberQueryPlaceholder as string) ?? '...'}
          className={`${inputClass} font-serif leading-relaxed`}
          data-testid="echo-chamber-query"
        />
        <div className={`text-[10px] font-mono text-right ${subtle}`} aria-live="polite">
          {echo.query.length} / {ECHO_CHAMBER_LIMITS.maxQueryChars}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[11px] font-bold uppercase tracking-widest mb-1">
          {(t.echoChamberPersonas as string) ?? 'Pick 3-7 voices'}
        </legend>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={(t.echoChamberPersonas as string) ?? 'voices'}
        >
          {availablePersonas.map((name) => {
            const checked = echo.selectedPersonas.includes(name);
            const reachedCap =
              !checked && echo.selectedPersonas.length >= ECHO_CHAMBER_LIMITS.maxPersonas;
            return (
              <button
                key={name}
                type="button"
                onClick={() => echo.togglePersona(name)}
                disabled={submitting || reachedCap}
                aria-pressed={checked}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${checked ? (theme === 'light' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200') : `${subtle} border-transparent hover:border-cyan-500/30`} disabled:opacity-30`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className={`text-[10px] font-mono ${subtle}`} aria-live="polite">
          {echo.selectedPersonas.length} / {ECHO_CHAMBER_LIMITS.maxPersonas}
        </div>
      </fieldset>

      {echo.phase === 'error' && echo.errorReason && (
        <p
          role="status"
          className="text-[11px] text-rose-400 font-mono"
          data-testid="echo-chamber-error"
        >
          {(t[`echoChamberError_${echo.errorReason}`] as string | undefined) ??
            (t.echoChamberErrorGeneric as string) ??
            'Something went wrong, please try again.'}
        </p>
      )}

      {echo.phase === 'cancelled' && (
        <p role="status" className={`text-[11px] font-mono ${subtle}`}>
          {(t.echoChamberCancelled as string) ?? 'Round-table cancelled.'}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 mt-2">
        <CyberButton
          onClick={onSubmit}
          theme={theme}
          disabled={!echo.isReadyToSubmit || submitting}
          aria-label={(t.echoChamberStart as string) ?? 'Start round table'}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
          )}
          {submitting
            ? ((t.echoChamberSubmitting as string) ?? 'Calling the table…')
            : ((t.echoChamberStart as string) ?? 'Start round table')}
        </CyberButton>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Paywall surface (Free tier)                                        */
/* ------------------------------------------------------------------ */

interface PaywallSurfaceProps {
  verdict: PaywallVerdict;
  theme: Theme;
  t: TranslationDictionary;
  onUpgrade?: () => void;
  onClose: () => void;
  subtle: string;
  headerId: string;
}

const PaywallSurface: React.FC<PaywallSurfaceProps> = ({
  verdict,
  theme,
  t,
  onUpgrade,
  onClose,
  subtle,
  headerId,
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-2">
      <Users className="w-5 h-5 text-vector-cyan-neon" aria-hidden="true" />
      <h2 id={headerId} className="text-xl font-bold tracking-wide">
        {(t.echoChamberPaywallHeadline as string) ?? 'Round table is a paid feature'}
      </h2>
    </div>
    <p className={`text-sm leading-relaxed ${subtle}`}>
      {(t.echoChamberPaywallBody as string) ??
        'A round table runs ~5× the AI cost of a single Morning Star reply, so it is included in paid plans only.'}
    </p>
    <div className="flex items-center justify-between gap-3 mt-6">
      <button
        type="button"
        onClick={onClose}
        className={`text-[11px] underline-offset-4 hover:underline ${subtle}`}
      >
        {t.cancel ?? 'Maybe later'}
      </button>
      <CyberButton
        onClick={() => {
          if (onUpgrade) onUpgrade();
          else onClose();
        }}
        theme={theme}
        aria-label={t.echoChamberPaywallUpgrade ?? 'Upgrade'}
      >
        <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
        {verdict.suggestedUpgrade
          ? `${t.echoChamberPaywallUpgrade ?? 'Upgrade to'} ${verdict.suggestedUpgrade.charAt(0).toUpperCase() + verdict.suggestedUpgrade.slice(1)}`
          : (t.echoChamberPaywallContact ?? 'Contact us')}
      </CyberButton>
    </div>
  </div>
);
