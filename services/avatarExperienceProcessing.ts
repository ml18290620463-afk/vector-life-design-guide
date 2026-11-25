import { isAccessibleDiaryEntry } from './avatarQueryPlan';
import type { DiaryEntry } from '../types';
import {
  buildLocalSemanticIndex,
  searchLocalSemanticIndex,
  type LocalSemanticIndexItem,
} from './localSemanticIndex';
import { previewAvatarGrowth } from '../features/now/api/avatar';
import { initializeAvatarOntology } from './avatarOntologyStore';
import { withAvatarSession } from './avatarOntologySessionGuard';
import { stageExperienceCandidates } from './avatarExperienceCandidates';

/** Avatar owns interpretation and candidate persistence; Past only supplies evidence. */
export async function proposeExperienceMemories(
  entry: DiaryEntry,
  unit: { content: string; createdAt: number; supplementId?: string },
  entries: DiaryEntry[],
  cancelled: () => boolean,
  index: LocalSemanticIndexItem[] = buildLocalSemanticIndex(
    entries
      .filter((item) => isAccessibleDiaryEntry(item))
      .map((item) => ({ ...item, title: '', tags: [], supplements: undefined })),
  ),
): Promise<boolean> {
  return withAvatarSession(async (assertCurrent) => {
    if (!isAccessibleDiaryEntry(entry) || cancelled()) return false;
    const graph = await initializeAvatarOntology();
    assertCurrent();
    const evidenceSources: {
      entryId: string;
      supplementId?: string;
      content: string;
      createdAt: number;
    }[] = [
      {
        entryId: entry.id,
        supplementId: unit.supplementId,
        content: unit.content,
        createdAt: unit.createdAt,
      },
      ...searchLocalSemanticIndex(
        { title: '', content: unit.content, tags: [] },
        index.filter(
          ({ entry: candidate }) => candidate.id !== entry.id && isAccessibleDiaryEntry(candidate),
        ),
        3,
        0.45,
      )
        .map((match) => match.entry)
        .map((candidate) => ({
          entryId: candidate.id,
          content: candidate.content,
          createdAt: candidate.createdAt,
        })),
    ];
    const evidenceMessages = evidenceSources.map((source) => ({
      role: 'user',
      content: source.content,
      createdAt: source.createdAt,
    }));
    const preview = await previewAvatarGrowth({
      messages: evidenceMessages,
      source: 'past',
      sourceEntryId: entry.id,
      sourceSupplementId: unit.supplementId,
      occurredAt: unit.createdAt,
      evidenceSources,
      // Keep downstream recall bounded to the same evidence set sent to the model.
      entries: evidenceSources.map((source) => ({
        id: source.entryId,
        title: '',
        content: source.content,
        tags: [],
        createdAt: source.createdAt,
      })),
      understandings: graph.objects.map(({ id }) => ({ id })),
    });
    if (cancelled()) return false;
    assertCurrent();
    await stageExperienceCandidates(preview.atomicMemoryCandidates, graph.revision, () => {
      assertCurrent();
      if (cancelled()) throw new Error('提炼已取消');
    });
    return true;
  });
}
