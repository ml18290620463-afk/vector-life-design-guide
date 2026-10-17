import type { DiaryEntry } from '../types';
import { isAccessibleDiaryEntry, parseAvatarTimeRange, type AvatarTimeRange } from './avatarQueryPlan';

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
  /(多少|几)(次|回|个)?|统计|一共|总共/.test(question) && !/(为什么|怎么|建议|分析|总结)/.test(question);

const requestedTerm = (question: string) =>
  COUNTABLE_TERMS.find((term) => question.includes(term));

const explicitTextMatch = (text: string, term: string) => {
  const compact = text.replace(/\s+/g, '');
  const hits = [...compact.matchAll(new RegExp(term, 'g'))];
  // Do not count a record saying it was "not painful" as a painful occurrence.
  return hits.length > 0 && hits.some((hit) => !/(?:不|没|无|并不|并非|没有|毫无|完全不)$/.test(compact.slice(Math.max(0, hit.index! - 4), hit.index)));
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
  const matches = entries.flatMap((entry): AvatarEvidenceMetricMatch[] => {
    if (!isAccessibleDiaryEntry(entry, now)) return [];
    if (range && (entry.createdAt < range.start || entry.createdAt >= range.end)) return [];
    const tagged = (entry.tags ?? []).some((tag) => tag.includes(term));
    const text = [entry.title, entry.content, entry.reflection, ...(entry.supplements ?? []).map((s) => s.content)].join('\n');
    const inText = explicitTextMatch(text, term);
    if (!tagged && !inText) return [];
    return [{ entryId: entry.id, reason: tagged ? 'tag' : 'explicit_text', matchedTerms: [term] }];
  });
  return { term, range, matches };
};

export const buildAvatarEvidenceMetricReply = (metric: AvatarEvidenceMetric) => {
  const scope = metric.range?.label ?? '目前可访问的记录中';
  const count = metric.matches.length;
  return `在${scope}，明确提到“${metric.term}”的经历有 ${count} 条。这个统计只依据标签或原文中的明确表达，不会把相近感受合并计算。`;
};
