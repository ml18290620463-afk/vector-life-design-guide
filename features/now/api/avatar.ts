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
  const response = await fetch('/api/v1/avatar/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error('avatar-summarize-failed');
  return (await response.json()) as AvatarSummarizeResponse;
};

export async function chatWithAvatar(
  messages: ChatMessage[],
  memories: import('../../../services/avatarGuidance').GuidanceSource[],
  signal?: AbortSignal,
): Promise<string> {
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
      memories: memories.slice(0, 12),
    }),
  });
  const result = await response.json();
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

/**
 * A deliberately small, non-sensitive view of existing memories.  It gives the
 * extractor enough context to avoid repeating an understanding, without
 * exposing its evidence, private notes, or internal relations to a provider.
 */
export interface AvatarMemoryExtractionReference {
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
  const sources = messages.filter((m) => m.type === 'text' && m.role !== 'system').slice(-120);
  const response = await fetch('/api/v1/avatar/memory/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(readAvatarModel() ? { modelConfig: readAvatarModel() } : {}),
      messages: sources.map((m) => ({ role: m.role, content: m.content })),
      memories: known.slice(-12),
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
  const candidates = result.candidates ?? (result.candidate ? [result.candidate] : []);
  return candidates.map((candidate) => {
    const sourceMessages = candidate.sourceIndexes.map((index) => sources[index]);
    if (sourceMessages.some((source) => !source || source.role !== 'user'))
      throw new Error('invalid_memory_source');
    return { ...candidate, sources: sourceMessages as ChatMessage[] };
  });
}

export async function extractAvatarFact(
  messages: ChatMessage[],
  known: AvatarMemoryExtractionReference[],
) {
  return (await extractAvatarFacts(messages, known))[0] ?? null;
}
