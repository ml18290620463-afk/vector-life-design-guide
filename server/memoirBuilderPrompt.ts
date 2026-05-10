/**
 * Phase 4 Week 3 Day 3 — `server/memoirBuilderPrompt.ts`
 *
 * Server-side template that turns Memoir Builder wizard answers into
 * the AI synthesis prompt. Sister module to
 * [`server/personaBuilderPrompt.ts`](./personaBuilderPrompt.ts) but
 * with **stronger guardrails** because Memoirs ground the persona
 * in a real person from the user's life.
 *
 * Why this lives on the server (not the client):
 *   - The "use the user's MEMORY of this person, not facts about
 *     them" instruction must be authoritative; a hostile client
 *     patch should not be able to bypass it.
 *   - The output schema (`{ name, description, systemPrompt }`) is
 *     enforced server-side via `extractGeneratedMemoir`.
 *
 * Wizard schema lives in `lib/memoirBuilderSchema.ts` so the client
 * wizard can import it without dragging in the server bundle.
 */

import { MEMOIR_FIELDS, MEMOIR_FIELD_IDS, type MemoirField } from '../lib/memoirBuilderSchema';

export { MEMOIR_FIELDS, type MemoirField };

/* ------------------------------------------------------------------ */
/*  Synthesis prompt template                                          */
/* ------------------------------------------------------------------ */

/**
 * The Memoir prompt template is **deliberately more restrictive**
 * than the Persona prompt template:
 *
 *   1. Anti-PII block forbids embedding any third-party private
 *      contact info (same as Persona).
 *   2. **Memory-of-them block** — the new clause unique to Memoirs.
 *      The system prompt MUST be written from the user's
 *      first-person perspective ("the {Name} I remember said..."),
 *      never as a dossier on the real person.
 *   3. **Psychological-safety block** — the system prompt MUST
 *      include explicit instructions to (a) never claim to BE the
 *      real person, (b) never make decisions on the user's behalf,
 *      (c) gently surface a "this is your memory talking" reframe
 *      when the user spirals into prolonged grief.
 *   4. **No-future-claims block** — the persona must never invent
 *      events the real person did not say or do; if asked about
 *      something the user did not provide, defer with a phrase
 *      like "我不记得你提过这个 — 你想跟我讲讲吗?".
 */

const ANTI_PII_BLOCK = [
  'CRITICAL — never embed third-party private contact details (phone',
  'numbers, home addresses, email addresses, ID numbers, account',
  'handles) inside the generated systemPrompt — even if such details',
  'appear in the user answers below. If you encounter any, replace them',
  'with generic placeholders ("{a contact}", "{a home address}").',
].join(' ');

const MEMORY_OF_THEM_BLOCK = [
  "CRITICAL — this Memoir grounds the persona in the USER'S OWN",
  'memory of a real person. The systemPrompt you produce MUST be',
  'written so the model speaks as "the {Name} the user remembers",',
  'NOT as the real person. Whenever the systemPrompt instructs the',
  'model to share an opinion or fact, frame it as a recollection',
  '("我记得我曾经跟你说过...") rather than an assertion about the',
  'real person.',
].join(' ');

const PSYCHOLOGICAL_SAFETY_BLOCK = [
  'CRITICAL — the systemPrompt MUST include the following',
  'safety instructions verbatim (in the language of the rest of',
  'the prompt):',
  "  • Never claim to be the real person — you are the user's",
  '    memory of them, brought to life by them.',
  '  • Never make decisions FOR the user. Offer your perspective,',
  '    then return the choice to them.',
  '  • If the user expresses thoughts of self-harm, hopelessness,',
  '    or sustained despair, GENTLY remind them: "我是你心中的我,',
  '    不能替代专业的帮助。如果你现在很难受,请联系信任的人或求',
  '    助专业心理服务。" Then continue listening.',
  '  • If the user asks you to do something the real person never',
  '    did or said in their lifetime, defer with a soft "我不记得',
  '    你提过这个 — 你想跟我讲讲吗?" rather than inventing.',
].join(' ');

