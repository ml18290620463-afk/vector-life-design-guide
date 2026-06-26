import { useCallback, useMemo, useState } from 'react';
import { MEMOIR_FIELDS, type MemoirAnswers, type MemoirField } from '../lib/memoirBuilderSchema';
import { mintPersona } from '../services/personaService';
import type { CustomPersona } from '../types';

/**
 * Phase 4 Week 3 Day 4 — `useMemoirBuilder`
 *
 * Drives the 5-step Memoir Builder wizard. Sister hook to
 * [`usePersonaBuilder`](./usePersonaBuilder.ts) with **two extra
 * gates** unique to Memoirs:
 *
 *   1. **Consent acknowledgement** — the user must tick a checkbox
 *      acknowledging:
 *        a) the Memoir is *their memory* of the person, not the
 *           person themselves;
 *        b) VECTOR will never claim to *be* the real person;
 *        c) the Memoir is an emotional companion, NOT a substitute
 *           for professional mental-health care.
 *      Without `consentAcknowledged`, the wizard cannot leave the
 *      final review step.
 *   2. The submit endpoint is `/api/memoir-build` (carrying the
 *      stricter Memoir guardrails) — NOT `/api/persona-build`.
 *
 * The hook still defers persistence to the consumer (Settings panel
 * → `useCustomPersonas.addPersona`). This keeps a future "preview
 * → tweak → save" flow trivial to slot in.
 */

export type MemoirWizardPhase = 'asking' | 'submitting' | 'preview' | 'error';

export interface UseMemoirBuilderArgs {
  initialAnswers?: MemoirAnswers;
  /** Optional fetch override — tests inject a stub instead of
   *  hitting the real `/api/memoir-build`. */
  fetcher?: typeof fetch;
}

export interface UseMemoirBuilderResult {
  steps: readonly MemoirField[];
  stepIndex: number;
  currentStep: MemoirField;
  totalSteps: number;
  phase: MemoirWizardPhase;
  answers: MemoirAnswers;
  generatedMemoir: CustomPersona | null;
  errorMessage: string | null;
  /** True when the user has ticked the safety-acknowledgement
   *  checkbox on the final review step. Submit is gated on this. */
  consentAcknowledged: boolean;
  setConsentAcknowledged: (value: boolean) => void;
  setAnswer: (id: string, value: string) => void;
  isCurrentStepValid: boolean;
  isReadyToSubmit: boolean;
  goNext: () => void;
  goBack: () => void;
  /** Submit the answers to `/api/memoir-build`. Resolves to the
   *  minted `CustomPersona` (with `kind === 'memoir'`) on success. */
  submit: () => Promise<CustomPersona | null>;
  reset: () => void;
}

const isFieldFilled = (answers: MemoirAnswers, field: MemoirField): boolean => {
  if (!field.required) return true;
  const value = answers[field.id];
  return typeof value === 'string' && value.trim().length > 0;
};

export const useMemoirBuilder = (args: UseMemoirBuilderArgs = {}): UseMemoirBuilderResult => {
  const { initialAnswers = {}, fetcher = fetch } = args;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<MemoirAnswers>(initialAnswers);
  const [phase, setPhase] = useState<MemoirWizardPhase>('asking');
  const [generatedMemoir, setGeneratedMemoir] = useState<CustomPersona | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  const totalSteps = MEMOIR_FIELDS.length;
  const currentStep = MEMOIR_FIELDS[Math.min(stepIndex, totalSteps - 1)];

  const isCurrentStepValid = useMemo(
    () => isFieldFilled(answers, currentStep),
    [answers, currentStep],
  );

  const isReadyToSubmit = useMemo(
    () => MEMOIR_FIELDS.every((field) => isFieldFilled(answers, field)),
    [answers],
  );

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((idx) => {
      const field = MEMOIR_FIELDS[idx];
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
    if (!consentAcknowledged) {
      setErrorMessage('CONSENT_NOT_ACKNOWLEDGED');
      setPhase('error');
      return null;
    }
    setPhase('submitting');
    setErrorMessage(null);
    try {
      const response = await fetcher('/api/memoir-build', {
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
        memoir?: { name: string; description?: string; systemPrompt: string };
      };
      const remote = body.memoir;
      if (!remote || !remote.systemPrompt) {
        setErrorMessage('MEMOIR_PAYLOAD_MISSING');
        setPhase('error');
        return null;
      }
      const memoir = mintPersona({
        name: remote.name,
        description: remote.description,
        systemPrompt: remote.systemPrompt,
        kind: 'memoir',
        builderAnswers: Object.fromEntries(
          Object.entries(answers).filter(([, v]) => typeof v === 'string'),
        ) as Record<string, string>,
      });
      setGeneratedMemoir(memoir);
      setPhase('preview');
      return memoir;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
      return null;
    }
  }, [answers, consentAcknowledged, fetcher, isReadyToSubmit]);

  const reset = useCallback(() => {
    setStepIndex(0);
    setAnswers({});
    setPhase('asking');
    setGeneratedMemoir(null);
    setErrorMessage(null);
    setConsentAcknowledged(false);
  }, []);

  return {
    steps: MEMOIR_FIELDS,
    stepIndex,
    currentStep,
    totalSteps,
    phase,
    answers,
    generatedMemoir,
    errorMessage,
    consentAcknowledged,
    setConsentAcknowledged,
    setAnswer,
    isCurrentStepValid,
    isReadyToSubmit,
    goNext,
    goBack,
    submit,
    reset,
  };
};
