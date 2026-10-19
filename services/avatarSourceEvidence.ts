import type { DiaryEntry } from '../types';
import type { AvatarMemorySourceRef, AvatarSession } from '../features/avatar/types';
import { isAccessibleDiaryEntry } from './avatarQueryPlan';

/** Resolve against live originals; a cached excerpt is never sufficient evidence. */
export function resolveAvatarSourceEvidence(
  refs: AvatarMemorySourceRef[],
  entries: DiaryEntry[],
  sessions: AvatarSession[],
  now = Date.now(),
): AvatarMemorySourceRef[] {
  return refs.filter((ref) => {
    if (!ref.excerpt?.trim()) return false;
    if (ref.source === 'entry') {
      const entry = entries.find((item) => item.id === ref.id);
      if (!entry || !isAccessibleDiaryEntry(entry, now)) return false;
      const texts = ref.supplementId
        ? (entry.supplements ?? [])
            .filter((s) => s.id === ref.supplementId && !s.isEncrypted && s.createdAt <= now)
            .map((s) => s.content)
        : [entry.title, entry.content, entry.reflection];
      return texts.some((text) => text?.includes(ref.excerpt!));
    }
    if (ref.source === 'message') {
      return sessions.some(
        (session) =>
          (!ref.sessionId || session.id === ref.sessionId) &&
          (!session.context.entryId ||
            entries.some(
              (entry) => entry.id === session.context.entryId && isAccessibleDiaryEntry(entry, now),
            )) &&
          session.messages.some(
            (message) =>
              message.id === ref.id &&
              message.role === 'user' &&
              message.type === 'text' &&
              message.content.includes(ref.excerpt!),
          ),
      );
    }
    return false;
  });
}
