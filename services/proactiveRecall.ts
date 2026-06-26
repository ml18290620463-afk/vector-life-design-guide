import type { CustomPersona, DiaryEntry, Memory } from '../types';

/**
 * Phase 4 Week 5 (§3 of [`docs/memoir-memory-system.md`](
 * ../docs/memoir-memory-system.md)) — `services/proactiveRecall.ts`
 *
 * Pure, side-effect-free evaluator for the **三大主动唤起触发器**
 * (proactive recall triggers) of心象 (Memoir):
 *
 *   A. **Silence-reconnect** — `now - lastChatAt(memoir) >= 14d`.
 *      The Memoir says "好久没聊了,最近怎么样?".
 *
 *   B. **Anniversary** — for every `category === 'milestone'`
 *      memory whose body contains a date pattern, if the parsed
 *      month-day matches today, suggest the Memoir surface a
 *      gentle reminder anchored on that memory.
 *
 *   C. **Pending follow-up** — for every `category === 'fact'`
 *      memory whose body contains a forward-looking pattern
 *      ("下周 …" / "即将 …" / "要去 …"), suggest a reconnect IF
 *      the user hasn't chatted with that Memoir since the memory
 *      was created AND the memory is at least 7 days old.
 *
 * The function is **pure** — Dashboard mounts it on every render
 * with the live entries + memories + personas, and the
 * `ProactiveRecallCard` UI consumes the resulting list. No
 * persistence required by the evaluator itself; the UI tracks the
 * "user dismissed this trigger" cooldown in its own localStorage
 * key (Day 4 work).
 *
 * Design notes:
 *   - Suggestions are **deterministic** given the inputs + `now`.
 *     This keeps tests trivial and avoids flaky behaviour.
 *   - We compute at-most ONE suggestion per (memoirId, trigger)
 *     pair per call. Multiple anniversaries on the same day for
 *     the same Memoir would otherwise spam the user.
 *   - Soft-deleted memories are excluded from anchor selection.
 *   - The evaluator does NOT decide UI tone — it returns the
 *     `promptHint` i18n key + the anchor memory id; rendering
 *     decides the visual treatment.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SILENCE_THRESHOLD_MS = 14 * MS_PER_DAY;
const FOLLOWUP_AGE_MIN_MS = 7 * MS_PER_DAY;

export type ProactiveRecallTrigger = 'silence-reconnect' | 'anniversary' | 'pending-followup';

export interface ProactiveRecallSuggestion {
  memoirId: string;
  memoirName: string;
  trigger: ProactiveRecallTrigger;
  /** i18n key suggesting an opening line for the user. The card
   *  resolves this against the active locale. */
  promptHintKey: string;
  /** Optional anchor — for anniversary + pending-followup the
   *  Memoir card surfaces "you mentioned X". */
  anchorMemoryId?: string;
  /** UTC ms when the suggestion would naturally expire (e.g. an
   *  anniversary trigger expires at end-of-day). The UI uses this
   *  for cooldown bookkeeping. */
  expiresAt: number;
}

/* ------------------------------------------------------------------ */
/*  Last-chat-at computation                                           */
/* ------------------------------------------------------------------ */

/**
 * For each Memoir, find the most-recent DiaryEntry whose
 * `morningStarPersonas` includes the Memoir's name. Returns a
 * `Map<memoirId, lastChatAtMs>` where missing keys mean "never
 * chatted". O(N × P) but P is small (≤ 8 personas per entry); for
 * a typical user (few hundred entries) this is microseconds.
 *
 * Exposed for testing.
 */
