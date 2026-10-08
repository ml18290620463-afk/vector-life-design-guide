import {
  buildGroundedGuidance,
  isAvatarContextContinuation,
} from '../../../services/avatarGuidance';
import type { GuidanceSource } from '../../../services/avatarGuidance';
import type { ChatMessage } from '../types/now';

/** Short follow-ups retain the latest substantive subject; identity remains independent. */
export function selectAvatarGuidanceContext(
  conversation: ChatMessage[],
  sources: GuidanceSource[],
) {
  const question = conversation.at(-1)?.content ?? '';
  const previousQuestion = conversation
    .slice(0, -1)
    .filter((m) => m.role === 'user' && !isAvatarContextContinuation(m.content))
    .at(-1)?.content;
  const selected = buildGroundedGuidance(question, sources, previousQuestion).sources;
  const identity = sources
    .filter((source) => source.avatarName)
    .sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0))
    .slice(0, 2);
  return [
    ...identity,
    ...selected.filter(
      (source) => !identity.some((item) => item.id === source.id && item.kind === source.kind),
    ),
  ];
}
