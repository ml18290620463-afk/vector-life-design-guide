/**
 * Phase 4.5 §B (Echo Chamber) — shared input schema.
 *
 * Sister to `lib/personaBuilderSchema.ts` + `lib/memoirBuilderSchema.ts`:
 * isomorphic constants used by BOTH the client wizard
 * (`hooks/useEchoChamber`, `components/EchoChamberModal`) AND the
 * server validator (`server/echoChamberPrompt.ts`). Living in `lib/`
 * keeps the client free of any server-bundle imports.
 *
 * Why the bounds:
 *   - `MIN_PERSONAS = 3` — fewer than three personas isn't really a
 *     "round table"; the existing single-/double-persona flow lives
 *     in the Viewer's Morning Star surface.
 *   - `MAX_PERSONAS = 7` — past seven the LLM context window starts
 *     compressing each persona's reply to platitudes, defeating the
 *     value of distinct voices. 7 also matches the built-in Morning
 *     Star sage count, which is a familiar UX anchor.
 *   - `MAX_QUERY_CHARS = 1500` — the round-table prompt template
 *     embeds the query verbatim; longer queries crowd out the
 *     per-persona reply budget.
 *   - `MIN_QUERY_CHARS = 16` — defensive against accidental empty
 *     submissions; well below the natural shape of a real question.
 */

export const ECHO_CHAMBER_LIMITS = {
  minPersonas: 3,
  maxPersonas: 7,
  minQueryChars: 16,
  maxQueryChars: 1500,
} as const;

/** Validate a candidate Echo Chamber input. Pure helper — both the
 *  client wizard and the server validator pipe candidates through
 *  it so the rejection messaging stays consistent. */
export interface EchoChamberInput {
  query: string;
  personaNames: readonly string[];
}

export type EchoChamberValidationResult =
  | { ok: true; query: string; personaNames: readonly string[] }
  | { ok: false; reason: string };

const stripQuery = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().slice(0, ECHO_CHAMBER_LIMITS.maxQueryChars) : '';

const stripPersonas = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const name = item.trim();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= ECHO_CHAMBER_LIMITS.maxPersonas) break;
  }
  return out;
};

export const validateEchoChamberInput = (raw: unknown): EchoChamberValidationResult => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'input must be a non-array object' };
  }
  const candidate = raw as Record<string, unknown>;
  const query = stripQuery(candidate.query);
  if (query.length < ECHO_CHAMBER_LIMITS.minQueryChars) {
    return {
      ok: false,
      reason: `query must be at least ${ECHO_CHAMBER_LIMITS.minQueryChars} characters`,
    };
  }
  const personas = stripPersonas(candidate.personaNames);
  if (personas.length < ECHO_CHAMBER_LIMITS.minPersonas) {
    return {
      ok: false,
      reason: `pick at least ${ECHO_CHAMBER_LIMITS.minPersonas} personas`,
    };
  }
  return { ok: true, query, personaNames: personas };
};