const OUTPUT_SCHEMA_BLOCK = [
  'Respond ONLY with a JSON object matching exactly this shape:',
  '{',
  '  "name": "<short display name, ≤ 60 chars — usually the user\'s `name` answer>",',
  '  "description": "<one-line tagline written in the user\'s voice, ≤ 160 chars>",',
  '  "systemPrompt": "<the full Memoir system prompt, 1200-2400 chars>"',
  '}',
  'No markdown fences, no commentary, no apology, no preamble.',
].join('\n');

const SYSTEM_PROMPT_GUIDANCE = [
  'When you write the systemPrompt:',
  '1. Open with "你是 {Name},是 {USER} 心中的那位 {Name}。" so the',
  "   model knows it is roleplaying the user's memory, not a real",
  '   person.',
  '2. Stitch the user\'s `voice` answer into a "你说话的方式" section.',
  '3. Stitch the user\'s `memories` answer into a "你们共同的回忆"',
  '   section that the model can refer back to.',
  '4. Bake in the safety clauses from PSYCHOLOGICAL SAFETY above.',
  '5. End with: "保持回应在 600 字以内,除非 {USER} 明确希望你说更多。"',
].join('\n');

const SECTION_DIVIDER = '---';

const labelFor = (field: MemoirField): string => `${field.id} (${field.enLabel})`;

const formatAnswers = (answers: Record<string, string>): string =>
  MEMOIR_FIELDS.map((field) => {
    const raw = answers[field.id]?.trim() ?? '';
    if (!raw) return `- ${labelFor(field)}: (no answer)`;
    return `- ${labelFor(field)}:\n${raw.replace(/^/gm, '    ')}`;
  }).join('\n');

export interface BuildMemoirPromptResult {
  prompt: string;
  /** Convenience echo so callers can default `memoir.name` from the
   *  user's first answer if the LLM omits it. */
  fallbackName: string;
}

export const buildMemoirPrompt = (answers: Record<string, string>): BuildMemoirPromptResult => {
  const fallbackName = (answers.name ?? '').trim().slice(0, 60) || '心中的人';
  const prompt = [
    'You are an expert prompt engineer helping a journaling app generate',
    'a custom AI **Memoir** persona — an AI persona grounded in the',
    "user's memory of a real person. Your job is to compose a careful,",
    'high-quality system prompt another LLM can use to roleplay the',
    "USER'S OWN MEMORY of this person during reflective journal",
    'conversations.',
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
    MEMORY_OF_THEM_BLOCK,
    '',
    PSYCHOLOGICAL_SAFETY_BLOCK,
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

export interface MemoirAnswerValidationOk {
  ok: true;
  answers: Record<string, string>;
}

export interface MemoirAnswerValidationFail {
  ok: false;
  reason: string;
}

export type MemoirAnswerValidationResult = MemoirAnswerValidationOk | MemoirAnswerValidationFail;

export const isMemoirAnswerValidationFail = (
  result: MemoirAnswerValidationResult,
): result is MemoirAnswerValidationFail => result.ok === false;

export const validateMemoirAnswers = (raw: unknown): MemoirAnswerValidationResult => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'answers must be a non-array object' };
  }
  const out: Record<string, string> = {};
  for (const field of MEMOIR_FIELDS) {
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
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!MEMOIR_FIELD_IDS.has(key)) {
      return { ok: false, reason: `unknown field: ${key}` };
    }
  }
  return { ok: true, answers: out };
};

/* ------------------------------------------------------------------ */
/*  LLM response parsing                                               */
/* ------------------------------------------------------------------ */

export interface ExtractedMemoir {
  name: string;
  description: string;
  systemPrompt: string;
}

const stripMarkdownFence = (raw: string): string =>
  raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

export const extractGeneratedMemoir = (rawText: string): ExtractedMemoir | null => {
  if (!rawText || typeof rawText !== 'string') return null;
  const stripped = stripMarkdownFence(rawText.trim());
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
