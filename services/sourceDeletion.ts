import { forgetPastProcessing } from './pastProcessingCache';
import type { DiaryEntry, Principle, PatternPrincipleLink } from '../types';
import { DiaryStorageKeys as K, removeDiaryMirror } from './diaryStorage';
import { detachFutureSources } from './futureRepository';
import {
  pruneAvatarAtomicMemoriesBySourceIds,
  pruneAvatarMemoryRelationsByMemoryIds,
  pruneAvatarUnderstandingsByEntryIds,
} from './avatarMemory';
import { vaultTransaction } from './vaultTransaction';
import { generateSecureId } from './idGenerator';
import { storedArray } from './vaultLegacyRead';

export const DELETION_JOURNAL = 'vector_source_deletion_journal_v1';
interface Deletion {
  id: string;
  ids: string[];
  retain: boolean;
}
let recovery: Promise<void> | undefined;
/** IDB owns the deletion decision; a durable journal repairs the older local pattern mirror. */
export function recoverSourceDeletion(): Promise<void> {
  if (recovery) return recovery;
  recovery = (async () => {
    const pending = await vaultTransaction(
      [DELETION_JOURNAL],
      (v) => (v[DELETION_JOURNAL] as Deletion[] | undefined) ?? [],
      true,
    );
    if (!pending.length) return;
    for (const job of pending) {
      if (!forgetPastProcessing(job.ids)) throw new Error('处理状态清理失败');
      pruneAvatarUnderstandingsByEntryIds(job.ids, job.retain);
      const prunedMemories = pruneAvatarAtomicMemoriesBySourceIds(job.ids, job.retain);
      pruneAvatarMemoryRelationsByMemoryIds(prunedMemories.removedMemoryIds);
      // Cached conversations can contain source excerpts; remove only conversations referencing deleted IDs.
      const key = 'vector:avatar:sessions:v1';
      let sessions: unknown[] = [];
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (Array.isArray(parsed)) sessions = parsed;
      } catch {
        /* Corrupt derived cache can be discarded; source records remain in IDB. */
      }
      localStorage.setItem(
        key,
        JSON.stringify(
          sessions.filter(
            (session) =>
              !job.ids.some((id) => JSON.stringify(session).includes(JSON.stringify(id))),
          ),
        ),
      );
    }
    [K.entries, K.backup, K.principles, K.patternPrincipleLinks].forEach(removeDiaryMirror);
    const done = new Set(pending.map((job) => job.id));
    await vaultTransaction([DELETION_JOURNAL], (v) => {
      v[DELETION_JOURNAL] = ((v[DELETION_JOURNAL] as Deletion[] | undefined) ?? []).filter(
        (job) => !done.has(job.id),
      );
    });
  })().finally(() => {
    recovery = undefined;
  });
  return recovery;
}

export async function deleteSourceEntries(
  ids: string[],
  retainDerived: boolean,
  retainProgress: boolean,
) {
  await recoverSourceDeletion();
  const deleted = new Set(ids);
  await vaultTransaction(
    [
      K.entries,
      K.backup,
      K.principles,
      K.patternPrincipleLinks,
      K.future,
      K.actions,
      DELETION_JOURNAL,
    ],
    (v) => {
      const removedPatterns = new Set(
        pruneAvatarUnderstandingsByEntryIds(ids, retainDerived, false).removedPatternIds,
      );
      const removedMemories = pruneAvatarAtomicMemoriesBySourceIds(
        ids,
        retainDerived,
        false,
      ).removedMemoryIds;
      pruneAvatarMemoryRelationsByMemoryIds(removedMemories, false);
      const removedPrinciples = new Set<string>();
      v[K.principles] = (storedArray<Principle>(v[K.principles], K.principles) ?? []).flatMap(
        (p) => {
          const entries = p.derivedFromEntryIds?.filter((id) => !deleted.has(id));
          const patterns = p.sourcePatternIds?.filter((id) => !removedPatterns.has(id));
          if (
            !retainDerived &&
            (p.derivedFromEntryIds?.length ?? 0) + (p.sourcePatternIds?.length ?? 0) > 0 &&
            !entries?.length &&
            !patterns?.length
          ) {
            removedPrinciples.add(p.id);
            return [];
          }
          return [
            {
              ...p,
              derivedFromEntryIds: entries?.length ? entries : undefined,
              sourcePatternIds: patterns?.length ? patterns : undefined,
            },
          ];
        },
      );
      v[K.patternPrincipleLinks] = (
        storedArray<PatternPrincipleLink>(v[K.patternPrincipleLinks], K.patternPrincipleLinks) ?? []
      ).filter(
        (link) => !removedPatterns.has(link.patternId) && !removedPrinciples.has(link.principleId),
      );
      v[K.entries] = (storedArray<DiaryEntry>(v[K.entries], K.entries) ?? []).filter(
        (e) => !deleted.has(e.id),
      );
      v[K.backup] = v[K.entries];
      detachFutureSources(v, deleted, retainProgress);
      v[DELETION_JOURNAL] = [
        ...((v[DELETION_JOURNAL] as Deletion[] | undefined) ?? []),
        { id: generateSecureId('delete'), ids, retain: retainDerived },
      ];
    },
  );
  [K.entries, K.backup, K.principles, K.patternPrincipleLinks].forEach(removeDiaryMirror);
  try {
    await recoverSourceDeletion();
  } catch {
    throw new Error('记录已删除，本地缓存清理待恢复。请重新打开页面后检查。');
  }
}
