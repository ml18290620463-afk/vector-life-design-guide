import type { CustomPersona } from '../types';
import type { MemoirConversationTurn } from './memoryExtractionService';

/**
 * Phase 4 Week 3.5 — `services/memoirTranscriptSlicer.ts`
 *
 * Pure helpers that turn a Morning Star analysis result into
 * per-Memoir conversation transcripts ready for
 * `extractMemoirMemories`. The Morning Star prompt template
 * (see [`services/geminiService.ts`](./geminiService.ts) line ~200)
 * forces a deterministic markdown layout:
 *
 *   ### ✉️ 来自 [persona name] 的回信
 *   (...persona's letter body...)
 *   ---
 *   ### ✉️ 来自 [other persona] 的回信
 *   ...
 *   ### 💡 共同的思考留白
 *   (...closing question)
 *
 * We can therefore split on the `### ✉️ 来自 ... 的回信` heading and
 * key each section by the persona name embedded in the heading.
 *
 * Why slicing per-Memoir rather than feeding the whole result:
 *   - Each Memoir keeps its OWN memory bank (`memoirId` scoped). If
 *     three personas reply in one Morning Star round, sending the
 *     full text to each Memoir's extractor would let them
 *     "remember" what someone else said.
 *   - Slicing per persona keeps the extractor's context window
 *     small (~600 chars × 1 reply) and avoids cross-pollination.
 *   - Pure, easily testable — `services/memoirTranscriptSlicer.test.ts`
 *     pins every edge case (no heading match, multiple personas,
 *     unicode persona names, etc).
 */

/** Markdown heading prefix the Morning Star template emits.
 *  Kept as a constant so a future template tweak only requires
 *  touching this file + its tests. */
const HEADING_RE = /^###\s*✉️?\s*来自\s+(.+?)\s+的回信\s*$/m;

/**
 * Pull the body of a single persona's letter out of the Morning
 * Star markdown. Returns the trimmed body string, or `null` when
 * the persona has no section in the result (which can happen if
 * the LLM dropped a persona, or if the user de-selected before
 * sending).
 *
 * Matching is by exact persona name (case-sensitive trimmed). We
 * deliberately do NOT loosen this — false positives would attribute
 * the wrong text to a Memoir's memory bank, which is worse than
 * missing a memory.
 */
export const extractPersonaSection = (markdown: string, personaName: string): string | null => {
  if (!markdown || !personaName) return null;
  const target = personaName.trim();
  if (!target) return null;
  // Find every "### ✉️ 来自 NAME 的回信" heading position.
  const headingPattern = /###\s*✉️?\s*来自\s+(.+?)\s+的回信\s*$/gm;
  const sections: Array<{ name: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(markdown)) !== null) {
    sections.push({
      name: match[1].trim(),
      start: match.index + match[0].length,
      end: markdown.length,
    });
  }
  // Tighten each section's `end` to the next heading or to the
  // closing "### 💡 共同的思考留白" / `---` sentinel.
  for (let i = 0; i < sections.length; i += 1) {
    if (i + 1 < sections.length) {
      sections[i].end = sections[i + 1].start - sections[i + 1].name.length - 20;
    }
  }
  const matched = sections.find((s) => s.name === target);
  if (!matched) return null;
  // Strip leading separator dashes the template emits between
  // sections, and the closing "### 💡 共同的思考留白" if it leaks
  // into the body (defensive — the heading scan above usually
  // already terminates the section).
  const slice = markdown
    .slice(matched.start, matched.end)
    .replace(/^\s*[-*]{3,}\s*$/gm, '')
    .replace(/###\s*💡[\s\S]*$/m, '')
    .trim();
  return slice.length > 0 ? slice : null;
};

export interface BuildMemoirTranscriptArgs {
  /** Plain-text reflection the user sent into Morning Star. */
  reflection: string;
  /** The Morning Star result's `content` markdown (already JSON-
   *  parsed and unwrapped — pass `parsed.content`, not the raw
   *  `entry.morningStarAnalysis` string). */
  responseMarkdown: string;
  /** The Memoir persona we are harvesting for. Only used to look up
   *  its name in the markdown — caller passes the full record so
   *  the harvest hook can also forward `memoirId` to the store. */
  memoir: CustomPersona;
}

/**
 * Build a 2-turn conversation transcript: USER speaks (the
 * reflection) and MEMOIR replies (the persona-keyed slice of the
 * Morning Star markdown). Returns `null` when the Memoir has no
 * letter in the response — the harvest path skips such rounds.
 */
export const buildMemoirTranscript = (
  args: BuildMemoirTranscriptArgs,
): MemoirConversationTurn[] | null => {
  if (args.memoir.kind !== 'memoir') return null;
  const reflection = (args.reflection ?? '').trim();
  if (!reflection) return null;
  const memoirReply = extractPersonaSection(args.responseMarkdown, args.memoir.name);
  if (!memoirReply) return null;
  return [
    { role: 'user', content: reflection },
    { role: 'memoir', content: memoirReply },
  ];
};

/** True when the analysis result mentions any of the supplied
 *  Memoir names — used by the harvest hook to skip the entire
 *  network round-trip when no Memoir participated this round. */
export const hasAnyHeading = (markdown: string): boolean =>
  typeof markdown === 'string' && HEADING_RE.test(markdown);
