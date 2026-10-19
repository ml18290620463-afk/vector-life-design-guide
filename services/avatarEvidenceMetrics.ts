import type { DiaryEntry } from '../types';
import {
  isAccessibleDiaryEntry,
  parseAvatarTimeRange,
  type AvatarTimeRange,
} from './avatarQueryPlan';

export interface AvatarEvidenceMetricMatch {
  entryId: string;
  reason: 'tag' | 'explicit_text';
  matchedTerms: string[];
}

export interface AvatarEvidenceMetric {
  term: string;
  range?: AvatarTimeRange;
  matches: AvatarEvidenceMetricMatch[];
}

/**
 * This intentionally recognises a small vocabulary only. A count is a claim
 * about the user's records, so related feelings must never be silently folded
 * into it by a model (for example, 焦虑 is not the same as 痛苦).
 */
const COUNTABLE_TERMS = ['痛苦', '焦虑', '委屈', '压力', '难过', '生气', '疲惫'] as const;

const countQuestion = (question: string) =>
  /(多少|几)(次|回|个)?|统计|一共|总共/.test(question);

const requestedTerm = (question: string) => COUNTABLE_TERMS.find((term) => question.includes(term));

const explicitTextMatch = (text: string, term: string) => {
  // A conservative lexical count, not a semantic count of real-world events.
  const unquoted = text.replace(/[“「『"][^”」』"]*[”」』"]/g, '');
  return unquoted.split(/[。！？!?；;\n]/).some((sentence) => {
    const compact = sentence.replace(/\s+/g, '');
    if (/(如果|假如|假设|要是|可能会|担心会|希望不会)/.test(compact)) return false;
    if (/(他说|她说|朋友|同事|别人|他人|对方|妈妈|爸爸|母亲|父亲)/.test(compact)) return false;
    return [...compact.matchAll(new RegExp(term, 'g'))].some((hit) => {
      const prefix = compact.slice(Math.max(0, hit.index! - 10), hit.index);
      return !/(?:不|没|无|并非|没有|毫无|不再|从未)(?:感到|觉得|感觉|那么|很|太|任何|什么|过|了)*$/.test(
        prefix,
      );
    });
  });
};

export const findAvatarEvidenceMetric = (
  question: string,
  entries: DiaryEntry[],
  now = Date.now(),
): AvatarEvidenceMetric | null => {
  if (!countQuestion(question)) return null;
  const term = requestedTerm(question);
  if (!term) return null;
  const range = parseAvatarTimeRange(question, now);
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  const matches = uniqueEntries.flatMap((entry): AvatarEvidenceMetricMatch[] => {
    if (!isAccessibleDiaryEntry(entry, now)) return [];
    if (range && (entry.createdAt < range.start || entry.createdAt >= range.end)) return [];
    const tagged = (entry.tags ?? []).some(
      (tag) =>
        tag.trim() === term ||
        (tag.trim().split(/[:：]/).length === 2 && tag.trim().split(/[:：]/)[1].trim() === term),
    );
    const text = [
      entry.title,
      entry.content,
      entry.reflection,
      ...(entry.supplements ?? [])
        .filter(
          (s) =>
            s.createdAt <= now &&
            (!range || (s.createdAt >= range.start && s.createdAt < range.end)),
        )
        .map((s) => s.content),
    ].join('\n');
    const inText = explicitTextMatch(text, term);
    if (!tagged && !inText) return [];
    return [{ entryId: entry.id, reason: tagged ? 'tag' : 'explicit_text', matchedTerms: [term] }];
  });
  return { term, range, matches };
};

export const buildAvatarEvidenceMetricReply = (metric: AvatarEvidenceMetric) => {
  const scope = metric.range?.label ?? '目前可访问的记录中';
  const count = metric.matches.length;
  return `在${scope}，按记录时间筛选，标签或原文明确表达“${metric.term}”的记录有 ${count} 条。同一条记录只计一次；这是保守的记录匹配数，不代表实际发生次数，含糊表达可能未计入。`;
};
