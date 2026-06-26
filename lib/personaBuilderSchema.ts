/**
 * Phase 4 Week 2 (§5.1.A) — Persona Builder wizard **shared schema**.
 *
 * The 6-step wizard's question schema is shared between:
 *   - `server/personaBuilderPrompt.ts` (validates inbound answers,
 *     formats them into the LLM synthesis prompt)
 *   - `hooks/usePersonaBuilder.ts` (drives the client wizard UI)
 *   - `components/PersonaBuilder/PersonaBuilderModal.tsx` (renders
 *     each step with its localised label)
 *
 * Keeping it here (`lib/`) avoids the client-importing-server-module
 * smell — the file is fully isomorphic (zero runtime dependencies).
 */

export interface WizardField {
  /** Stable id consumed by the client wizard + server validator. */
  id: string;
  /** Short label shown in the wizard step header. */
  zhLabel: string;
  enLabel: string;
  /** Whether the wizard MUST collect a value before submission. */
  required: boolean;
  /** Hard cap on raw answer length before sending to the LLM. */
  maxChars: number;
}

/**
 * The 6-step wizard. Order matters — the client renders one step
 * per entry. `name` is intentionally first so the user's intuition
 * about "who" anchors every later answer.
 *
 * Trade-off: 6 questions is the empirical sweet spot from
 * [`docs/product-vision-2026Q2.md`](../docs/product-vision-2026Q2.md) §5.1.A.
 * Fewer leaves the LLM with too little signal; more frustrates
 * users mid-wizard.
 */
export const WIZARD_FIELDS: readonly WizardField[] = [
  {
    id: 'name',
    zhLabel: '这位启明星叫什么',
    enLabel: 'Who is this guiding star',
    required: true,
    maxChars: 60,
  },
  {
    id: 'context',
    zhLabel: '他/她所处的时代或背景',
    enLabel: 'Era or context',
    required: true,
    maxChars: 200,
  },
  {
    id: 'philosophy',
    zhLabel: '他/她最核心的几条理念',
    enLabel: 'Core ideas / philosophy',
    required: true,
    maxChars: 600,
  },
  {
    id: 'voice',
    zhLabel: '他/她说话的口吻、几句记得的话',
    enLabel: 'Voice — phrases or quotes you remember',
    required: false,
    maxChars: 600,
  },
  {
    id: 'style',
    zhLabel: '回应你时应该采取的对话风格',
    enLabel: 'Conversational style they should take',
    required: true,
    maxChars: 300,
  },
  {
    id: 'avoid',
    zhLabel: '应当回避的话题或语气',
    enLabel: 'Topics or tones to avoid',
    required: false,
    maxChars: 300,
  },
] as const;

export const WIZARD_FIELD_IDS: ReadonlySet<string> = new Set(WIZARD_FIELDS.map((f) => f.id));

/**
 * Wizard answer payload — what the client sends to
 * `/api/persona-build` and what the server validator returns.
 */
export type WizardAnswers = Partial<Record<string, string>>;
