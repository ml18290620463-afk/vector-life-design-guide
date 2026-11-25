import { validateAvatarOntology } from './avatarOntologyValidation';
import { ontologyPrivacyToken } from './aiPrivacy';
import type { ActionItem, Principle } from '../types';
import type { FutureState } from '../types/future';
import { applyCognitiveConfirmation } from './avatarOntologyConfirmation';
import type { DiaryEntry } from '../types';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { VaultLockedError } from './vaultTransaction';
import {
  captureLegacyAvatarGuard,
  hasLegacyAvatarData,
  migrateAvatarStoreV1ToV2,
  readLegacyAvatarSessionsForMigration,
} from './avatarOntologyMigration';
import { avatarOntologyTransaction, readFreshAvatarSnapshot } from './avatarOntologyTransaction';
import { withAvatarSession } from './avatarOntologySessionGuard';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';

import type {
  AvatarSession,
  CognitiveObject,
  OntologyEdge,
  RevisionTrajectoryItem,
} from '../features/avatar/types';

/** One serialized graph. Revision trajectories are always projections, never stored rows. */
export interface AvatarOntologySnapshot {
  ontologySchemaVersion: 2;
  revision: number;
  objects: CognitiveObject[];
  edges: OntologyEdge[];
  /** Stable source messages live in the same protected transaction as their evidence. */
  sessions?: AvatarSession[];
  /** Recovery checkpoint remains mandatory after retiring legacy storage. */
  migrationCheckpointRequired?: true;
}

export { validateAvatarOntology, getCognitiveLineage } from './avatarOntologyValidation';
const fail = (message: string): never => {
  throw new Error(`认知资料校验失败：${message}`);
};

const normalizeRevisionStatement = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLocaleLowerCase('zh-CN');

export function getRevisionTrajectories(
  snapshot: AvatarOntologySnapshot,
): RevisionTrajectoryItem[] {
  validateAvatarOntology(snapshot);
  const objects = new Map(snapshot.objects.map((o) => [o.id, o]));
  const pick = (o: CognitiveObject) => ({
    id: o.id,
    statement: o.statement,
    confirmedAt: o.confirmedAt ?? o.migration?.legacyConfirmedAt,
    version: o.version,
  });
  return snapshot.edges
    .flatMap((edge): RevisionTrajectoryItem[] => {
      if (edge.type !== 'SUPERSEDES') return [];
      const previous = objects.get(edge.toId)!;
      const current = objects.get(edge.fromId)!;
      // Historical confirmation survives migration, but an unreviewed relation is not a revision.
      if (
        !(previous.confirmedAt || previous.migration?.legacyConfirmedAt) ||
        !(current.confirmedAt || current.migration?.legacyConfirmedAt) ||
        current.status === 'rejected' ||
        normalizeRevisionStatement(current.statement) ===
          normalizeRevisionStatement(previous.statement)
      )
        return [];
      return [
        {
          edgeId: edge.id,
          lineageId: current.lineageId,
          category: current.category,
          previousObject: pick(previous),
          currentObject: pick(current),
          relatedTags: [
            ...new Set(
              snapshot.edges.flatMap((e) =>
                e.type === 'SCOPED_IN' && [current.id, previous.id].includes(e.fromId)
                  ? [e.tagLabel]
                  : [],
              ),
            ),
          ],
          revisionReason: edge.revisionReason,
          triggerRecordId: edge.triggerRecordId,
          confirmedAt: edge.confirmedByUserAt,
          disclaimerType: 'revision_not_proven_growth',
        },
      ];
    })
    .sort((a, b) => Date.parse(b.confirmedAt) - Date.parse(a.confirmedAt));
}

