import { useCallback, useMemo, useState } from 'react';
import { WIZARD_FIELDS, type WizardAnswers, type WizardField } from '../lib/personaBuilderSchema';
import { mintPersona } from '../services/personaService';
import type { CustomPersona } from '../types';

/**
 * Phase 4 Week 2 Day 2 — `usePersonaBuilder`
 *
 * Drives the 6-step Persona Builder wizard:
 *   - tracks the current step index
 *   - holds the in-flight wizard answers (controlled inputs)
 *   - validates required fields per-step + at submission
 *   - calls `/api/persona-build` to synthesise the system prompt
 *   - on success, mints a new `CustomPersona` and hands it to the
 *     consumer (Settings panel passes it to `useCustomPersonas.addPersona`)
 *
 * Architecture note: the synthesis call is fire-and-forget — the hook
 * does NOT itself persist the resulting persona. That responsibility
 * lives in the consumer so the hook stays composable (a future
 * "preview before saving" UX can intercept the persona at the same
 * point in the flow without needing to undo a write).
 */

export type WizardPhase = 'asking' | 'submitting' | 'preview' | 'error';

export interface UsePersonaBuilderArgs {
  /** Optional pre-fill (used when re-opening the wizard for an
   *  existing persona to tweak). */
  initialAnswers?: WizardAnswers;
  /** Optional fetcher override — tests inject a stub instead of
   *  hitting the real `/api/persona-build`. */
  fetcher?: typeof fetch;
}

export interface UsePersonaBuilderResult {
  /** All wizard step definitions (UI iterates this list). */
  steps: readonly WizardField[];
  /** Current step index, 0-based. */
  stepIndex: number;
  /** Snapshot of the active step (helper for the UI render). */
  currentStep: WizardField;
  /** Total number of steps; convenience for "Step N of M" UI. */
  totalSteps: number;
  /** Phase of the wizard (drives the UI surface). */
  phase: WizardPhase;
  /** In-flight answers, keyed by `WizardField.id`. */
  answers: WizardAnswers;
  /** Persona returned by the LLM (only set in the `preview` phase). */
  generatedPersona: CustomPersona | null;
  /** Error message bubbled up from the API (only set in `error`). */
  errorMessage: string | null;
  /** Mutate one answer in place. */
  setAnswer: (id: string, value: string) => void;
  /** Whether the current step's required-field check passes. */
  isCurrentStepValid: boolean;
  /** Whether every required field across the wizard is filled. */
  isReadyToSubmit: boolean;
  /** Move to the next step (no-op when on the last step or current
   *  step is invalid). */
  goNext: () => void;
  /** Move back one step (no-op on step 0). */
  goBack: () => void;
  /** Submit the answers to `/api/persona-build`. Resolves to the
   *  `CustomPersona` on success, or `null` on validation / network
   *  error (in which case `phase` flips to `'error'` and
   *  `errorMessage` carries the detail). */
  submit: () => Promise<CustomPersona | null>;
  /** Reset to step 0 with empty answers. */
  reset: () => void;
}

const isFieldFilled = (answers: WizardAnswers, field: WizardField): boolean => {
  if (!field.required) return true;
  const value = answers[field.id];
  return typeof value === 'string' && value.trim().length > 0;
};

export const usePersonaBuilder = (args: UsePersonaBuilderArgs = {}): UsePersonaBuilderResult => {
  const { initialAnswers = {}, fetcher = fetch } = args;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>(initialAnswers);
  const [phase, setPhase] = useState<WizardPhase>('asking');
  const [generatedPersona, setGeneratedPersona] = useState<CustomPersona | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalSteps = WIZARD_FIELDS.length;
  const currentStep = WIZARD_FIELDS[Math.min(stepIndex, totalSteps - 1)];

  const isCurrentStepValid = useMemo(
    () => isFieldFilled(answers, currentStep),
    [answers, currentStep],
  );

  const isReadyToSubmit = useMemo(
    () => WIZARD_FIELDS.every((field) => isFieldFilled(answers, field)),
    [answers],
  );

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((idx) => {
      const field = WIZARD_FIELDS[idx];
      if (!isFieldFilled(answers, field)) return idx;
      return Math.min(idx + 1, totalSteps - 1);
    });
  }, [answers, totalSteps]);

  const goBack = useCallback(() => {
    setStepIndex((idx) => Math.max(idx - 1, 0));
  }, []);

  const submit = useCallback(async (): Promise<CustomPersona | null> => {
    if (!isReadyToSubmit) {
      setErrorMessage('SOME_REQUIRED_ANSWERS_MISSING');
      setPhase('error');
      return null;
    }
    setPhase('submitting');
    setErrorMessage(null);
    try {
      const response = await fetcher('/api/persona-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) {
        let detail: string | undefined;
        try {
          const errBody = (await response.json()) as { error?: string; detail?: string };
          detail = errBody.detail || errBody.error;
        } catch {
          // fall through — leave detail undefined
        }
        setErrorMessage(detail || `HTTP ${response.status}`);
        setPhase('error');
        return null;
      }
      const body = (await response.json()) as {
        persona?: { name: string; description?: string; systemPrompt: string };
      };
      const remote = body.persona;
      if (!remote || !remote.systemPrompt) {
        setErrorMessage('PERSONA_PAYLOAD_MISSING');
        setPhase('error');
        return null;
      }
      const persona = mintPersona({
        name: remote.name,
        description: remote.description,
        systemPrompt: remote.systemPrompt,
        builderAnswers: Object.fromEntries(
          Object.entries(answers).filter(([, v]) => typeof v === 'string'),
        ) as Record<string, string>,
      });
      setGeneratedPersona(persona);
      setPhase('preview');
      return persona;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
      return null;
    }
  }, [answers, fetcher, isReadyToSubmit]);

  const reset = useCallback(() => {
    setStepIndex(0);
    setAnswers({});
    setPhase('asking');
    setGeneratedPersona(null);
    setErrorMessage(null);
  }, []);

  return {
    steps: WIZARD_FIELDS,
    stepIndex,
    currentStep,
    totalSteps,
    phase,
    answers,
    generatedPersona,
    errorMessage,
    setAnswer,
    isCurrentStepValid,
    isReadyToSubmit,
    goNext,
    goBack,
    submit,
    reset,
  };
};
