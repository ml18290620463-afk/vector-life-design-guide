import {
  assertAIPrivacyUnchanged,
  readAIPrivacy,
  isAIMessageAllowed,
  canAIReadEntry,
} from '../../../services/aiPrivacy';
import { readAvatarModel } from './avatarModel';
import type { ChatMessage } from '../types/now';
import type { AvatarFactKind } from '../../../server/avatarFactExtraction';
import type { AvatarMemoryCategory, AvatarMemoryStatus } from '../../avatar/types';

export interface AvatarSummarizeResponse {
  text: string;
  mood_tags: string[];
  event_tags: string[];
  is_sparse: boolean;
  followup_question: string | null;
  can_summarize?: boolean;
  reason?: string;
}

export const summarizeAvatarMessages = async (args: {
  messages: ChatMessage[];
  record_time: string;
  followup_round: number;
}): Promise<AvatarSummarizeResponse> => {
  const privacy = await readAIPrivacy();
  const messages = args.messages.filter((m) =>
    isAIMessageAllowed(m, privacy.entries, privacy.token),
  );
  if (!messages.some((m) => m.role === 'user')) throw new Error('请先发送新的对话');
  const response = await fetch('/api/v1/avatar/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...args,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!response.ok) throw new Error('avatar-summarize-failed');
  const result = (await response.json()) as AvatarSummarizeResponse;
  await assertAIPrivacyUnchanged(privacy.token);
  return result;
};

export async function chatWithAvatar(
  messages: ChatMessage[],
  memories: import('../../../services/avatarGuidance').GuidanceSource[],
  signal?: AbortSignal,
): Promise<string> {
  const privacy = await readAIPrivacy();
  messages = messages.filter((m) => isAIMessageAllowed(m, privacy.entries, privacy.token));
  memories = memories.filter((m) => m.aiPrivacyToken === privacy.token);
  if (!messages.some((m) => m.role === 'user')) throw new Error('请先发送新的对话');
  const response = await fetch('/api/v1/avatar/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      ...(readAvatarModel() ? { modelConfig: readAvatarModel() } : {}),
      messages: messages
        .filter((m) => m.type === 'text' && m.role !== 'system')
        .slice(-120)
        .map((m) => ({ role: m.role, content: m.content })),
      memories: memories.slice(0, 12).map(({ aiPrivacyToken: _token, ...source }) => source),
    }),
  });
  const result = await response.json();
  await assertAIPrivacyUnchanged(privacy.token);
  if (!response.ok) throw new Error(result.error || 'model_unavailable');
  if (typeof result.reply !== 'string' || !result.reply.trim())
    throw new Error('model_unavailable');
  return result.reply;
}

export interface AvatarFactCandidate {
  statement: string;
  kind: AvatarFactKind;
  sourceIndexes: number[];
  /** Present only for a cautious pattern observation; used to accumulate matching evidence. */
  patternKey?: string;
  /** An existing confirmed memory that the user explicitly said has changed. */
  replacesReferenceId?: string;
}

// A conversation may describe an event, but only the recording flow can make
// it a Past experience. Keep this client guard in addition to the server-side
// allowlist so an invalid or stale provider response cannot open that path.
const CHAT_MEMORY_KINDS = new Set<AvatarFactKind>([
  'profile',
  'preference',
  'boundary',
  'value',
  'habit',
  'goal',
  'expression',
  'pattern_candidate',
]);

/**
 * A deliberately small, non-sensitive view of existing memories.  It gives the
 * extractor enough context to avoid repeating an understanding, without
 * exposing its evidence, private notes, or internal relations to a provider.
 */
export interface AvatarMemoryExtractionReference {
  aiPrivacyToken?: string;
  /** Opaque, request-scoped reference. It enables an optional confirmed update. */
  id?: string;
  text: string;
  status: Extract<AvatarMemoryStatus, 'candidate' | 'confirmed' | 'retained'>;
  patternKey?: string;
  category?: AvatarMemoryCategory;
}

