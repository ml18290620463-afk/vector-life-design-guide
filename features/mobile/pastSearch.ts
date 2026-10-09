import type { ActionItem, DiaryEntry, Principle } from '../../types';
import type { ActionDraftContext } from '../../types/future';

export interface PastSearchFilters {
  tags?: string[];
  from?: number;
  to?: number;
  linkedTo?: 'action' | 'principle';
}

/**
 * The relation index is derived only from persisted links. Keeping it separate
 * from the entries means filtering a large library does not repeatedly scan
 * every action and principle for every record.
 */
export interface PastEntryRelationIndex {
  actionEntryIds: Set<string>;
  principleEntryIds: Set<string>;
}

const timestamp = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Returns existing user labels only; it never derives new labels from record text. */
export const availablePastTags = (entries: DiaryEntry[]) =>
  [...new Set(entries.flatMap((entry) => (Array.isArray(entry.tags) ? entry.tags : [])))].sort(
    (left, right) => left.localeCompare(right),
  );

export const buildPastEntryRelationIndex = (
  actions: ActionItem[] = [],
  principles: Principle[] = [],
): PastEntryRelationIndex => ({
  actionEntryIds: new Set(
    actions
      .flatMap((action) => [
        action.sourceEntryId,
        action.resultEntryId,
        ...(action.evidenceEntryIds ?? []),
      ])
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ),
  principleEntryIds: new Set(
    principles.flatMap((principle) => principle.derivedFromEntryIds ?? []).filter(Boolean),
  ),
});

/** Pure, deterministic narrowing for a record set that has already been text-searched. */
export const filterPastEntries = (
  entries: DiaryEntry[],
  filters: PastSearchFilters,
  actions: ActionItem[] = [],
  principles: Principle[] = [],
  relationIndex = buildPastEntryRelationIndex(actions, principles),
): DiaryEntry[] => {
  const tags = new Set(filters.tags?.filter(Boolean) ?? []);
  return entries.filter((entry) => {
    const createdAt = timestamp(entry.createdAt);
    if (filters.from !== undefined && createdAt < filters.from) return false;
    if (filters.to !== undefined && createdAt > filters.to) return false;
    if (tags.size && !(entry.tags ?? []).some((tag) => tags.has(tag))) return false;
    if (
      filters.linkedTo === 'action' &&
      !(entry.relatedActionIds?.length ?? 0) &&
      !relationIndex.actionEntryIds.has(entry.id)
    )
      return false;
    if (
      filters.linkedTo === 'principle' &&
      !(entry.relatedPrincipleIds?.length ?? 0) &&
      !relationIndex.principleEntryIds.has(entry.id)
    )
      return false;
    return true;
  });
};

export interface DeterministicReview {
  entries: DiaryEntry[];
  principles: Principle[];
  actions: ActionItem[];
  actionContext?: ActionDraftContext;
}

/**
 * A review card intentionally contains only persisted facts.  It does not
 * classify feelings, infer causes, or create a conclusion from the records.
 */
export const buildDeterministicReview = (
  entries: DiaryEntry[],
  principles: Principle[],
  actions: ActionItem[],
): DeterministicReview => {
  const recentEntries = [...entries]
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
    .slice(0, 3);
  const entryIds = new Set(recentEntries.map((entry) => entry.id));
  const relatedPrinciples = principles
    .filter((principle) => (principle.derivedFromEntryIds ?? []).some((id) => entryIds.has(id)))
    .slice(0, 3);
  const relatedActions = actions
    .filter((action) =>
      [action.sourceEntryId, action.resultEntryId, ...(action.evidenceEntryIds ?? [])].some(
        (id) => id && entryIds.has(id),
      ),
    )
    .slice(0, 3);
  const source = recentEntries[0];
  return {
    entries: recentEntries,
    principles: relatedPrinciples,
    actions: relatedActions,
    actionContext: source
      ? {
          sourceEntryId: source.id,
          evidenceEntryIds: [source.id],
          rationale: source.title || source.content.slice(0, 120),
        }
      : undefined,
  };
};