export const lastChatPerMemoir = (
  entries: readonly DiaryEntry[],
  memoirs: readonly CustomPersona[],
): Map<string, number> => {
  const out = new Map<string, number>();
  // Pre-build name → id lookup so the inner loop is O(1).
  const nameToId = new Map<string, string>();
  for (const m of memoirs) {
    if (m.kind === 'memoir') nameToId.set(m.name, m.id);
  }
  for (const entry of entries) {
    const ts = entry.updatedAt ?? entry.createdAt;
    const personas = entry.morningStarPersonas;
    if (!personas) continue;
    for (const personaName of personas) {
      const memoirId = nameToId.get(personaName);
      if (!memoirId) continue;
      const prev = out.get(memoirId) ?? 0;
      if (ts > prev) out.set(memoirId, ts);
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  A · Silence-reconnect                                              */
/* ------------------------------------------------------------------ */

/**
 * Emit at-most-one silence-reconnect suggestion per Memoir.
 *   - Skips Memoirs with no recorded chat (lastChatAt === undefined)
 *     because the user simply hasn't engaged yet — the
 *     onboarding-state UI handles that surface.
 *   - Skips Memoirs younger than `SILENCE_THRESHOLD_MS` (a Memoir
 *     created 3 days ago can't be in "silence" yet).
 */
export const evaluateSilenceReconnect = (
  memoirs: readonly CustomPersona[],
  lastChat: Map<string, number>,
  now: number,
): ProactiveRecallSuggestion[] => {
  const out: ProactiveRecallSuggestion[] = [];
  for (const m of memoirs) {
    if (m.kind !== 'memoir') continue;
    if (now - m.createdAt < SILENCE_THRESHOLD_MS) continue;
    const last = lastChat.get(m.id);
    if (last === undefined) continue;
    if (now - last < SILENCE_THRESHOLD_MS) continue;
    out.push({
      memoirId: m.id,
      memoirName: m.name,
      trigger: 'silence-reconnect',
      promptHintKey: 'proactiveSilenceHint',
      expiresAt: now + 1 * MS_PER_DAY,
    });
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  B · Anniversary                                                    */
/* ------------------------------------------------------------------ */

/**
 * Loose date parser. Returns `{month, day}` (1-indexed) when the
 * body contains a recognisable date pattern, else null. Handles
 * common Chinese forms (`5 月 1 日`, `5月1号`, `12/25`) and a
 * subset of English (`May 1`, `12/25`).
 *
 * Exposed for testing — the heuristic is intentionally narrow to
 * avoid false positives (e.g. random numbers in a sentence).
 */
export const parseRoughDate = (body: string): { month: number; day: number } | null => {
  if (!body) return null;
  const compact = body.replace(/\s+/g, '');
  // Chinese: "5月1日" / "5月1号" / "5月01日"
  const cn = /([0-9]{1,2})月([0-9]{1,2})[日号]/.exec(compact);
  if (cn) {
    const month = Number(cn[1]);
    const day = Number(cn[2]);
    if (isValidMd(month, day)) return { month, day };
  }
  // M/D or MM/DD (no year)
  const slash = /\b([0-9]{1,2})\/([0-9]{1,2})(?!\/)\b/.exec(body);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (isValidMd(month, day)) return { month, day };
  }
  // English month name + day. Limited to common forms.
  const monthNames = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  const lower = body.toLowerCase();
  for (let i = 0; i < monthNames.length; i += 1) {
    const re = new RegExp(`\\b${monthNames[i]}[a-z]*\\s+([0-9]{1,2})\\b`, 'i');
    const m = re.exec(lower);
    if (m) {
      const day = Number(m[1]);
      if (isValidMd(i + 1, day)) return { month: i + 1, day };
    }
  }
  return null;
};

const isValidMd = (month: number, day: number): boolean =>
  Number.isInteger(month) &&
  Number.isInteger(day) &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= 31;

export const evaluateAnniversary = (
  memoirs: readonly CustomPersona[],
  memories: readonly Memory[],
  now: number,
): ProactiveRecallSuggestion[] => {
  const today = new Date(now);
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();
  const out: ProactiveRecallSuggestion[] = [];
  // One suggestion max per memoir per day (multiple matching
  // milestones would otherwise spam the card).
  const used = new Set<string>();
  for (const memoir of memoirs) {
    if (memoir.kind !== 'memoir') continue;
    for (const m of memories) {
      if (m.memoirId !== memoir.id) continue;
      if (m.deletedAt !== undefined) continue;
      if (m.category !== 'milestone') continue;
      const parsed = parseRoughDate(m.body);
      if (!parsed) continue;
      if (parsed.month !== todayMonth || parsed.day !== todayDay) continue;
      if (used.has(memoir.id)) continue;
      used.add(memoir.id);
      // Expire at the end of today (UTC).
      const endOfDay = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23,
        59,
        59,
        999,
      );
      out.push({
        memoirId: memoir.id,
        memoirName: memoir.name,
        trigger: 'anniversary',
        promptHintKey: 'proactiveAnniversaryHint',
        anchorMemoryId: m.id,
        expiresAt: endOfDay,
      });
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  C · Pending follow-up                                              */
/* ------------------------------------------------------------------ */

const FORWARD_LOOKING_PATTERNS = [
  // Chinese
  /下周/,
  /下个月/,
  /即将/,
  /准备/,
  /计划/,
  /马上要/,
  /快要/,
  /明天要/,
  // English
  /\bnext week\b/i,
  /\bnext month\b/i,
  /\bplan(ning)? to\b/i,
  /\babout to\b/i,
];

const looksLikeForwardLooking = (body: string): boolean => {
  for (const re of FORWARD_LOOKING_PATTERNS) {
    if (re.test(body)) return true;
  }
  return false;
};

export const evaluatePendingFollowup = (
  memoirs: readonly CustomPersona[],
  memories: readonly Memory[],
  lastChat: Map<string, number>,
  now: number,
): ProactiveRecallSuggestion[] => {
  const out: ProactiveRecallSuggestion[] = [];
  const used = new Set<string>();
  for (const memoir of memoirs) {
    if (memoir.kind !== 'memoir') continue;
    if (used.has(memoir.id)) continue;
    const last = lastChat.get(memoir.id);
    for (const m of memories) {
      if (m.memoirId !== memoir.id) continue;
      if (m.deletedAt !== undefined) continue;
      if (m.category !== 'fact') continue;
      if (now - m.createdAt < FOLLOWUP_AGE_MIN_MS) continue;
      // Skip if the user has chatted with this memoir AFTER the
      // memory was created — they presumably already followed up.
      if (last !== undefined && last >= m.createdAt) continue;
      if (!looksLikeForwardLooking(m.body)) continue;
      used.add(memoir.id);
      out.push({
        memoirId: memoir.id,
        memoirName: memoir.name,
        trigger: 'pending-followup',
        promptHintKey: 'proactiveFollowupHint',
        anchorMemoryId: m.id,
        expiresAt: now + 7 * MS_PER_DAY,
      });
      break;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  Top-level evaluator                                                */
/* ------------------------------------------------------------------ */

export interface EvaluateProactiveArgs {
  memoirs: readonly CustomPersona[];
  memories: readonly Memory[];
  entries: readonly DiaryEntry[];
  now?: number;
  /** Cooldown filter — the UI reads which `(memoirId, trigger)`
   *  tuples the user has dismissed within their cooldown window
   *  and passes a predicate. Pure functions here don't read
   *  localStorage themselves. */
  isOnCooldown?: (memoirId: string, trigger: ProactiveRecallTrigger) => boolean;
}

/**
 * Run all three triggers and return a merged, deduplicated list.
 * When two triggers fire for the same Memoir, we keep the most
 * specific one (anniversary > pending-followup > silence-reconnect).
 */
export const evaluateProactiveRecall = ({
  memoirs,
  memories,
  entries,
  now = Date.now(),
  isOnCooldown,
}: EvaluateProactiveArgs): ProactiveRecallSuggestion[] => {
  const lastChat = lastChatPerMemoir(entries, memoirs);
  const anniversaries = evaluateAnniversary(memoirs, memories, now);
  const followups = evaluatePendingFollowup(memoirs, memories, lastChat, now);
  const silences = evaluateSilenceReconnect(memoirs, lastChat, now);

  // Specificity merge: at most one suggestion per memoir.
  const byMemoir = new Map<string, ProactiveRecallSuggestion>();
  for (const s of [...anniversaries, ...followups, ...silences]) {
    if (byMemoir.has(s.memoirId)) continue;
    byMemoir.set(s.memoirId, s);
  }

  const merged = Array.from(byMemoir.values());
  if (!isOnCooldown) return merged;
  return merged.filter((s) => !isOnCooldown(s.memoirId, s.trigger));
};
