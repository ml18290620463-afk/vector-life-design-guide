/**
 * Phase 4 Week 3 Day 6 — `server/memoryExtractor.ts`
 *
 * Extracts long-term memory candidates from a closed Memoir
 * conversation. Sister module to
 * [`server/personaBuilderPrompt.ts`](./personaBuilderPrompt.ts) but
 * with a fundamentally different shape: rather than synthesising a
 * single system prompt, this template asks the LLM to return a
 * **list** of bite-sized memories with categories.
 *
 * Why server-side?
 *   - The extraction prompt embeds explicit anti-PII instructions
 *     ("never store third-party contact info"). Hostile clients
 *     should not be able to bypass these.
 *   - The output format is enforced via `parseExtractedMemories`
 *     so the client can blindly trust whatever the endpoint returns
 *     (after running the second-line `detectUnsafeMemoryBody` check
 *     in [`services/memoryService.ts`](../services/memoryService.ts)).
 *
 * Privacy posture: the conversation transcript is sent through the
 * AI proxy ONCE (at extraction time) and never stored on a server.
 * Per [`docs/product-vision-2026Q2.md`](../docs/product-vision-2026Q2.md)
 * §1 铁律 1, the extracted memories live exclusively in the user's
 * device-local IDB.
 */

import type { MemoryCategory } from '../types/models';

/* ------------------------------------------------------------------ */
/*  Output schema                                                      */
/* ------------------------------------------------------------------ */

export interface ExtractedMemoryCandidate {
  category: MemoryCategory;
  body: string;
}