/** A read-only preview. Only a subsequent explicit user action may retain or delete. */
export function previewSourceDeletionImpact(sourceId: string, snapshot: AvatarOntologySnapshot) {
  validateAvatarOntology(snapshot);
  // A chat quote can depend on a record through its launch context or the
  // quoted message's references. Checking only toId misses those privacy links.
  const removedEvidence = new Set(
    snapshot.edges
      .filter((edge) => {
        if (edge.type !== 'EVIDENCED_BY') return false;
        if (edge.toId === sourceId) return true;
        if (edge.sourceKind !== 'chat_user_message') return false;
        const session = snapshot.sessions?.find((item) => item.id === edge.sessionId);
        if (!session) return false;
        if (session.context.entryId === sourceId) return true;
        const message = session.messages[edge.userMessageIndex!];
        return (
          message?.id === edge.toId &&
          !!message.references?.some((reference) => reference.entryId === sourceId)
        );
      })
      .map((edge) => edge.id),
  );
  const affected = new Set(
    snapshot.edges.filter((edge) => removedEvidence.has(edge.id)).map((edge) => edge.fromId),
  );
  return structuredClone(
    snapshot.objects
      .filter((object) => affected.has(object.id))
      .map((object) => ({
        object,
        removedEvidenceIds: snapshot.edges
          .filter((edge) => edge.fromId === object.id && removedEvidence.has(edge.id))
          .map((edge) => edge.id),
        remainingEvidenceIds: snapshot.edges
          .filter(
            (edge) =>
              edge.type === 'EVIDENCED_BY' &&
              edge.fromId === object.id &&
              !removedEvidence.has(edge.id),
          )
          .map((edge) => edge.id),
      })),
  );
}

export class AvatarUpgradeRequiredError extends Error {
  constructor() {
    super('请先设置密码，以加密保存旧分身资料并完成升级');
  }
}

/** Boot is idempotent. Existing v2 corruption is never treated as an empty new account. */
export async function initializeAvatarOntology(): Promise<AvatarOntologySnapshot> {
  return withAvatarSession(async (assertCurrent) => {
    const assertLegacyUnchanged = captureLegacyAvatarGuard();
    return avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
      async (values) => {
        assertCurrent();
        const existing = values[AVATAR_ONTOLOGY_KEY];
        if (existing !== undefined) {
          validateAvatarOntology(existing);
          // Reopening a migrated account must verify its encrypted recovery
          // checkpoint too; an existing graph is not proof of checkpoint integrity.
          if (hasLegacyAvatarData()) {
            if (!useAppStore.getState().masterPassword) throw new AvatarUpgradeRequiredError();
            await migrateAvatarStoreV1ToV2({ requireExistingCheckpoint: true });
            assertCurrent();
            assertLegacyUnchanged();
          }
          return structuredClone(existing);
        }
        const empty: AvatarOntologySnapshot = {
          ontologySchemaVersion: 2,
          revision: 0,
          objects: [],
          edges: [],
        };
        if (hasLegacyAvatarData()) {
          const session = useAppStore.getState();
          if (!session.masterPassword) throw new AvatarUpgradeRequiredError();
          if (!session.isUnlocked) throw new VaultLockedError();
          const migrated = await migrateAvatarStoreV1ToV2();
          assertCurrent();
          assertLegacyUnchanged();
          empty.migrationCheckpointRequired = true;
          empty.objects = migrated.objects;
          empty.edges = migrated.edges;
          empty.sessions = readLegacyAvatarSessionsForMigration();
        }
        validateAvatarOntology(empty);
        assertCurrent();
        assertLegacyUnchanged();
        values[AVATAR_ONTOLOGY_KEY] = empty;
        return structuredClone(empty);
      },
      false,
      undefined,
      () => {
        assertCurrent();
        assertLegacyUnchanged();
      },
    );
  });
}

