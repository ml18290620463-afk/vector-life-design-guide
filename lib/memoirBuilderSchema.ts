/**
 * Phase 4 Week 3 (§5.1.B) — Memoir Builder wizard **shared schema**.
 *
 * The 5-step Memoir wizard is intentionally **shorter** than the
 * 6-step Persona Builder wizard because:
 *   - The emotional weight of "立一座心象" is higher; long forms
 *     break the ritual.
 *   - The "name" field doubles as the relationship anchor, so we
 *     pair it tightly with `relationship` rather than asking for
 *     era / context (which only matters for fictional or historic
 *     personas).
 *
 * Shared between:
 *   - `server/memoirBuilderPrompt.ts` (validates + formats the LLM
 *     synthesis prompt)
 *   - `hooks/useMemoirBuilder.ts` (drives the client wizard state)
 *   - `components/MemoirBuilderModal.tsx` (renders each step)
 *
 * Lives in `lib/` so the client can import it without dragging in
 * the server bundle.
 *
 * Wizard ordering rationale:
 *   1. `name`  — the human anchor; sets the emotional tone.
 *   2. `relationship` — "你与这位心象的关系" (爷爷 / 大学导师 / ...).
 *   3. `voice`  — what they sounded like (5-10 phrases).
 *   4. `memories` — 2-3 specific shared memories.
 *   5. `wishes`  — what the user wants from the relationship now.
 */

export interface MemoirField {
  id: string;
  zhLabel: string;
  enLabel: string;
  /** Longer hint shown beneath the input — Memoir wizard relies on
   *  the hints to keep users in the right emotional register. */
  zhHint: string;
  enHint: string;
  required: boolean;
  maxChars: number;
}

export const MEMOIR_FIELDS: readonly MemoirField[] = [
  {
    id: 'name',
    zhLabel: '心中的这个人叫什么',
    enLabel: 'Who is this person in your heart',
    zhHint: '可以是真名,也可以是你独自给他/她的称呼',
    enHint: 'Their real name, or the name only you call them',
    required: true,
    maxChars: 60,
  },
  {
    id: 'relationship',
    zhLabel: '你和他/她的关系',
    enLabel: 'Your relationship with them',
    zhHint: '例如:奶奶 / 大学导师 / 22 岁的我自己',
    enHint: 'For example: my grandmother, my college mentor, 22-year-old me',
    required: true,
    maxChars: 120,
  },
  {
    id: 'voice',
    zhLabel: '他/她说话的方式 · 几句你还记得的话',
    enLabel: 'How they spoke — a few phrases you still remember',
    zhHint: '尽量贴近原话,这是心象"听起来像他"的关键',
    enHint: 'Use their exact words when you can — this is what makes the memoir sound like them',
    required: true,
    maxChars: 600,
  },
  {
    id: 'memories',
    zhLabel: '你们之间最重要的 2-3 件事',
    enLabel: '2 or 3 things between you that matter most',
    zhHint: '不需要写得很长,关键场景或一句话即可',
    enHint: 'Brief is fine — a key scene or even a single sentence',
    required: true,
    maxChars: 800,
  },
  {
    id: 'wishes',
    zhLabel: '你希望这位心象继续陪你做什么',
    enLabel: 'What do you want this memoir to keep doing alongside you',
    zhHint: '例如:在我焦虑时安慰我 / 在我做决定时给我提醒',
    enHint: 'For example: comfort me when I am anxious, remind me when I face a decision',
    required: false,
    maxChars: 400,
  },
] as const;

export const MEMOIR_FIELD_IDS: ReadonlySet<string> = new Set(MEMOIR_FIELDS.map((f) => f.id));

/** Wizard answer payload — what the client sends to `/api/memoir-build`
 *  and what the server validator returns. */
export type MemoirAnswers = Partial<Record<string, string>>;
