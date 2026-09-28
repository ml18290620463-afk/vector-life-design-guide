import type { AvatarLaunchContext, AvatarSession } from '../features/avatar/types';
import type { ChatMessage } from '../features/now/types/now';
import { getStoredJson, setStoredJson, sanitizeContext, sanitizeMessage, sanitizeReference, isRecord } from './avatarMemoryShared';

const SESSION_KEY = 'vector:avatar:sessions:v1';
const MAX_SESSIONS = 18;
// Keep enough local history for a user to revisit a sustained conversation.
// Rendering is deliberately capped in useAvatarChatViewport, and model prompts
// apply their own context limit, so this storage allowance does not make the
// chat screen or requests grow with the whole transcript.
const MAX_MESSAGES = 600;

export const sanitizeAvatarSessions = (value: unknown): AvatarSession[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const context = sanitizeContext(item.context);
    if (
      !context ||
      typeof item.id !== 'string' ||
      typeof item.createdAt !== 'number' ||
      typeof item.updatedAt !== 'number'
    ) {
      return [];
    }
    const messages = Array.isArray(item.messages)
      ? item.messages.flatMap((message) => sanitizeMessage(message) ?? []).slice(-MAX_MESSAGES)
      : [];
    const references = Array.isArray(item.references)
      ? item.references.flatMap((reference) => sanitizeReference(reference) ?? [])
      : [];
    return [
      {
        id: item.id,
        mode: context.mode,
        context,
        messages,
        references,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    ];
  });
};

export const readAvatarSessions = (): AvatarSession[] =>
  sanitizeAvatarSessions(getStoredJson<unknown>(SESSION_KEY)).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

const contextsMatch = (session: AvatarSession, context: AvatarLaunchContext) =>
  session.mode === context.mode &&
  session.context.source === context.source &&
  session.context.entryId === context.entryId &&
  session.context.actionId === context.actionId;

export const readAvatarSession = (context: AvatarLaunchContext): AvatarSession | null =>
  readAvatarSessions().find((session) => contextsMatch(session, context)) ?? null;

// Older builds started a fresh general session on every visit. Recover their
// saved turns once, deduplicating by message ID when a resumed session contains them.
export const readAvatarConversation = (context: AvatarLaunchContext): AvatarSession | null => {
  if (context.mode !== 'general') return null;
  const sessions = readAvatarSessions().filter((session) => contextsMatch(session, context));
  const latest = sessions.find((session) => session.messages.some((m) => m.type === 'text'));
  if (!latest) return null;
  const turns = new Map<string, ChatMessage>();
  for (const session of [...sessions].reverse()) {
    for (const message of session.messages) {
      if (message.type === 'text' && message.role !== 'system') turns.set(message.id, message);
    }
  }
  return {
    ...latest,
    messages: [...turns.values()]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .slice(-MAX_MESSAGES),
  };
};

export const writeAvatarSession = (session: AvatarSession): boolean => {
  const next = [
    { ...session, messages: session.messages.slice(-MAX_MESSAGES) },
    ...readAvatarSessions().filter((item) => item.id !== session.id),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  return setStoredJson(SESSION_KEY, next);
};