export async function readAvatarOntology(): Promise<AvatarOntologySnapshot> {
  return withAvatarSession((assertCurrent) =>
    readFreshAvatarSnapshot(
      () =>
        avatarOntologyTransaction(
          [AVATAR_ONTOLOGY_KEY],
          (values) => {
            assertCurrent();
            const snapshot = values[AVATAR_ONTOLOGY_KEY];
            if (snapshot === undefined) throw new Error('分身资料尚未完成初始化');
            validateAvatarOntology(snapshot);
            return structuredClone(snapshot);
          },
          true,
          undefined,
          assertCurrent,
        ),
      assertCurrent,
    ),
  );
}

/** Retrieval-time expiry is a dedicated, non-destructive lifecycle transaction. */
export async function settleExpiredAvatarOntology(
  now = Date.now(),
): Promise<AvatarOntologySnapshot> {
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY],
      (values) => {
        assertCurrent();
        const stored = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(stored);
        const next = structuredClone(stored);
        let changed = false;
        for (const object of next.objects) {
          if (
            object.status === 'confirmed' &&
            object.validity.mode === 'staged' &&
            object.validity.validUntil &&
            Date.parse(object.validity.validUntil) <= now
          ) {
            object.status = 'archived_expired';
            changed = true;
          }
        }
        if (changed) {
          next.revision += 1;
          validateAvatarOntology(next);
          assertCurrent();
          values[AVATAR_ONTOLOGY_KEY] = next;
        }
        return next;
      },
      false,
      undefined,
      assertCurrent,
    ),
  );
}

/** Generic edits cannot certify evidence or rewrite previously confirmed history. */
function validateUnreviewedUpdate(
  previous: AvatarOntologySnapshot,
  next: AvatarOntologySnapshot,
): void {
  if (previous.migrationCheckpointRequired !== next.migrationCheckpointRequired)
    fail('不得改写迁移快照要求');
  const originals = new Map(previous.objects.map((object) => [object.id, object]));
  for (const object of next.objects) {
    const original = originals.get(object.id);
    if (!original) {
      if (object.status !== 'candidate' || object.confirmedAt || object.migration)
        fail('新认知必须先作为候选，确认需经过证据核验');
      continue;
    }
    if (
      object.confirmedAt !== original.confirmedAt ||
      JSON.stringify(object.migration) !== JSON.stringify(original.migration)
    )
      fail('不得改写确认历史');
    // Classification and quoted meaning belong to the reviewed extraction. An
    // ordinary editor must not turn an inference into a one-source fact, or
    // replace its statement while retaining an unrelated verified quotation.
    if (
      previous.edges.some((edge) => edge.type === 'EVIDENCED_BY' && edge.fromId === original.id) &&
      (object.domain !== original.domain ||
        object.statement !== original.statement ||
        object.origin !== original.origin)
    )
      fail('有证据的候选表达或推断分类变更需要重新核验');
    if (
      object.status !== original.status &&
      !(['candidate', 'rejected'].includes(original.status) && object.status === 'rejected')
    )
      fail('状态变更需要专用审核操作');
    if (
      object.lineageId !== original.lineageId ||
      object.version !== original.version ||
      object.createdAt !== original.createdAt
    )
      fail('不得改写谱系标识');
    if (
      (original.confirmedAt || original.migration?.legacyConfirmedAt) &&
      (object.statement !== original.statement ||
        object.domain !== original.domain ||
        object.category !== original.category)
    )
      fail('已确认观点必须通过修订创建新版本');
  }
  // Deletion and source retention require their own explicit impact-review command.
  if (previous.objects.some((object) => !next.objects.some((item) => item.id === object.id)))
    fail('删除认知需要显式影响审核');
  // A generic editor is not an extraction-verification boundary. Never let it
  // manufacture server attestation or mutate an original quoted source.
  const priorEvidence = new Map(
    previous.edges.filter((edge) => edge.type === 'EVIDENCED_BY').map((edge) => [edge.id, edge]),
  );
  for (const edge of next.edges) {
    if (edge.type !== 'EVIDENCED_BY') continue;
    const original = priorEvidence.get(edge.id);
    if (
      (!original && edge.quoteVerifiedByServer) ||
      (original && JSON.stringify(original) !== JSON.stringify(edge))
    )
      fail('证据核验与来源修改需要专用审核操作');
  }
  if (
    previous.edges.some(
      (edge) =>
        edge.type === 'EVIDENCED_BY' &&
        !next.edges.some((item) => item.id === edge.id && item.type === 'EVIDENCED_BY'),
    )
  )
    fail('删除证据需要显式影响审核');
  if (JSON.stringify(previous.sessions) !== JSON.stringify(next.sessions))
    fail('原始会话修改需要专用写入操作');
  const history = (graph: AvatarOntologySnapshot) =>
    graph.edges.filter((edge) => edge.type === 'SUPERSEDES');
  if (JSON.stringify(history(previous)) !== JSON.stringify(history(next)))
    fail('修订关系需要专用审核操作');
}

