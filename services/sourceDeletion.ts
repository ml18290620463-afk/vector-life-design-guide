import { forgetPastProcessing } from './pastProcessingCache';
import type { DiaryEntry, Principle, PatternPrincipleLink } from '../types';
import { DiaryStorageKeys as K, removeDiaryMirror } from './diaryStorage';
import { detachFutureSources } from './futureRepository';
import { vaultTransaction } from './vaultTransaction';
import { avatarOntologyTransaction } from './avatarOntologyTransaction';
import { withAvatarSession } from './avatarOntologySessionGuard';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { deleteOntologySources } from './avatarOntologySourceDeletion';
import { generateSecureId } from './idGenerator';
import { storedArray } from './vaultLegacyRead';
import {
  DELETION_TOMBSTONES_KEY,
  hashDeletedId,
  mergeDeletionTombstones,
  readDeletionTombstones,
  type DeletionTombstone,
} from './deletionTombstone';

export const DELETION_JOURNAL = 'vector_source_deletion_journal_v1';
interface Deletion {
  id: string;
  ids: string[];
  retain: boolean;
}
let recovery: Promise<void> | undefined;
/** The graph and records commit together; the journal retries derived cache cleanup only. */
export function recoverSourceDeletion(): Promise<void> {
  if (recovery) return recovery;
  recovery = withAvatarSession(async (assertCurrent) => {
    const pending = await vaultTransaction(
      [DELETION_JOURNAL],
      (v) => (v[DELETION_JOURNAL] as Deletion[] | undefined) ?? [],
      true,
    );
    assertCurrent();
    if (!pending.length) return;
    for (const job of pending) {
      assertCurrent();
      if (!forgetPastProcessing(job.ids)) throw new Error('处理状态清理失败');
    }
    [K.entries, K.backup, K.principles, K.patternPrincipleLinks].forEach(removeDiaryMirror);
    const done = new Set(pending.map((job) => job.id));
    await vaultTransaction([DELETION_JOURNAL], (v) => {
      assertCurrent();
      v[DELETION_JOURNAL] = ((v[DELETION_JOURNAL] as Deletion[] | undefined) ?? []).filter(
        (job) => !done.has(job.id),
      );
    });
  }).finally(() => {
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
  const occurredAt = new Date().toISOString();
  const tombstones: DeletionTombstone[] = await Promise.all(
    ids.map(async (id) => ({
      entityIdHash: await hashDeletedId(id),
      entityKind: 'source_record',
      opType: 'deleted',
      occurredAt,
      schemaVersion: 1,
    })),
  );
  await withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [
        AVATAR_ONTOLOGY_KEY,
        K.entries,
        K.backup,
        K.principles,
        K.patternPrincipleLinks,
        K.future,
        K.actions,
        DELETION_JOURNAL,
        DELETION_TOMBSTONES_KEY,
      ],
      (v) => {
        v[DELETION_TOMBSTONES_KEY] = mergeDeletionTombstones(
          readDeletionTombstones(v[DELETION_TOMBSTONES_KEY]),
          tombstones,
        );
        const removedPatterns = deleteOntologySources(v, ids, retainDerived);
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
          storedArray<PatternPrincipleLink>(v[K.patternPrincipleLinks], K.patternPrincipleLinks) ??
          []
        ).filter(
          (link) =>
            !removedPatterns.has(link.patternId) && !removedPrinciples.has(link.principleId),
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
      false,
      undefined,
      assertCurrent,
    ),
  );
  [K.entries, K.backup, K.principles, K.patternPrincipleLinks].forEach(removeDiaryMirror);
  try {
    await recoverSourceDeletion();
  } catch {
    throw new Error('记录已删除，本地缓存清理待恢复。请重新打开页面后检查。');
  }
}
