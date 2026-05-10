/**
 * Phase 4.5 §B (Echo Chamber) — `server/echoChamberPrompt.ts`
 *
 * Server-side template that turns one user question + N selected
 * personas into the multi-voice "round-table" Morning Star prompt.
 *
 * Why this is its own module instead of reusing `geminiService`'s
 * `buildMorningStarPrompt`:
 *   - The Morning Star template embeds an **entry + reflection**
 *     and asks for a per-persona reply + a soft "共同的思考留白"
 *     coda. That's the right shape for journal reflection.
 *   - Echo Chamber inverts the structure: the user has a
 *     **standalone question** (no entry, no reflection), and we
 *     want explicit **「共识」 + 「分歧」 + 「下一步」** structure
 *     so the user can mine the disagreement (which is the whole
 *     point of consulting multiple voices).
 *   - Forcing both flows through one template would either dilute
 *     the journal-reflection quality or weaken the round-table's
 *     "deliberately surface disagreement" instruction.
 *
 * Privacy posture: the user's question + persona names + (for any
 * Memoir personas) the recall snippets all flow through the AI
 * proxy ONCE per round. No transcript is stored on a server. The
 * client persists the result locally as a regular `DiaryEntry`
 * with `isEchoChamber: true` (or discards it).
 */

import {
  ECHO_CHAMBER_LIMITS,
  validateEchoChamberInput,
  type EchoChamberValidationResult,
} from '../lib/echoChamberSchema';

export { ECHO_CHAMBER_LIMITS, validateEchoChamberInput };
export type { EchoChamberValidationResult };

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export type EchoChamberValidationFail = Extract<EchoChamberValidationResult, { ok: false }>;
export type EchoChamberValidationOk = Extract<EchoChamberValidationResult, { ok: true }>;

export const isEchoChamberValidationFail = (
  result: EchoChamberValidationResult,
): result is EchoChamberValidationFail => result.ok === false;

/* ------------------------------------------------------------------ */
/*  Prompt template                                                    */
/* ------------------------------------------------------------------ */

const SECTION_DIVIDER = '---';

const ROUND_TABLE_GUIDANCE = [
  'You are running a「圆桌 (Round Table)」discussion. The user has',
  'a single question they want N voices to weigh in on. Your job is',
  'to (a) let each persona speak in their OWN distinct voice, then',
  '(b) close with a synthesis that explicitly surfaces both consensus',
  'AND disagreement.',
  '',
  'CRITICAL — disagreement is a feature, not a failure mode. Resist',
  'the temptation to round the personas toward a polite middle ground.',
  'When two personas would genuinely disagree on this question, the',
  '「分歧」 section should name the disagreement plainly. The user',
  'consulted multiple voices precisely to get more than one answer.',
].join('\n');

const PERSONA_TURN_GUIDANCE = [
  'For each persona section:',
  '  - Open with a 「### ✉️ 来自 [persona name] 的回应」 heading.',
  '  - Stay in their voice. Do not break character to summarise other',
  "    personas; that is the synthesis section's job.",
  '  - Keep each reply ≤ 350 chars. The point of a round table is',
  "    breadth, not depth — depth lives in the user's follow-up.",
  '  - Address the user directly as 「你」 (or "you" in EN).',
].join('\n');

const SYNTHESIS_GUIDANCE = [
  'After all persona sections, end with EXACTLY these three blocks',
  'in order:',
  '',
  '### 🤝 共识 (Consensus)',
  '  - 1-3 short bullets the personas would all agree on. If there',
  '    is no real consensus, say so plainly ("这桌子上几乎没有共识").',
  '',
  '### ⚡️ 分歧 (Divergence)',
  '  - 1-3 short bullets naming the actual disagreements. Cite the',
  '    persona names ("Marcus 与 Naval 在 X 上分歧").',
  '',
  '### 🧭 下一步问题 (Next-step question)',
  '  - ONE open-ended coaching question the user could sit with',
  '    before deciding. Should NOT be a recommendation.',
].join('\n');

