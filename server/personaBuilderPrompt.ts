/**
 * Phase 4 Week 2 Day 2 — `server/personaBuilderPrompt.ts`
 *
 * Server-side template that turns Persona Builder wizard answers into
 * an AI synthesis prompt. The user's wizard answers are the *data*;
 * the template provides the *instructions* the LLM needs to compose
 * a high-quality system prompt for a custom 启明星.
 *
 * Why this lives on the server (not the client):
 *   - The template embeds explicit anti-PII instructions ("redact any
 *     real-world contact details / addresses / phone numbers"). These
 *     guardrails must be authoritative and impossible to bypass via
 *     a hostile client patch.
 *   - The output schema is a single-shot contract enforced server-side
 *     (`extractGeneratedPrompt` parses the LLM response). Clients
 *     just receive `{ name, description, systemPrompt }`.
 *
 * The wizard schema (`WIZARD_FIELDS`) lives in `lib/personaBuilderSchema.ts`
 * because the client wizard imports it too. We re-export it from this
 * module for convenience (so server-side callers don't need a separate
 * import).
 */

import { WIZARD_FIELDS, WIZARD_FIELD_IDS, type WizardField } from '../lib/personaBuilderSchema';

export { WIZARD_FIELDS, type WizardField };

/* ------------------------------------------------------------------ */
/*  Synthesis prompt template                                          */
/* ------------------------------------------------------------------ */

const ANTI_PII_BLOCK = [
  'CRITICAL: never embed third-party private contact details (phone numbers,',
  'home addresses, email addresses, ID numbers, account handles) inside',
  'the generated systemPrompt — even if such details appear in the user',
  'answers below. If you encounter any, replace them with generic placeholders',
  '(e.g. "{a contact}", "{a home address}").',
].join(' ');

const ANTI_LIVING_THIRD_PARTY_BLOCK = [
  'If the user describes a real living third party, prefer to ground the',
  'persona in the user\'s OWN memory of them ("the {Name} I remember said...")',
  'rather than asserting facts about that person. The system prompt you',
  'generate must read as a creative interpretation, not a dossier on a real',
  'human.',
].join(' ');

const OUTPUT_SCHEMA_BLOCK = [
  'Respond ONLY with a JSON object matching exactly this shape:',
  '{',
  '  "name": "<short display name, ≤ 60 chars>",',
  '  "description": "<one-line tagline, ≤ 160 chars>",',
  '  "systemPrompt": "<the full persona system prompt, 800-2000 chars>"',
  '}',
  'No markdown fences, no commentary, no apology, no preamble.',
].join('\n');

const SYSTEM_PROMPT_GUIDANCE = [
  'When you write the systemPrompt:',
  '1. Address the eventual reader as "you are X" — set the persona contract.',
  '2. Bake in voice / style / avoid-list cues from the wizard answers.',
  '3. Stay above ~2000 chars; the value is sharpness, not length.',
  '4. End with one sentence telling the model to keep responses under 600',
  '   chars unless the user explicitly asks for more — VECTOR is a reflection',
  '   journal, not a chatbot.',
].join('\n');

const SECTION_DIVIDER = '---';

const labelFor = (field: WizardField): string => `${field.id} (${field.enLabel})`;

const formatAnswers = (answers: Record<string, string>): string =>
  WIZARD_FIELDS.map((field) => {
    const raw = answers[field.id]?.trim() ?? '';
    if (!raw) return `- ${labelFor(field)}: (no answer)`;
    return `- ${labelFor(field)}:\n${raw.replace(/^/gm, '    ')}`;
  }).join('\n');

export interface BuildPersonaPromptResult {
  prompt: string;
  /** Convenience echo so callers can default persona.name from the
   *  user's first answer if the LLM omits it. */
  fallbackName: string;
}

/**
 * Build the LLM synthesis prompt from validated wizard answers.
 * Caller is responsible for running the answers through the
 * injection-guard + size-cap layer first (`/api/persona-build`
 * endpoint enforces this).
 */