export async function extractAvatarFacts(
  messages: ChatMessage[],
  known: AvatarMemoryExtractionReference[],
) {
  // Keep the dialogue intact: assistant turns provide clarification context, but the
  // server accepts evidence only from user turns.
  const privacy = await readAIPrivacy();
  const sources = messages
    .filter((m) => isAIMessageAllowed(m, privacy.entries, privacy.token))
    .filter((m) => m.type === 'text' && m.role !== 'system')
    .slice(-120);
  if (!sources.some((m) => m.role === 'user')) throw new Error('请先发送新的对话');
  const response = await fetch('/api/v1/avatar/memory/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(readAvatarModel() ? { modelConfig: readAvatarModel() } : {}),
      messages: sources.map((m) => ({ role: m.role, content: m.content })),
      memories: known
        .filter((m) => m.aiPrivacyToken === privacy.token)
        .slice(-12)
        .map(({ aiPrivacyToken: _token, ...reference }) => reference),
    }),
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as { error?: unknown } | null;
    // Keep the provider's normalized code so the interface can give the same
    // concrete recovery guidance for extraction as it does for a chat reply.
    throw new Error(
      typeof failure?.error === 'string' ? failure.error : 'memory_extraction_failed',
    );
  }
  const result = (await response.json()) as {
    candidates?: AvatarFactCandidate[];
    candidate?: AvatarFactCandidate | null;
  };
  await assertAIPrivacyUnchanged(privacy.token);
  const candidates = (result.candidates ?? (result.candidate ? [result.candidate] : [])).filter(
    (candidate) => CHAT_MEMORY_KINDS.has(candidate.kind),
  );
  return candidates.map((candidate) => {
    const sourceMessages = candidate.sourceIndexes.map((index) => sources[index]);
    if (sourceMessages.some((source) => !source || source.role !== 'user'))
      throw new Error('invalid_memory_source');
    return { ...candidate, sources: sourceMessages as ChatMessage[] };
  });
}

export async function previewAvatarGrowth(args: {
  messages: Array<{ role: string; content: string; createdAt?: number }>;
  source: 'past';
  sourceEntryId: string;
  sourceSupplementId?: string;
  occurredAt: number;
  evidenceSources: Array<{
    entryId: string;
    supplementId?: string;
    content: string;
    createdAt: number;
  }>;
  entries: Array<{ id: string; title: string; content: string; tags: string[]; createdAt: number }>;
  understandings: unknown[];
}) {
  const privacy = await readAIPrivacy();
  const allowed = new Map(privacy.entries.filter((e) => canAIReadEntry(e)).map((e) => [e.id, e]));
  if (
    !allowed.has(args.sourceEntryId) ||
    !args.evidenceSources.some(
      (s) => s.entryId === args.sourceEntryId && s.supplementId === args.sourceSupplementId,
    ) ||
    args.evidenceSources.some((source) => {
      const entry = allowed.get(source.entryId);
      const text = source.supplementId
        ? entry?.supplements?.find((s) => s.id === source.supplementId && !s.isEncrypted)?.content
        : entry?.content;
      return !text || text !== source.content;
    }) ||
    args.entries.some((e) => !allowed.has(e.id))
  )
    throw new Error('记录未授权 AI 读取');
  const modelConfig = readAvatarModel();
  if (!modelConfig) throw new Error('model_not_configured');
  const response = await fetch('/api/v1/avatar/growth-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...args,
      modelConfig,
      messages: args.evidenceSources.map((s) => ({
        role: 'user',
        content: s.content,
        createdAt: s.createdAt,
      })),
      entries: args.evidenceSources.map((s) => ({
        id: s.entryId,
        title: '',
        content: s.content,
        tags: [],
        createdAt: s.createdAt,
        aiVisibility: 'allowed',
      })),
      understandings: args.understandings.filter((item) => {
        const value = item as { sourceEntryIds?: string[]; status?: string } | null;
        return (
          value?.status === 'confirmed' &&
          Array.isArray(value.sourceEntryIds) &&
          value.sourceEntryIds.length > 0 &&
          value.sourceEntryIds.every((id) => allowed.has(id))
        );
      }),
    }),
  });
  const result = await response.json();
  await assertAIPrivacyUnchanged(privacy.token);
  if (!response.ok) throw new Error(result.error || 'model_unavailable');
  return result;
}

export async function extractAvatarFact(
  messages: ChatMessage[],
  known: AvatarMemoryExtractionReference[],
) {
  return (await extractAvatarFacts(messages, known))[0] ?? null;
}
