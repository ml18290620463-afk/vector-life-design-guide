import {
  pastRecordFingerprint,
  wasPastRecordProcessed,
  markPastRecordProcessed,
} from '../../services/pastProcessingCache';
import { useEffect, useRef, useState } from 'react';
import type { DiaryEntry } from '../../types';
import { proposeExperienceMemories } from '../../services/avatarExperienceProcessing';
import { isAccessibleDiaryEntry } from '../../services/avatarQueryPlan';
import {
  buildLocalSemanticIndex,
  searchLocalSemanticIndex,
} from '../../services/localSemanticIndex';

/** Past schedules evidence delivery; avatar owns interpretation. Leaving cancels remaining work. */
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
    const evidenceIndex = buildLocalSemanticIndex(
      accessible.map((item) => ({ ...item, title: '', tags: [], supplements: undefined })),
    );
    const corpusFingerprint = accessible
      .map((entry) => `${entry.id}:${pastRecordFingerprint(entry)}`)
      .join('|');
    void (async () => {
      setError('');
      for (const entry of accessible) {
        const fingerprint = pastRecordFingerprint(entry);
        const sessionKey = `${fingerprint}:${corpusFingerprint}`;
        if (processed.current.get(entry.id) === sessionKey) continue;
        try {
          const units = [
            {
              id: entry.id,
              content: entry.content,
              createdAt: entry.createdAt,
              supplementId: undefined as string | undefined,
            },
            ...(entry.supplements ?? []).map((item) => ({
              ...item,
              id: JSON.stringify([entry.id, item.id]),
              supplementId: item.id,
            })),
          ];
          for (const unit of units) {
            if (cancelled) return;
            const unitFingerprint = pastRecordFingerprint({
              ...entry,
              content: unit.content,
              createdAt: unit.createdAt,
              supplements: undefined,
            });
            if (wasPastRecordProcessed(unit.id, unitFingerprint)) continue;
            if (
              !(await proposeExperienceMemories(
                entry,
                unit,
                accessible,
                () => cancelled,
                evidenceIndex,
              ))
            )
              return;
            if (!markPastRecordProcessed(unit.id, unitFingerprint, entry.id))
              throw new Error('处理状态未保存');
          }
          if (onRelatedEntriesResolved) {
            const ids = searchLocalSemanticIndex(entry, index)
              .map(({ entry: related }) => related.id)
              .filter((id) => id !== entry.id);
            const current = entry.relatedEntryIds ?? [];
            if (JSON.stringify(current) !== JSON.stringify(ids))
              await onRelatedEntriesResolved(entry.id, ids);
          }
          if (cancelled) return;
          processed.current.set(entry.id, sessionKey);
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