/** Optimistic revision guards prevent a stale editor from overwriting a concurrent review. */
export async function commitAvatarOntology(
  expectedRevision: number,
  update: (graph: AvatarOntologySnapshot) => void,
): Promise<AvatarOntologySnapshot> {
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY],
      (values) => {
        assertCurrent();
        const stored = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(stored);
        if (stored.revision !== expectedRevision) throw new Error('认知资料已更新，请刷新后重试');
        const next = structuredClone(stored);
        update(next);
        next.revision = stored.revision + 1;
        validateAvatarOntology(next);
        validateUnreviewedUpdate(stored, next);
        assertCurrent();
        values[AVATAR_ONTOLOGY_KEY] = next;
        return structuredClone(next);
      },
      false,
      undefined,
      assertCurrent,
    ),
  );
}


/** Persist conversation turns without allowing an editor to rewrite an evidence anchor.
 * Capacity remains bounded; a referenced session cannot be silently evicted. */
export async function persistAvatarOntologySession(
  expectedRevision: number,
  session: AvatarSession,
): Promise<AvatarOntologySnapshot> {
  const incoming = structuredClone(session);
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY],
      (values) => {
        assertCurrent();
        const stored = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(stored);
        if (stored.revision !== expectedRevision) throw new Error('认知资料已更新，请刷新后重试');
        const next = structuredClone(stored);
        const previous = next.sessions?.find((item) => item.id === incoming.id);
        if (previous) {
          if (
            incoming.createdAt !== previous.createdAt ||
            incoming.mode !== previous.mode ||
            JSON.stringify(incoming.context) !== JSON.stringify(previous.context)
          )
            fail('不得替换原始会话身份');
          // Extraction may still be in flight before its evidence edges exist.
          // Every saved index must therefore stay stable, not just referenced indices.
          if (incoming.updatedAt < previous.updatedAt) fail('不得回退会话更新时间');
          if (incoming.messages.length < previous.messages.length) fail('不得删除原始会话消息');
          for (let index = 0; index < previous.messages.length; index++) {
            if (
              JSON.stringify(previous.messages[index]) !== JSON.stringify(incoming.messages[index])
            )
              fail('不得改写或移动原始会话消息');
          }
        }
        for (const edge of next.edges) {
          if (
            edge.type !== 'EVIDENCED_BY' ||
            edge.sourceKind !== 'chat_user_message' ||
            edge.sessionId !== incoming.id
          )
            continue;
          const index = edge.userMessageIndex;
          const original = index === undefined ? undefined : previous?.messages[index];
          const replacement = index === undefined ? undefined : incoming.messages[index];
          if (
            !original ||
            !replacement ||
            original.role !== 'user' ||
            original.id !== edge.toId ||
            JSON.stringify(original) !== JSON.stringify(replacement)
          )
            fail('不得移动或删除已引用的用户消息');
        }
        const sessions = [
          incoming,
          ...(next.sessions ?? []).filter((item) => item.id !== incoming.id),
        ].sort((a, b) => b.updatedAt - a.updatedAt);
        const removed = new Set(sessions.slice(18).map((item) => item.id));
        if (
          next.edges.some(
            (edge) =>
              edge.type === 'EVIDENCED_BY' &&
              edge.sourceKind === 'chat_user_message' &&
              edge.sessionId &&
              removed.has(edge.sessionId),
          )
        )
          fail('会话容量已满，请先显式审核引用来源');
        next.sessions = sessions.slice(0, 18);
        next.revision++;
        validateAvatarOntology(next);
        values[AVATAR_ONTOLOGY_KEY] = next;
        return structuredClone(next);
      },
      false,
      undefined,
      assertCurrent,
    ),
  );
}

