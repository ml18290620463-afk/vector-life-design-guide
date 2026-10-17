import { isAccessibleDiaryEntry } from './avatarQueryPlan';
import type { DiaryEntry } from '../types';
import {
  buildLocalSemanticIndex,
  searchLocalSemanticIndex,
  type LocalSemanticIndexItem,
} from './localSemanticIndex';
import { previewAvatarGrowth } from '../features/now/api/avatar';
import {
  readAvatarAtomicMemories,
  readAvatarUnderstandings,
  upsertAvatarAtomicMemories,
} from './avatarMemory';

/** Avatar owns interpretation and candidate persistence; Past only supplies evidence. */
export async function proposeExperienceMemories(
  entry: DiaryEntry,
  unit: { content: string; createdAt: number; supplementId?: string },
  entries: DiaryEntry[],
  cancelled: () => boolean,
  index: LocalSemanticIndexItem[] = buildLocalSemanticIndex(
    entries.map((item) => ({ ...item, title: '', tags: [], supplements: undefined })),
  ),
): Promise<boolean> {
  if (!isAccessibleDiaryEntry(entry) || cancelled()) return false;
  const evidenceSources = [
    {
      entryId: entry.id,
      supplementId: unit.supplementId,
      content: unit.content,
      createdAt: unit.createdAt,
    },
    ...searchLocalSemanticIndex(
      { title: '', content: unit.content, tags: [] },
      index.filter(({ entry: candidate }) => candidate.id !== entry.id && isAccessibleDiaryEntry(candidate)),
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
    understandings: readAvatarUnderstandings().filter((item) => item.status === 'confirmed'),
  });
  if (cancelled()) return false;
  const existing = new Set(readAvatarAtomicMemories().map((memory) => memory.id));
  if (
    !upsertAvatarAtomicMemories(
      preview.atomicMemoryCandidates.filter(
        (memory) => memory.status === 'candidate' && !existing.has(memory.id),
      ),
    )
  )
    throw new Error('提炼未完成');
  return true;
}
