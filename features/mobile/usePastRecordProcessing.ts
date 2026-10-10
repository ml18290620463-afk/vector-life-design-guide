import { useEffect, useRef, useState } from 'react';
import type { DiaryEntry } from '../../types';
import { buildAvatarGrowthPreview } from '../../services/avatarIntelligence';
import {
  readAvatarAtomicMemories,
  readAvatarUnderstandings,
  upsertAvatarAtomicMemories,
} from '../../services/avatarMemory';
import { isAccessibleDiaryEntry } from '../../services/avatarQueryPlan';
import {
  buildLocalSemanticIndex,
  searchLocalSemanticIndex,
} from '../../services/localSemanticIndex';

/** Processing belongs to Past. Leaving the page cancels remaining work. */
export function usePastRecordProcessing(
  entries: DiaryEntry[],
  onRelatedEntriesResolved?: (entryId: string, ids: string[]) => void | Promise<void>,
) {
  const processed = useRef(new Map<string, string>());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const accessible = entries.filter((entry) => !entry.isSample && isAccessibleDiaryEntry(entry));
    const index = buildLocalSemanticIndex(accessible);
    void (async () => {
      setError('');
      for (const entry of accessible) {
        const fingerprint = JSON.stringify([
          entry.title,
          entry.content,
          entry.tags,
          entry.createdAt,
        ]);
        if (processed.current.get(entry.id) === fingerprint) continue;
        try {
          const preview = await buildAvatarGrowthPreview(
            {
              messages: [{ role: 'user', content: entry.content, createdAt: entry.createdAt }],
              source: 'past',
              sourceEntryId: entry.id,
              occurredAt: entry.createdAt,
            },
            { entries: accessible, understandings: readAvatarUnderstandings() },
          );
          if (cancelled) return;
          const existing = new Set(readAvatarAtomicMemories().map((memory) => memory.id));
          if (
            !upsertAvatarAtomicMemories(
              preview.atomicMemoryCandidates.filter((memory) => !existing.has(memory.id)),
            )
          )
            throw new Error('提炼未完成');
          processed.current.set(entry.id, fingerprint);
          if (onRelatedEntriesResolved) {
            const ids = searchLocalSemanticIndex(entry, index)
              .map(({ entry: related }) => related.id)
              .filter((id) => id !== entry.id);
            const current = entry.relatedEntryIds ?? [];
            if (JSON.stringify(current) !== JSON.stringify(ids))
              await onRelatedEntriesResolved(entry.id, ids);
          }
          if (cancelled) return;
          processed.current.set(entry.id, fingerprint);
        } catch {
          processed.current.delete(entry.id);
          if (cancelled) return;
          setError('部分记录未能处理');
        }
        // Yield between records so a large archive does not block interaction.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, onRelatedEntriesResolved, attempt]);
  return { error, retry: () => setAttempt((value) => value + 1) };
}
