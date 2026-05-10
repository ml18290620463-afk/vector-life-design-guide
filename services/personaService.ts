import type { CustomPersona, CustomPersonaKind, Language } from '../types';
import { GUIDING_STAR_DEFAULTS, PERSONAS } from '../constants';
import { generateSecureId } from './idGenerator';

/**
 * Phase 4 Week 2 (§5.1.A) — `services/personaService.ts`
 *
 * Pure (side-effect-free) data layer for the **自定义启明星** feature.
 * Persistence (IDB / localStorage mirroring) lives in `useDiaryData`,
 * which calls into this module for shape validation, id minting, and
 * built-in vs. custom classification.
 *
 * Why a separate service file instead of inlining into `useDiaryData`?
 *   - The validation + classification helpers are reused by:
 *       1. `usePersonaBuilder` (when wizard finishes synthesising a
 *          new persona)
 *       2. `useGuidingStarsEditor` (when merging the user's directory
 *          with the built-in star list — see §6.2 of the
 *          product-vision doc)
 *       3. `dashboardImport.ts` (when importing a v2 backup; the
 *          imported customPersonas array is run through `sanitizePersona`
 *          before being persisted, same posture as `sanitizeEntry`).
 *   - Pulling the schema validation into a single file keeps Day 6's
 *     backup-schema-v2 work tightly scoped: the importer reuses the
 *     same `looksLikePersona` predicate that the runtime CRUD uses.
 *
 * Privacy posture: a `CustomPersona` is just a name + a description +
 * an AI-synthesised `systemPrompt`. **It must never include third-party
 * PII** (chat logs / emails / phone numbers). The Persona Builder
 * wizard's prompt template explicitly redacts these via a server-side
 * guard in Day 2's `/api/persona-build` endpoint.
 */

const PERSONA_NAME_MAX = 60;
const PERSONA_DESCRIPTION_MAX = 200;
const PERSONA_SYSTEM_PROMPT_MAX = 4000;
const PERSONA_BUILDER_ANSWER_MAX = 1000;

export interface MintPersonaInput {
  name: string;
  description?: string;
  kind?: CustomPersonaKind;
  systemPrompt: string;
  builderAnswers?: Record<string, string>;
}

/** Schema-tight predicate consumed by both runtime CRUD and the
 *  v2-backup importer. Returns false for anything that would corrupt
 *  the personas list rather than throw — same posture as
 *  `dashboardImport.ts::looksLikeEntry`. */
export const looksLikePersona = (value: unknown): value is CustomPersona => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return false;
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) return false;
  if (typeof candidate.systemPrompt !== 'string') return false;
  if (typeof candidate.createdAt !== 'number') return false;
  if (typeof candidate.updatedAt !== 'number') return false;
  if (candidate.kind !== 'persona' && candidate.kind !== 'memoir') return false;
  if (candidate.description !== undefined && typeof candidate.description !== 'string') {
    return false;
  }
  if (candidate.builderAnswers !== undefined) {
    if (typeof candidate.builderAnswers !== 'object' || candidate.builderAnswers === null) {
      return false;
    }
    for (const v of Object.values(candidate.builderAnswers)) {
      if (typeof v !== 'string') return false;
    }
  }
  return true;
};

/** Trims + caps every text field. Used on every read (`hydrate`)
 *  and write (`mintPersona`, `updatePersona`) so a corrupted IDB
 *  payload or a hostile imported backup cannot blow past the UI's
 *  layout assumptions. */
export const sanitizePersona = (input: unknown): CustomPersona | null => {
  if (!looksLikePersona(input)) return null;
  const trimmed: CustomPersona = {
    id: input.id,
    name: input.name.trim().slice(0, PERSONA_NAME_MAX),
    description: input.description?.trim().slice(0, PERSONA_DESCRIPTION_MAX) || undefined,
    kind: input.kind,
    systemPrompt: input.systemPrompt.slice(0, PERSONA_SYSTEM_PROMPT_MAX),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    builderAnswers: input.builderAnswers
      ? Object.fromEntries(
          Object.entries(input.builderAnswers).map(([k, v]) => [
            k,
            String(v).slice(0, PERSONA_BUILDER_ANSWER_MAX),
          ]),
        )
      : undefined,
  };
  return trimmed;
};

/** Hydrate a list of personas read from storage. Drops anything that
 *  fails schema validation (corrupted entries are silently ignored
 *  rather than poisoning the whole list). */
