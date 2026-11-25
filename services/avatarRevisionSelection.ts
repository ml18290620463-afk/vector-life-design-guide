import type { CognitiveObject } from '../features/avatar/types';
import type { AvatarFactCandidate } from '../features/now/api/avatar';
import type { ChatMessage } from '../features/now/types/now';

/** A revision review may only use an extraction grounded in the new user edit.
 * Keep the original candidate identity: its receipt must remain verifiable. */
export function selectRevisionCandidates<T extends {
  kind: AvatarFactCandidate['kind'];
  evidenceAnchors: { sourceId: string; userMessageIndex: number }[];
}>(candidates: T[], messages: ChatMessage[], target: CognitiveObject): T[] {
  const index = messages.findLastIndex((message) => message.role === 'user' && message.type === 'text');
  const message = messages[index];
  if (!message || !['confirmed', 'candidate', 'retained_after_source_delete'].includes(target.status)) return [];
  return candidates.filter((candidate) =>
    candidate.kind !== 'goal' &&
    (candidate.kind === 'pattern_candidate' ? 'my_understanding' : 'about_me') === target.domain &&
    candidate.evidenceAnchors.some((anchor) =>
      anchor.sourceId === message.id && anchor.userMessageIndex === index),
  );
}