/** Confirmation reads sources atomically; caller-provided counters are never authoritative.
 * The UI must call this only from its explicit confirmation action. */
export async function confirmAvatarCognition(
  expectedRevision: number,
  objectId: string,
  previewToken: string,
  revision?: { previousObjectId: string; reason?: string; triggerRecordId?: string },
  aiVisible?: boolean,
): Promise<AvatarOntologySnapshot> {
  if (!previewToken.trim()) fail('缺少请求权限凭据');
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
      (values) => {
        assertCurrent();
        const stored = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(stored);
        if (stored.revision !== expectedRevision) throw new Error('认知资料已更新，请刷新后重试');
        // The exact live source snapshot is bound to the confirmation preview.
        if (previewToken !== avatarConfirmationToken(values)) fail('来源或权限已变化，请重新审核');
        const next = structuredClone(stored);
        const entries = (values[K.entries] ?? []) as DiaryEntry[];
        const privacyToken = ontologyPrivacyToken(
          stored,
          entries,
          values[K.future] as FutureState | undefined,
          (values[K.actions] ?? []) as ActionItem[],
          (values[K.principles] ?? []) as Principle[],
        );
        const candidate = next.objects.find((item) => item.id === objectId);
        if (candidate?.pendingRevision && revision?.previousObjectId !== candidate.pendingRevision.previousObjectId)
          fail('修订候选必须由显式修订确认动作审核');
        if (candidate?.pendingRevision && revision?.reason !== candidate.pendingRevision.reason)
          fail('修订理由已变化，请重新审核');
        applyCognitiveConfirmation(next, objectId, entries, privacyToken, revision);
        if (candidate) delete candidate.pendingRevision;
        // Persist the visibility reviewed in the same UI action as confirmation.
        // Never perform a second write against a potentially changed source snapshot.
        if (aiVisible !== undefined) {
          if (typeof aiVisible !== 'boolean') fail('AI 可见性选择无效');
          next.objects.find((item) => item.id === objectId)!.privacy.aiVisible = aiVisible;
        }
        next.revision++;
        validateAvatarOntology(next);
        values[AVATAR_ONTOLOGY_KEY] = next;
        return structuredClone(next);
      },
      false,
      undefined,
      assertCurrent,
    ),
  );
}

/** One explicit inbox review can confirm or ignore a selected batch atomically.
 * Every confirmation repeats the live evidence gate inside the same transaction. */
