import type { DiaryEntry, ExperienceFeedbackOutcome, Principle } from '../types';
import { principleToSemanticSource, semanticSimilarity } from './localSemanticIndex';

export const DEFAULT_PRINCIPLE_CONFIDENCE = 0.5;

const OUTCOME_DELTAS: Record<ExperienceFeedbackOutcome, number> = {
  helpful: 0.12,
  partial: 0.04,
  unhelpful: -0.12,
  unrelated: 0,
};

const clampConfidence = (value: number): number =>
  Math.min(1, Math.max(0, Math.round(value * 100) / 100));

export const getPrincipleConfidence = (principle: Pick<Principle, 'confidence'>): number =>
  clampConfidence(principle.confidence ?? DEFAULT_PRINCIPLE_CONFIDENCE);

export const applyPrincipleFeedback = (
  principle: Principle,
  outcome: ExperienceFeedbackOutcome,
  now = Date.now(),
): Principle => {
  if (outcome === 'unrelated') return principle;

  return {
    ...principle,
    confidence: clampConfidence(getPrincipleConfidence(principle) + OUTCOME_DELTAS[outcome]),
    recallCount: (principle.recallCount ?? 0) + 1,
    helpfulCount: (principle.helpfulCount ?? 0) + (outcome === 'helpful' ? 1 : 0),
    partialCount: (principle.partialCount ?? 0) + (outcome === 'partial' ? 1 : 0),
    unhelpfulCount: (principle.unhelpfulCount ?? 0) + (outcome === 'unhelpful' ? 1 : 0),
    lastFeedbackAt: now,
  };
};

const normalizeTag = (tag: string): string =>
  tag
    .replace(/^(心情|事件):/, '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();

const getEntryTags = (entry: Pick<DiaryEntry, 'tags'>): Set<string> =>
  new Set(entry.tags.map(normalizeTag).filter(Boolean));

const tokenize = (value: string): Set<string> => {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ');
  const tokens = new Set(normalized.match(/[a-z0-9]{3,}/g) ?? []);
  const chineseRuns = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];

  for (const run of chineseRuns) {
    if (run.length <= 4) tokens.add(run);
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.add(run.slice(index, index + 2));
    }
  }

  return tokens;
};

const countIntersection = (first: Set<string>, second: Set<string>): number => {
  let count = 0;
  for (const value of first) {
    if (second.has(value)) count += 1;
  }
  return count;
};

const scorePrincipleForEntry = (
  entry: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
  principle: Principle,
  entriesById: Map<string, DiaryEntry>,
): number => {
  const entryTags = getEntryTags(entry);
  const evidenceTags = new Set<string>();
  const evidenceEntries: DiaryEntry[] = [];

  for (const entryId of principle.derivedFromEntryIds ?? []) {
    const evidence = entriesById.get(entryId);
    if (!evidence) continue;
    evidenceEntries.push(evidence);
    for (const tag of getEntryTags(evidence)) evidenceTags.add(tag);
  }

  const tagOverlap = countIntersection(entryTags, evidenceTags);
  const entryTokens = tokenize(`${entry.title} ${entry.content} ${[...entryTags].join(' ')}`);
  const principleTokens = tokenize(principle.text);
  const textOverlap = countIntersection(entryTokens, principleTokens);
  const directTextMatch =
    principle.text.trim().length >= 4 &&
    `${entry.title} ${entry.content}`.toLowerCase().includes(principle.text.trim().toLowerCase());
  const semanticScore = semanticSimilarity(
    {
      text: `${entry.title} ${entry.content}`,
      tags: entry.tags,
    },
    principleToSemanticSource(principle, evidenceEntries),
  );

  return (
    tagOverlap * 5 +
    Math.min(textOverlap, 4) +
    (directTextMatch ? 6 : 0) +
    (semanticScore >= 0.24 ? semanticScore * 8 : 0)
  );
};

/**
 * Conservative hybrid association: evidence links remain authoritative while
 * the local semantic fingerprint can recover differently worded experiences.
 */
export const findRelatedPrinciples = (
  entry: Pick<DiaryEntry, 'title' | 'content' | 'tags'>,
  principles: Principle[],
  pastEntries: DiaryEntry[],
  limit = 1,
): Principle[] => {
  if (principles.length === 0 || limit <= 0) return [];
  const entriesById = new Map(pastEntries.map((pastEntry) => [pastEntry.id, pastEntry]));

  return principles
    .map((principle) => ({
      principle,
      score: scorePrincipleForEntry(entry, principle, entriesById),
    }))
    .filter(({ score }) => score >= 2)
    .sort(
      (first, second) =>
        second.score - first.score ||
        getPrincipleConfidence(second.principle) - getPrincipleConfidence(first.principle) ||
        second.principle.createdAt - first.principle.createdAt,
    )
    .slice(0, limit)
    .map(({ principle }) => principle);
};

export const hasFeedbackForPrinciple = (
  entry: Pick<DiaryEntry, 'principleFeedback'>,
  principleId: string,
): boolean =>
  (entry.principleFeedback ?? []).some((feedback) => feedback.principleId === principleId);