export const buildPersonaPrompt = (answers: Record<string, string>): BuildPersonaPromptResult => {
  const fallbackName = (answers.name ?? '').trim().slice(0, 60) || 'Untitled';
  const prompt = [
    'You are an expert prompt engineer helping a journaling app generate',
    'a custom AI guiding-star persona. The user has answered a 6-step',
    'wizard describing the persona they want; your job is to compose a',
    'concise, high-quality system prompt that another LLM can use to',
    'roleplay this persona during reflective journal conversations.',
    '',
    SECTION_DIVIDER,
    'WIZARD ANSWERS',
    SECTION_DIVIDER,
    formatAnswers(answers),
    '',
    SECTION_DIVIDER,
    'SAFETY GUARDRAILS',
    SECTION_DIVIDER,
    ANTI_PII_BLOCK,
    '',
    ANTI_LIVING_THIRD_PARTY_BLOCK,
    '',
    SECTION_DIVIDER,
    'SYSTEM PROMPT GUIDANCE',
    SECTION_DIVIDER,
    SYSTEM_PROMPT_GUIDANCE,
    '',
    SECTION_DIVIDER,
    'OUTPUT FORMAT',
    SECTION_DIVIDER,
    OUTPUT_SCHEMA_BLOCK,
  ].join('\n');
  return { prompt, fallbackName };
};

/* ------------------------------------------------------------------ */
/*  Server-side validation                                             */
/* ------------------------------------------------------------------ */

export interface AnswerValidationOk {
  ok: true;
  answers: Record<string, string>;
}

export interface AnswerValidationFail {
  ok: false;
  reason: string;
}

export type AnswerValidationResult = AnswerValidationOk | AnswerValidationFail;

/** Type guard: narrows to the success branch. */
export const isAnswerValidationOk = (
  result: AnswerValidationResult,
): result is AnswerValidationOk => result.ok === true;

/** Type guard: narrows to the failure branch. */
export const isAnswerValidationFail = (
  result: AnswerValidationResult,
): result is AnswerValidationFail => result.ok === false;

/**
 * Validate the answers payload coming from the client. Returns a
 * trimmed + capped copy on success so the caller can hand it
 * directly to `buildPersonaPrompt`.
 */
export const validateWizardAnswers = (raw: unknown): AnswerValidationResult => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'answers must be a non-array object' };
  }
  const out: Record<string, string> = {};
  for (const field of WIZARD_FIELDS) {
    const candidate = (raw as Record<string, unknown>)[field.id];
    if (candidate == null || candidate === '') {
      if (field.required) {
        return { ok: false, reason: `missing required field: ${field.id}` };
      }
      continue;
    }
    if (typeof candidate !== 'string') {
      return { ok: false, reason: `field ${field.id} must be a string` };
    }
    out[field.id] = candidate.trim().slice(0, field.maxChars);
  }
  // Reject answer payloads that include unknown ids (defensive: prevents
  // a hostile client from hiding instructions in extra fields the
  // template forwards verbatim).
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!WIZARD_FIELD_IDS.has(key)) {
      return { ok: false, reason: `unknown field: ${key}` };
    }
  }
  return { ok: true, answers: out };
};

/* ------------------------------------------------------------------ */
/*  LLM response parsing                                               */
/* ------------------------------------------------------------------ */

export interface ExtractedPersona {
  name: string;
  description: string;
  systemPrompt: string;
}

const stripMarkdownFence = (raw: string): string =>
  raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

/**
 * Best-effort parse of the LLM's response into the
 * `{ name, description, systemPrompt }` triple. Handles common LLM
 * misbehaviours:
 *   - Wrapped in ```json``` fences (some providers add them despite
 *     instructions).
 *   - Leading / trailing prose ("Sure, here is your persona: { ... }").
 *   - Missing optional `description` (defaults to empty string).
 *
 * Returns `null` when the response is unsalvageable; the caller
 * should surface a 502 in that case so the client can show a
 * friendly retry.
 */
export const extractGeneratedPrompt = (rawText: string): ExtractedPersona | null => {
  if (!rawText || typeof rawText !== 'string') return null;
  const stripped = stripMarkdownFence(rawText.trim());
  // Find the first `{` and the matching last `}`. This handles the
  // "Sure, here is { ... }" leading-prose case without needing a
  // full JSON streaming parser.
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  const jsonChunk = stripped.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonChunk);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  const systemPrompt = typeof obj.systemPrompt === 'string' ? obj.systemPrompt.trim() : '';
  if (!name || !systemPrompt) return null;
  return { name, description, systemPrompt };
};
