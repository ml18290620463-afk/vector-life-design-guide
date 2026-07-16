import type { DiaryEntry, ExperienceEdgeKind } from '../types';

export interface TopicTrajectoryNode {
  entry: DiaryEntry;
  relation: ExperienceEdgeKind | 'current';
}

export interface TopicTrajectory {
  label: string;
  nodes: TopicTrajectoryNode[];
  startedAt: number;
  updatedAt: number;
}

const cleanTag = (tag: string): string => tag.replace(/^#/, '').replace(/^[^:：]+[:：]/, '').trim();

export const buildTopicTrajectory = (
  source: DiaryEntry,
  entries: DiaryEntry[],
): TopicTrajectory | null => {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const edgeByTargetId = new Map(
    (source.experienceEdges ?? []).map((edge) => [edge.targetEntryId, edge.kind]),
  );
  const targetIds = [...new Set([
    ...(source.experienceEdges ?? []).map((edge) => edge.targetEntryId),
    ...(source.relatedEntryIds ?? []),
  ])];
  const relatedNodes = targetIds.flatMap((id): TopicTrajectoryNode[] => {
    const entry = entriesById.get(id);
    return entry && entry.id !== source.id
      ? [{ entry, relation: edgeByTargetId.get(id) ?? 'sameTheme' }]
      : [];
  });
  if (relatedNodes.length === 0) return null;

  const nodes = [...relatedNodes, { entry: source, relation: 'current' as const }].sort(
    (a, b) => a.entry.createdAt - b.entry.createdAt,
  );
  const tagCounts = new Map<string, number>();
  nodes.forEach(({ entry }) => {
    new Set(entry.tags.map(cleanTag).filter(Boolean)).forEach((tag) =>
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1),
    );
  });
  const label = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? cleanTag(source.tags[0] ?? '')
    ?? source.title;

  return {
    label: label || source.title,
    nodes,
    startedAt: nodes[0].entry.createdAt,
    updatedAt: nodes[nodes.length - 1].entry.createdAt,
  };
};
