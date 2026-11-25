import type { CognitiveObject } from '../features/avatar/types';
import {
  confirmAvatarCognition,
  rejectAvatarCognition,
  readAvatarConfirmationPreview,
  getRevisionTrajectories,
  reviewAvatarPendingBatch,
  type AvatarOntologySnapshot,
} from './avatarOntologyStore';

/** Display categories belong to the object, never to a projected legacy ID. */
export const archiveScope = (object: CognitiveObject) =>
  object.domain === 'about_me' ? 'self' : 'pattern';

export function archiveTags(graph: AvatarOntologySnapshot, objectId: string): string[] {
  return [...new Set(graph.edges.flatMap((edge) =>
    edge.type === 'SCOPED_IN' && edge.fromId === objectId ? [edge.tagLabel] : [],
  ))];
}

/** Review the exact inbox snapshot currently displayed, after a fresh source check. */
export async function reviewArchiveBatch(
  graph: AvatarOntologySnapshot,
  objects: readonly CognitiveObject[],
  action: 'confirm' | 'ignore',
  aiVisible: boolean,
) {
  const preview = await readAvatarConfirmationPreview();
  if (preview.graph.revision !== graph.revision || objects.some((object) => {
    const current = preview.graph.objects.find((item) => item.id === object.id);
    return !current || current.status !== 'candidate' || current.statement !== object.statement;
  })) throw new Error('认知资料已更新，请重新审核');
  return reviewAvatarPendingBatch(graph.revision, preview.token, objects.map((object) =>
    action === 'ignore'
      ? { objectId: object.id, action }
      : {
          objectId: object.id, action, aiVisible,
          revision: object.pendingRevision
            ? { previousObjectId: object.pendingRevision.previousObjectId, reason: object.pendingRevision.reason }
            : undefined,
        },
  ));
}

export function archiveRevisions(graph: AvatarOntologySnapshot) {
  return getRevisionTrajectories(graph).map((item) => ({
    id: item.edgeId,
    currentObjectId: item.currentObject.id,
    before: item.previousObject.statement,
    after: item.currentObject.statement,
    at: Date.parse(item.confirmedAt),
  })).sort((a, b) => b.at - a.at);
}

/** The graph shown when review began must still be current after the visibility dialog. */
export async function reviewArchiveCognition(
  graph: AvatarOntologySnapshot,
  object: CognitiveObject,
  status: 'confirmed' | 'rejected',
  aiVisible: boolean,
) {
  const preview = await readAvatarConfirmationPreview();
  const current = preview.graph.objects.find((item) => item.id === object.id);
  if (preview.graph.revision !== graph.revision || !current ||
      current.statement !== object.statement || current.status !== object.status)
    throw new Error('认知资料已更新，请重新审核');
  if (status === 'rejected')
    return rejectAvatarCognition(graph.revision, object.id, preview.token);
  return confirmAvatarCognition(
    graph.revision,
    object.id,
    preview.token,
    object.pendingRevision
      ? { previousObjectId: object.pendingRevision.previousObjectId, reason: object.pendingRevision.reason }
      : undefined,
    aiVisible,
  );
}