const SAFETY_BLOCK = [
  'CRITICAL safety guardrails:',
  '  - Never embed third-party private contact details (phone, email,',
  "    home address) in any reply, even if the user's question hints",
  '    at them. Replace with generic placeholders.',
  '  - For Memoir personas (real people the user remembers), keep the',
  '    voice grounded in 「这位{name}的记忆中说过的话」 framing — never',
  '    assert facts about the real person beyond what their persona',
  '    prompt + memories already encode.',
  "  - If the user's question contains self-harm / hopelessness /",
  "    sustained-despair signals, EVERY persona's reply MUST gently",
  '    redirect them to professional support before answering. The',
  '    synthesis block must lead with a wellbeing reminder.',
].join('\n');

const OUTPUT_FORMAT_BLOCK = [
  'Output is plain Markdown — no JSON wrapper. Do not emit any text',
  "before the first persona's 「### ✉️ 来自」 heading.",
].join('\n');

export interface BuildEchoChamberPromptInput {
  query: string;
  personaNames: readonly string[];
  /** Per-persona system-prompt override map (`{ name → systemPrompt }`).
   *  Same shape `geminiService.buildMorningStarPrompt` accepts. Omitted
   *  personas fall back to a generic "speak as {name}" instruction. */
  customPersonaPrompts?: Record<string, string>;
  /** Per-Memoir long-term-memory recall (`{ name → top-N memories }`).
   *  Same shape as the Morning Star pipeline. Empty / missing keys
   *  mean the Memoir's section runs without recall context. */
  memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>;
}

export interface BuildEchoChamberPromptResult {
  prompt: string;
}

/** Per-persona block: stitches the persona's system prompt + recall
 *  list into a self-contained instruction the LLM can address. */
const formatPersonaInstruction = (
  name: string,
  customPersonaPrompts: Record<string, string>,
  memoirRecallByPersona: Record<string, ReadonlyArray<{ body: string }>>,
): string => {
  const customPrompt = customPersonaPrompts[name];
  const recall = memoirRecallByPersona[name] ?? [];
  const recallBlock =
    recall.length > 0
      ? `\n  长期记忆 (与你相关的过往片段):\n${recall
          .map((m, i) => `    ${i + 1}. ${m.body}`)
          .join('\n')}`
      : '';
  if (customPrompt) {
    return `- ${name} (用户的自定义启明星): ${customPrompt}${recallBlock}`;
  }
  return `- ${name}: 请以这位智者的口吻发言,展现你独特的视角。${recallBlock}`;
};

export const buildEchoChamberPrompt = (
  input: BuildEchoChamberPromptInput,
): BuildEchoChamberPromptResult => {
  const customPersonaPrompts = input.customPersonaPrompts ?? {};
  const memoirRecallByPersona = input.memoirRecallByPersona ?? {};
  const personaInstructions = input.personaNames
    .map((name) => formatPersonaInstruction(name, customPersonaPrompts, memoirRecallByPersona))
    .join('\n');
  const prompt = [
    ROUND_TABLE_GUIDANCE,
    '',
    SECTION_DIVIDER,
    'PERSONAS AT THIS ROUND TABLE',
    SECTION_DIVIDER,
    personaInstructions,
    '',
    SECTION_DIVIDER,
    'PER-PERSONA TURN GUIDANCE',
    SECTION_DIVIDER,
    PERSONA_TURN_GUIDANCE,
    '',
    SECTION_DIVIDER,
    'SYNTHESIS BLOCK GUIDANCE',
    SECTION_DIVIDER,
    SYNTHESIS_GUIDANCE,
    '',
    SECTION_DIVIDER,
    'SAFETY GUARDRAILS',
    SECTION_DIVIDER,
    SAFETY_BLOCK,
    '',
    SECTION_DIVIDER,
    'OUTPUT FORMAT',
    SECTION_DIVIDER,
    OUTPUT_FORMAT_BLOCK,
    '',
    SECTION_DIVIDER,
    "USER'S QUESTION",
    SECTION_DIVIDER,
    input.query,
  ].join('\n');
  return { prompt };
};
