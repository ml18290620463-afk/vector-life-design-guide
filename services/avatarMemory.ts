import type {
  AvatarLaunchContext,
  AvatarMode,
  AvatarSession,
  AvatarSourceReference,
  AvatarUnderstandingStatus,
  AvatarUnderstandingVersion,
} from '../features/avatar/types';
import type { ChatMessage } from '../features/now/types/now';
import { getStoredJson, setStoredJson } from './browserStorage';

const SESSION_KEY = 'vector:avatar:sessions:v1';
const UNDERSTANDING_KEY = 'vector:avatar:understandings:v1';
const MAX_SESSIONS = 18;
const MAX_MESSAGES = 120;

const MODES = new Set<AvatarMode>([
  'capture',
  'distill',
  'recall',
  'decide',
  'review',
  'general',
]);
const SOURCES = new Set<AvatarLaunchContext['source']>([
  'now',
  'past-detail',
  'past-search',
  'future',
  'action-review',
  'global',
]);
const UNDERSTANDING_STATUSES = new Set<AvatarUnderstandingStatus>([
  'pending',
  'confirmed',
  'rejected',
  'superseded',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.content !== 'string') return null;
  if (!['user', 'assistant', 'system'].includes(String(value.role))) return null;
  if (!['text', 'audio', 'record_preview'].includes(String(value.type))) return null;
  if (typeof value.created_at !== 'string') return null;
  return value as unknown as ChatMessage;
};

const sanitizeContext = (value: unknown): AvatarLaunchContext | null => {
  if (!isRecord(value) || !MODES.has(value.mode as AvatarMode)) return null;
  if (!SOURCES.has(value.source as AvatarLaunchContext['source'])) return null;
  return {
    mode: value.mode as AvatarMode,
    source: value.source as AvatarLaunchContext['source'],
    ...(typeof value.entryId === 'string' ? { entryId: value.entryId } : {}),
    ...(typeof value.query === 'string' ? { query: value.query } : {}),
    ...(typeof value.actionId === 'string' ? { actionId: value.actionId } : {}),
    ...(typeof value.prompt === 'string' ? { prompt: value.prompt } : {}),
  };
};

const sanitizeReference = (value: unknown): AvatarSourceReference | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.entryId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.date !== 'number' ||
    typeof value.excerpt !== 'string' ||
    typeof value.reason !== 'string'
  ) {
    return null;
  }
  return value as unknown as AvatarSourceReference;
};

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
    return [{
      id: item.id,
      mode: context.mode,
      context,
      messages,
      references,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }];
  });
};

export const readAvatarSessions = (): AvatarSession[] =>
  sanitizeAvatarSessions(getStoredJson<unknown>(SESSION_KEY)).sort((a, b) => b.updatedAt - a.updatedAt);

const contextsMatch = (session: AvatarSession, context: AvatarLaunchContext) =>
  session.mode === context.mode &&
  session.context.source === context.source &&
  session.context.entryId === context.entryId &&
  session.context.actionId === context.actionId;

export const readAvatarSession = (context: AvatarLaunchContext): AvatarSession | null =>
  readAvatarSessions().find((session) => contextsMatch(session, context)) ?? null;

export const writeAvatarSession = (session: AvatarSession): boolean => {
  const next = [
    { ...session, messages: session.messages.slice(-MAX_MESSAGES) },
    ...readAvatarSessions().filter((item) => item.id !== session.id),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  return setStoredJson(SESSION_KEY, next);
};

export const sanitizeAvatarUnderstandings = (value: unknown): AvatarUnderstandingVersion[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.id !== 'string' ||
      typeof item.statement !== 'string' ||
      !UNDERSTANDING_STATUSES.has(item.status as AvatarUnderstandingStatus) ||
      typeof item.createdAt !== 'number'
    ) {
      return [];
    }
    return [{
      id: item.id,
      statement: item.statement,
      status: item.status as AvatarUnderstandingStatus,
      sourceEntryIds: Array.isArray(item.sourceEntryIds)
        ? item.sourceEntryIds.filter((id): id is string => typeof id === 'string')
        : [],
      createdAt: item.createdAt,
      ...(typeof item.updatedAt === 'number' ? { updatedAt: item.updatedAt } : {}),
      ...(typeof item.previousVersionId === 'string'
        ? { previousVersionId: item.previousVersionId }
        : {}),
    }];
  });
};

export const readAvatarUnderstandings = (): AvatarUnderstandingVersion[] =>
  sanitizeAvatarUnderstandings(getStoredJson<unknown>(UNDERSTANDING_KEY)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

export const writeAvatarUnderstanding = (version: AvatarUnderstandingVersion): boolean => {
  const current = readAvatarUnderstandings();
  const now = Date.now();
  const next = current
    .filter((item) => item.id !== version.id)
    .map((item) =>
      version.status === 'confirmed' && item.status === 'confirmed'
        ? { ...item, status: 'superseded' as const, updatedAt: now }
        : item,
    );
  return setStoredJson(UNDERSTANDING_KEY, [version, ...next].slice(0, 100));
};