export const hydratePersonas = (raw: unknown): CustomPersona[] => {
  if (!Array.isArray(raw)) return [];
  const out: CustomPersona[] = [];
  for (const item of raw) {
    const sane = sanitizePersona(item);
    if (sane) out.push(sane);
  }
  return out;
};

/** Mint a brand-new `CustomPersona` from wizard output. Sets `id`,
 *  `createdAt`, `updatedAt`, applies field caps, defaults kind to
 *  `'persona'` (the Memoir wizard explicitly passes `'memoir'`). */
export const mintPersona = (input: MintPersonaInput): CustomPersona => {
  const now = Date.now();
  const kind = input.kind ?? 'persona';
  const idPrefix = kind === 'memoir' ? 'memoir' : 'persona';
  const candidate: CustomPersona = {
    id: generateSecureId(idPrefix),
    name: input.name.trim().slice(0, PERSONA_NAME_MAX) || 'Untitled',
    description: input.description?.trim().slice(0, PERSONA_DESCRIPTION_MAX) || undefined,
    kind,
    systemPrompt: input.systemPrompt.slice(0, PERSONA_SYSTEM_PROMPT_MAX),
    createdAt: now,
    updatedAt: now,
    builderAnswers: input.builderAnswers
      ? Object.fromEntries(
          Object.entries(input.builderAnswers).map(([k, v]) => [
            k,
            String(v).slice(0, PERSONA_BUILDER_ANSWER_MAX),
          ]),
        )
      : undefined,
  };
  // Guard: mintPersona's output is itself sanitised. This keeps the
  // contract symmetric with `hydratePersonas` — anything that comes
  // out of this module is schema-clean.
  return sanitizePersona(candidate)!;
};

/** Replace one persona by id. Bumps `updatedAt`. Returns the new
 *  array (caller persists). Returns the same array reference if
 *  no persona matched (caller can early-return). */
export const updatePersona = (
  personas: CustomPersona[],
  id: string,
  patch: Partial<MintPersonaInput>,
): CustomPersona[] => {
  let found = false;
  const next = personas.map((p) => {
    if (p.id !== id) return p;
    found = true;
    const candidate: CustomPersona = {
      ...p,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.systemPrompt !== undefined ? { systemPrompt: patch.systemPrompt } : {}),
      ...(patch.builderAnswers !== undefined ? { builderAnswers: patch.builderAnswers } : {}),
      updatedAt: Date.now(),
    };
    return sanitizePersona(candidate) ?? p;
  });
  return found ? next : personas;
};

/** Remove a persona by id. */
export const deletePersona = (personas: CustomPersona[], id: string): CustomPersona[] =>
  personas.filter((p) => p.id !== id);

/* -------------------------------------------------------------------- */
/*  Built-in vs. custom classification                                  */
/* -------------------------------------------------------------------- */

/**
 * Builds the lookup set of "this name is a built-in star" for the
 * given language. Used by the guiding-star editor to decide whether
 * to render a 「自定义」badge and a delete button next to a name.
 *
 * Includes both:
 *   - The localised `GUIDING_STAR_DEFAULTS[language]` list (Chinese
 *     names / French names / etc).
 *   - The English canonical `PERSONAS` list — Morning Star prompts
 *     hold the canonical English persona keys, so any locale's
 *     localised name OR its English source must round-trip.
 */
export const getBuiltInStarSet = (language: Language): ReadonlySet<string> => {
  const localised = GUIDING_STAR_DEFAULTS[language] ?? [];
  return new Set<string>([...PERSONAS, ...localised]);
};

/** True when `name` matches a built-in (default) star for the active
 *  language. Used by the editor to gate destructive actions (delete /
 *  rename). */
export const isBuiltInStar = (name: string, language: Language): boolean =>
  getBuiltInStarSet(language).has(name);

/** Find a custom persona by visible name. Used by Morning Star at
 *  chat time to decide whether to inject the user's `systemPrompt`
 *  alongside the built-in template. Returns undefined when the name
 *  belongs to a built-in star (or no persona matched). */
export const findCustomPersonaByName = (
  personas: CustomPersona[],
  name: string,
): CustomPersona | undefined => personas.find((p) => p.name === name);

/* -------------------------------------------------------------------- */
/*  Public field caps (re-exported for the UI to display character     */
/*  counters next to inputs).                                          */
/* -------------------------------------------------------------------- */

export const PERSONA_LIMITS = {
  name: PERSONA_NAME_MAX,
  description: PERSONA_DESCRIPTION_MAX,
  systemPrompt: PERSONA_SYSTEM_PROMPT_MAX,
  builderAnswer: PERSONA_BUILDER_ANSWER_MAX,
} as const;
