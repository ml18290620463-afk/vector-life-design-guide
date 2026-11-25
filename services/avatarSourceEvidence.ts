import { isAIMessageAllowed } from './aiPrivacy';
import type { DiaryEntry } from '../types';
import type {
  AvatarMemorySourceRef,
  AvatarSession,
  CognitiveObject,
  EvidencedByEdge,
  EvidenceGateState,
} from '../features/avatar/types';
import { isAccessibleDiaryEntry } from './avatarQueryPlan';

/** Resolve against live originals; a cached excerpt is never sufficient evidence. */
export function resolveAvatarSourceEvidence(
  refs: AvatarMemorySourceRef[],
  entries: DiaryEntry[],
  sessions: AvatarSession[],
  now = Date.now(),
  privacyToken?: string,
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
              isAIMessageAllowed(message, entries, privacyToken) &&
              message.role === 'user' &&
              message.type === 'text' &&
              message.content.includes(ref.excerpt!),
          ),
      );
    }
    return false;
  });
}

/** V2 evidence is accepted only against accessible live originals, never cached source state. */
export function resolveOntologyEvidence(
  edges: import('../features/avatar/types').EvidencedByEdge[],
  entries: DiaryEntry[],
  sessions: AvatarSession[],
  now = Date.now(),
  privacyToken?: string,
): import('../features/avatar/types').EvidencedByEdge[] {
  return edges.filter((edge) => {
    if (!edge.quoteVerifiedByServer || !edge.verbatimQuote.trim()) return false;
    if (edge.sourceKind === 'chat_user_message') {
      // V2 must not invoke the legacy token builder (which reads/prunes legacy stores).
      if (!privacyToken) return false;
      const session = sessions.find((item) => item.id === edge.sessionId);
      if (!session || !Number.isSafeInteger(edge.userMessageIndex) || edge.userMessageIndex! < 0)
        return false;
      if (
        session.context.entryId &&
        !entries.some(
          (entry) => entry.id === session.context.entryId && isAccessibleDiaryEntry(entry, now),
        )
      )
        return false;
      const message = session.messages[edge.userMessageIndex!];
      return (
        !!message &&
        message.id === edge.toId &&
        message.role === 'user' &&
        message.type === 'text' &&
        isAIMessageAllowed(message, entries, privacyToken) &&
        message.content.includes(edge.verbatimQuote)
      );
    }
    // Action reviews need their authoritative action repository; diary IDs are not interchangeable.
    if (edge.sourceKind !== 'now_entry' && edge.sourceKind !== 'past_experience') return false;
    const entry = entries.find((item) => item.id === edge.toId);
    if (!entry || !isAccessibleDiaryEntry(entry, now)) return false;
    return [entry.title, entry.content, entry.reflection,
      ...(entry.supplements ?? []).filter((item) => !item.isEncrypted && item.createdAt <= now).map((item) => item.content),
    ].some((text) =>
      text?.includes(edge.verbatimQuote),
    );
  });
}

/** Counts are derived from distinct live originals, never supplied by extraction or a backup. */
export function computeOntologyEvidenceGate(
  object: Pick<CognitiveObject, 'id' | 'domain'>,
  edges: EvidencedByEdge[],
  entries: DiaryEntry[],
  sessions: AvatarSession[],
  now = Date.now(),
  privacyToken?: string,
): EvidenceGateState {
  const live = resolveOntologyEvidence(
    edges.filter((edge) => edge.fromId === object.id),
    entries,
    sessions,
    now,
    privacyToken,
  );
  const experiences = new Set<string>();
  const messages = new Set<string>();
  const dates = new Set<string>();
  const conversations = new Set<string>();
  for (const edge of live) {
    // Event times in edge metadata are not proof of independent dates.
    let occurredAt: number;
    if (edge.sourceKind === 'chat_user_message') {
      const session = sessions.find((item) => item.id === edge.sessionId)!;
      const message = session.messages[edge.userMessageIndex!];
      occurredAt = Date.parse(message.created_at);
      if (!Number.isFinite(occurredAt) || occurredAt > now) continue;
      // Message IDs survive session moves/copies; copied evidence is not independent.
      if (messages.has(message.id)) continue;
      messages.add(message.id);
      conversations.add(session.id);
    } else {
      const entry = entries.find((item) => item.id === edge.toId)!;
      occurredAt = entry.createdAt;
      if (!Number.isFinite(occurredAt) || occurredAt > now) continue;
      // The same diary cannot count twice as NOW and Past evidence.
      experiences.add(entry.id);
    }
    dates.add(new Date(occurredAt).toISOString().slice(0, 10));
  }
  const requiresMultiSourceGate = object.domain === 'my_understanding';
  return {
    requiresMultiSourceGate,
    independentExperienceCount: experiences.size,
    distinctUserMessageCount: messages.size,
    distinctDateCount: dates.size,
    distinctSessionCount: conversations.size,
    isReadyForConfirmation: requiresMultiSourceGate
      ? (experiences.size >= 2 || messages.size >= 3) &&
        (dates.size >= 2 || conversations.size >= 2)
      : experiences.size + messages.size > 0,
  };
}