export async function reviewAvatarPendingBatch(
  expectedRevision: number,
  previewToken: string,
  decisions: readonly ({ objectId: string; action: 'confirm'; aiVisible: boolean; revision?: { previousObjectId: string; reason?: string; triggerRecordId?: string } } | { objectId: string; action: 'ignore' })[],
): Promise<AvatarOntologySnapshot> {
  if (!previewToken.trim() || !decisions.length ||
      new Set(decisions.map((decision) => decision.objectId)).size !== decisions.length)
    fail('批次审核参数无效');
  return withAvatarSession((assertCurrent) => avatarOntologyTransaction(
    [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
    (values) => {
      assertCurrent();
      const stored = values[AVATAR_ONTOLOGY_KEY];
      validateAvatarOntology(stored);
      if (stored.revision !== expectedRevision) throw new Error('认知资料已更新，请刷新后重试');
      if (previewToken !== avatarConfirmationToken(values)) fail('来源或权限已变化，请重新审核');
      const next = structuredClone(stored);
      const entries = (values[K.entries] ?? []) as DiaryEntry[];
      const privacyToken = ontologyPrivacyToken(stored, entries,
        values[K.future] as FutureState | undefined,
        (values[K.actions] ?? []) as ActionItem[],
        (values[K.principles] ?? []) as Principle[]);
      for (const decision of decisions) {
        const candidate = next.objects.find((item) => item.id === decision.objectId);
        if (!candidate || candidate.status !== 'candidate') fail('仅可审核待确认候选');
        if (decision.action === 'ignore') {
          candidate.status = 'rejected';
          candidate.privacy.aiVisible = false;
          candidate.updatedAt = new Date().toISOString();
          continue;
        }
        if (typeof decision.aiVisible !== 'boolean') fail('AI 可见性选择无效');
        if (candidate.pendingRevision?.previousObjectId !== decision.revision?.previousObjectId ||
            candidate.pendingRevision?.reason !== decision.revision?.reason)
          fail('修订候选必须由显式修订确认动作审核');
        applyCognitiveConfirmation(next, decision.objectId, entries, privacyToken, decision.revision);
        delete candidate.pendingRevision;
        candidate.privacy.aiVisible = decision.aiVisible;
      }
      next.revision++;
      validateAvatarOntology(next);
      assertCurrent();
      values[AVATAR_ONTOLOGY_KEY] = next;
      return structuredClone(next);
    }, false, undefined, assertCurrent,
  ));
}

/** Explicit archive rejection disables use without deleting original evidence or lineage. */
export async function rejectAvatarCognition(
  expectedRevision: number,
  objectId: string,
  previewToken: string,
): Promise<AvatarOntologySnapshot> {
  if (!previewToken.trim()) fail('缺少请求权限凭据');
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
      (values) => {
        assertCurrent();
        const stored = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(stored);
        if (stored.revision !== expectedRevision) throw new Error('认知资料已更新，请刷新后重试');
        if (previewToken !== avatarConfirmationToken(values)) fail('来源或权限已变化，请重新审核');
        const next = structuredClone(stored);
        const object = next.objects.find((item) => item.id === objectId);
        if (!object) fail('认知不存在');
        // A predecessor is immutable history: changing it would break its SUPERSEDES chain.
        if (object!.status === 'superseded') fail('历史版本不可直接停用，请审核当前版本');
        object!.status = 'rejected';
        object!.privacy.aiVisible = false;
        object!.updatedAt = new Date().toISOString();
        next.revision++;
        validateAvatarOntology(next);
        assertCurrent();
        values[AVATAR_ONTOLOGY_KEY] = next;
        return structuredClone(next);
      },
      false,
      undefined,
      assertCurrent,
    ),
  );
}

/** Conservative preview binding includes source content as well as permissions.
 * This is a local comparison token, never an authorization credential sent to a provider. */
export function avatarConfirmationToken(values: Record<string, unknown>): string {
  return JSON.stringify([
    values[AVATAR_ONTOLOGY_KEY],
    values[K.entries] ?? [],
    values[K.future] ?? null,
    values[K.actions] ?? [],
    values[K.principles] ?? [],
  ]);
}

export async function readAvatarConfirmationPreview() {
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
      (values) => {
        assertCurrent();
        const graph = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(graph);
        const entries = (values[K.entries] ?? []) as DiaryEntry[];
        const future = values[K.future] as FutureState | undefined;
        const actions = (values[K.actions] ?? []) as ActionItem[];
        const principles = (values[K.principles] ?? []) as Principle[];
        return structuredClone({
          graph,
          entries,
          future,
          actions,
          principles,
          token: avatarConfirmationToken(values),
          privacyToken: ontologyPrivacyToken(graph, entries, future, actions, principles),
        });
      },
      true,
      undefined,
      assertCurrent,
    ),
  );
}