/** A single transcript turn passed to the extractor. */
export interface MemoirConversationTurn {
  /** `'user'` for the human, `'memoir'` for the AI persona. */
  role: 'user' | 'memoir';
  /** Plain-text content of the turn. The extractor template caps
   *  the formatted prompt at ~8K tokens — callers should slice
   *  long conversations BEFORE invoking. */
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Prompt template                                                    */
/* ------------------------------------------------------------------ */

const ANTI_PII_BLOCK = [
  'CRITICAL — never include third-party private contact details',
  '(phone numbers, home addresses, email addresses, ID numbers,',
  'account handles) in any extracted memory. If the conversation',
  'contains such details, simply omit the memory or paraphrase',
  'around the detail.',
].join(' ');

const EXTRACTION_GUIDANCE = [
  'Extract 0-8 short, factual memory candidates from the conversation.',
  'Each memory must be:',
  '  - ≤ 240 characters (preferably ≤ 120),',
  '  - written in the third person about the USER',
  '    (e.g. "用户上周面试通过了", NOT "I passed an interview"),',
  '  - tagged with one of these four categories:',
  '      "fact"         — concrete events, plans, occurrences',
  '      "emotion"      — emotional state markers',
  '      "relationship" — third-party relationship state',
  '      "milestone"    — date-anchored life events',
  '  - free of any direct quote longer than 30 characters from the',
  '    Memoir persona itself (do not memorise its scripted lines).',
  'If nothing in the conversation rises to the level of a long-term',
  'memory, return an empty list. Quality > quantity.',
].join('\n');

const OUTPUT_SCHEMA_BLOCK = [
  'Respond ONLY with a JSON object matching exactly this shape:',
  '{',
  '  "memories": [',
  '    { "category": "fact" | "emotion" | "relationship" | "milestone",',
  '      "body": "<≤ 240 chars>" }',
  '  ]',
  '}',
  'No markdown fences, no commentary, no apology, no preamble.',
  'If no memories rise to threshold, return: { "memories": [] }',
].join('\n');

const SECTION_DIVIDER = '---';

const formatTranscript = (turns: MemoirConversationTurn[]): string =>
  turns
    .map((turn) => {
      const role = turn.role === 'user' ? 'USER' : 'MEMOIR';
      return `${role}: ${turn.content.replace(/\s+/g, ' ').trim()}`;
    })
    .join('\n');

export interface BuildExtractorPromptResult {
  prompt: string;
}

export const buildExtractorPrompt = (
  turns: MemoirConversationTurn[],
): BuildExtractorPromptResult => {
  const prompt = [
    'You are an expert memory curator helping a journaling app extract',
    'long-term memory candidates from a Memoir conversation. The Memoir',
    "is the user's OWN MEMORY of a real person; the goal is to remember",
    'things ABOUT THE USER so future conversations feel continuous, not',
    'to memorise things about the real third party.',
    '',
    SECTION_DIVIDER,
    'CONVERSATION',
    SECTION_DIVIDER,
    formatTranscript(turns),
    '',
    SECTION_DIVIDER,
    'SAFETY GUARDRAILS',
    SECTION_DIVIDER,
    ANTI_PII_BLOCK,
    '',
    SECTION_DIVIDER,
    'EXTRACTION GUIDANCE',
    SECTION_DIVIDER,
    EXTRACTION_GUIDANCE,
    '',
    SECTION_DIVIDER,
    'OUTPUT FORMAT',
    SECTION_DIVIDER,
    OUTPUT_SCHEMA_BLOCK,
  ].join('\n');
  return { prompt };
};

/* ------------------------------------------------------------------ */
/*  Server-side validation                                             */
/* ------------------------------------------------------------------ */

export interface TranscriptValidationOk {
  ok: true;
  turns: MemoirConversationTurn[];
}

export interface TranscriptValidationFail {
  ok: false;
  reason: string;
}

export type TranscriptValidationResult = TranscriptValidationOk | TranscriptValidationFail;

export const isTranscriptValidationFail = (
  result: TranscriptValidationResult,
): result is TranscriptValidationFail => result.ok === false;

const MAX_TURNS = 50;
const MAX_TURN_CHARS = 4000;

export const validateTranscript = (raw: unknown): TranscriptValidationResult => {
  if (!Array.isArray(raw)) {
    return { ok: false, reason: 'transcript must be an array of turns' };
  }
  if (raw.length === 0) {
    return { ok: false, reason: 'transcript is empty' };
  }
  if (raw.length > MAX_TURNS) {
    return { ok: false, reason: `transcript exceeds ${MAX_TURNS} turns` };
  }
  const out: MemoirConversationTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, reason: 'every turn must be an object' };
    }
    const c = item as Record<string, unknown>;
    if (c.role !== 'user' && c.role !== 'memoir') {
      return { ok: false, reason: 'turn.role must be "user" or "memoir"' };
    }
    if (typeof c.content !== 'string') {
      return { ok: false, reason: 'turn.content must be a string' };
    }
    out.push({
      role: c.role,
      content: c.content.slice(0, MAX_TURN_CHARS),
    });
  }
  return { ok: true, turns: out };
};

/* ------------------------------------------------------------------ */
/*  LLM response parsing                                               */
/* ------------------------------------------------------------------ */

const stripMarkdownFence = (raw: string): string =>
  raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

const isMemoryCategory = (value: unknown): value is MemoryCategory =>
  value === 'fact' || value === 'emotion' || value === 'relationship' || value === 'milestone';

/**
 * Parse the LLM's response into a list of `ExtractedMemoryCandidate`s.
 * Returns `null` ONLY when the response is unsalvageable (cannot find
 * any JSON object). When parsing succeeds but the `memories` key is
 * absent or empty, returns an empty array — that is the documented
 * "nothing rose to threshold" path, not an error.
 *
 * Caller MUST still run each candidate body through
 * `services/memoryService.detectUnsafeMemoryBody` before persisting.
 * The LLM is the first line of defence; the service is the second.
 */
export const parseExtractedMemories = (rawText: string): ExtractedMemoryCandidate[] | null => {
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
  const memoriesRaw = (parsed as Record<string, unknown>).memories;
  if (memoriesRaw === undefined) return [];
  if (!Array.isArray(memoriesRaw)) return null;
  const out: ExtractedMemoryCandidate[] = [];
  for (const item of memoriesRaw) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (!isMemoryCategory(c.category)) continue;
    if (typeof c.body !== 'string') continue;
    const body = c.body.trim();
    if (body.length === 0) continue;
    out.push({ category: c.category, body });
  }
  return out;
};
