import type { DiaryEntry } from '../../types';
import { semanticConceptsForText } from '../../services/localSemanticIndex';

export type PastSearchResult = {
  entry: DiaryEntry;
  /** Literal text/tag match, or a bounded single-word thematic recall. */
  match: 'exact' | 'related';
};

/** A single search accepts content, tags, links and later supplements. */
export const searchPastEntriesWithMatchKind = (
  entries: DiaryEntry[],
  query: string,
): PastSearchResult[] => {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return entries.map((entry) => ({ entry, match: 'exact' }));
  const exact = entries
    .filter((entry) => {
      const text = [
        entry.title,
        entry.content,
        ...(entry.tags ?? []),
        ...(entry.supplements ?? []).map((item) => item.content),
        ...(entry.nowMaterials ?? []).flatMap((material) => [
          material.description,
          material.meta?.title,
          material.type === 'link' ? material.url : '',
        ]),
      ]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLocaleLowerCase();
      return tokens.every((token) => text.includes(token));
    })
    .sort(
      (left, right) =>
        relevance(right, tokens) - relevance(left, tokens) || right.createdAt - left.createdAt,
    );
  // Keep the single search field precise. Only a one-word query with too few literal
  // matches gets a bounded thematic recall appended after exact results.
  if (tokens.length !== 1 || exact.length >= 3) return exact.map((entry) => ({ entry, match: 'exact' }));
  const queryConcepts = semanticConceptsForText(tokens[0]!);
  if (!queryConcepts.length) return exact.map((entry) => ({ entry, match: 'exact' }));
  const exactIds = new Set(exact.map((entry) => entry.id));
  const related = entries.filter((entry) => {
    if (exactIds.has(entry.id)) return false;
    const entryText = [
      entry.title,
      entry.content,
      ...(entry.tags ?? []),
      ...(entry.supplements ?? []).map((item) => item.content),
      ...(entry.nowMaterials ?? []).flatMap((material) => [
        material.description,
        material.meta?.title,
        material.type === 'link' ? material.url : '',
      ]),
    ]
      .filter((value) => typeof value === 'string')
      .join(' ');
    return semanticConceptsForText(entryText).some((concept) => queryConcepts.includes(concept));
  }).sort((left, right) => right.createdAt - left.createdAt);
  return [
    ...exact.map((entry) => ({ entry, match: 'exact' as const })),
    ...related.map((entry) => ({ entry, match: 'related' as const })),
  ];
};

/** Backwards-compatible entry-only search for callers that do not render match provenance. */
export const searchPastEntries = (entries: DiaryEntry[], query: string): DiaryEntry[] =>
  searchPastEntriesWithMatchKind(entries, query).map(({ entry }) => entry);

// When literal relevance is tied, the more recent record appears first.
const relevance = (entry: DiaryEntry, tokens: string[]) => {
  const title = entry.title.toLocaleLowerCase();
  const tags = (entry.tags ?? []).map((tag) =>
    tag
      .toLocaleLowerCase()
      .replace(/^(事件|心情):/, '')
      .replace(/^#/, '')
      .trim(),
  );
  return tokens.reduce(
    (score, token) =>
      score +
      (tags.includes(token) ? 4 : 0) +
      (title === token ? 3 : title.includes(token) ? 1 : 0),
    0,
  );
};

export function getPastSearchMatch(entry: DiaryEntry, query: string) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const fields: {
    source: string;
    text: string;
    target?: 'supplement' | 'material';
    id?: string;
  }[] = [
    { source: '标题', text: entry.title },
    { source: '正文', text: entry.content },
    ...(entry.tags ?? []).map((text) => ({ source: '标签', text })),
    ...(entry.supplements ?? []).map((item) => ({
      source: '补充',
      text: item.content,
      target: 'supplement',
      id: item.id,
    })),
    ...(entry.nowMaterials ?? []).flatMap((item) => [
      { source: '素材', text: item.description ?? '', target: 'material', id: item.id },
      { source: '素材', text: item.meta?.title ?? '', target: 'material', id: item.id },
      {
        source: '素材',
        text: item.type === 'link' ? item.url : '',
        target: 'material',
        id: item.id,
      },
    ]),
  ];
  const matching = fields
    .map((field) => ({
      ...field,
      matches: tokens.filter((token) => field.text.toLocaleLowerCase().includes(token)).length,
    }))
    .filter((field) => field.matches > 0)
    .sort((left, right) => right.matches - left.matches)[0];
  if (!matching) return null;
  const offset = Math.max(
    0,
    matching.text
      .toLocaleLowerCase()
      .indexOf(tokens.find((token) => matching.text.toLocaleLowerCase().includes(token))!) - 25,
  );
  return {
    source: matching.source,
    excerpt: matching.text.slice(offset, offset + 110),
    target: matching.target ?? 'body',
    id: matching.id,
  };
}
