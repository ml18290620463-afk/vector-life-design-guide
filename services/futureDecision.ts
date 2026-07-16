import type { DiaryEntry, Principle } from '../types';
import { getPrincipleConfidence } from './experienceFeedback';
import {
  buildLocalSemanticIndex,
  principleToSemanticSource,
  searchLocalSemanticIndex,
  semanticSimilarity,
} from './localSemanticIndex';

export interface FutureDecision {
  actionTitle: string;
  evidenceEntries: DiaryEntry[];
  principle: Principle | null;
  question: string;
  rationale: string;
}

const cleanQuestion = (question: string): string => question.replace(/\s+/g, ' ').trim();

const truncate = (value: string, limit: number): string =>
  value.length > limit ? `${value.slice(0, limit)}…` : value;

const rankPrinciples = (
  question: string,
  principles: Principle[],
  entriesById: Map<string, DiaryEntry>,
): Principle[] =>
  principles
    .map((principle) => {
      const evidence = (principle.derivedFromEntryIds ?? []).flatMap((entryId) => {
        const entry = entriesById.get(entryId);
        return entry ? [entry] : [];
      });
      const similarity = semanticSimilarity(
        { text: question },
        principleToSemanticSource(principle, evidence),
      );
      return {
        principle,
        score: similarity * 0.75 + getPrincipleConfidence(principle) * 0.25,
        similarity,
      };
    })
    .filter(({ similarity }) => similarity >= 0.2)
    .sort(
      (first, second) =>
        second.score - first.score ||
        getPrincipleConfidence(second.principle) - getPrincipleConfidence(first.principle),
    )
    .map(({ principle }) => principle);

export const buildFutureDecision = (
  rawQuestion: string,
  entries: DiaryEntry[],
  principles: Principle[],
  preferredEntryIds: string[] = [],
): FutureDecision | null => {
  const question = cleanQuestion(rawQuestion);
  if (!question) return null;

  const availableEntries = entries.filter(
    (entry) =>
      !entry.isSample &&
      !entry.isArchived &&
      (!entry.unlockAt || entry.unlockAt <= Date.now()) &&
      `${entry.title}${entry.content}`.trim().length > 0,
  );
  const entriesById = new Map(availableEntries.map((entry) => [entry.id, entry]));
  const localMatches = searchLocalSemanticIndex(
    { title: question, content: question, tags: [] },
    buildLocalSemanticIndex(availableEntries),
    3,
    0.14,
  ).map(({ entry }) => entry);
  const preferredEntries = preferredEntryIds.flatMap((entryId) => {
    const entry = entriesById.get(entryId);
    return entry ? [entry] : [];
  });
  const evidenceEntries = [...preferredEntries, ...localMatches]
    .filter(
      (entry, index, candidates) =>
        candidates.findIndex((candidate) => candidate.id === entry.id) === index,
    )
    .slice(0, 3);
  const principle = rankPrinciples(question, principles, entriesById)[0] ?? null;
  const actionTitle = principle
    ? principle.application?.action
      ? truncate(principle.application.action, 52)
      : `先做一次小范围验证：${truncate(principle.text, 44)}`
    : `为「${truncate(question, 28)}」完成一次最小可逆验证`;
  const rationale = principle
    ? `${principle.application?.trigger ? `触发场景：${principle.application.trigger}。` : ''}这一步优先调用了一条与你当前问题相关、可信度为 ${Math.round(
        getPrincipleConfidence(principle) * 100,
      )}% 的既有原则。`
    : evidenceEntries.length > 0
      ? '暂时没有足够相关的已确认原则，因此只建议一个可回退的小实验，并保留过去记录作为依据。'
      : '当前经验依据仍不足，因此不替你下结论，只保留一个低成本、可回退的验证动作。';

  return {
    actionTitle,
    evidenceEntries,
    principle,
    question,
    rationale,
  };
};
