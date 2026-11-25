import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { readAvatarOntology, settleExpiredAvatarOntology } from './avatarOntologyStore';
import { memoryStatementKey } from './avatarStatementComparison';

/** Lifecycle inspection only reads the authoritative v2 graph. No candidate is deleted. */
export async function inspectAvatarMemoryHealth(now = Date.now()) {
  const graph = await settleExpiredAvatarOntology(now);
  return inspectAvatarMemorySnapshot(graph, now);
}

export function inspectAvatarMemorySnapshot(graph: AvatarOntologySnapshot, now = Date.now()) {
  const active = graph.objects.filter((object) =>
    object.status === 'candidate' || object.status === 'confirmed');
  const groups = new Map<string, string[]>();
  for (const object of active) {
    const key = `${object.domain}:${object.category}:${object.validity.mode}:${memoryStatementKey(object.statement)}`;
    groups.set(key, [...(groups.get(key) ?? []), object.id]);
  }
  return {
    duplicateGroups: [...groups.values()].filter((ids) => ids.length > 1),
    expiredCandidateIds: [] as string[],
    stagedExpiringSoonIds: active.filter((object) =>
      object.status === 'confirmed' && object.validity.mode === 'staged' &&
      object.validity.validUntil && Date.parse(object.validity.validUntil) > now &&
      Date.parse(object.validity.validUntil) <= now + 7 * 86400000,
    ).map((object) => object.id),
  };
}

/** Read-only inbox entry point; pending candidates have no time-to-live cleanup. */
export async function readAvatarPendingInbox() {
  const graph = await readAvatarOntology();
  return graph.objects.filter((object) => object.status === 'candidate');
}
