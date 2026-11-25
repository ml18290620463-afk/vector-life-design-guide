import { focusedExcerpt, isAvatarContextContinuation } from '../../../services/avatarGuidance';
import {
  resolveGuidanceBudget,
  type GuidanceSelectionOptions,
} from '../../../services/avatarGuidancePolicy';
import { attestExperienceCandidate } from '../../../services/avatarExperienceReceipt';
import { attestAvatarExtraction } from '../../../services/avatarExtractionReceipt';
import type { AvatarGrowthPreview } from '../../../services/avatarIntelligence';
import { avatarRequest } from './avatarRequest';
import { readAIPrivacy, isAIMessageAllowed, canAIReadEntry } from '../../../services/aiPrivacy';
import { readAvatarModel } from './avatarModel';
import type { ChatMessage } from '../types/now';
import type { AvatarFactKind } from '../../../server/avatarFactExtraction';
import type { AvatarMemoryCategory } from '../../avatar/types';

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
  const { response, result } = await avatarRequest<AvatarSummarizeResponse>(
    privacy.token,
    '/api/v1/avatar/summarize',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...args,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    },
  );
  if (!response.ok) throw new Error('avatar-summarize-failed');
  return result;
};

export async function chatWithAvatar(
  messages: ChatMessage[],
  memories: import('../../../services/avatarGuidance').GuidanceSource[],
  signal?: AbortSignal,
  guidance: GuidanceSelectionOptions = {},
): Promise<string> {
  const privacy = await readAIPrivacy();
  messages = messages.filter((m) => isAIMessageAllowed(m, privacy.entries, privacy.token));
  memories = memories.filter((m) => m.aiPrivacyToken === privacy.token);
  if (!messages.some((m) => m.role === 'user')) throw new Error('请先发送新的对话');
  const question = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  guidance = {
    ...guidance,
    messageCount: messages.length,
    lightweightFollowup: isAvatarContextContinuation(question),
  };
  const budget = resolveGuidanceBudget(question, guidance);
  const excluded = new Set(guidance.excludedIds ?? []);
  const { response, result } = await avatarRequest<{ error?: string; reply?: string }>(
    privacy.token,
    '/api/v1/avatar/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        ...(readAvatarModel() ? { modelConfig: readAvatarModel() } : {}),
        messages: messages
          .filter((m) => m.type === 'text' && m.role !== 'system')
          .slice(-120)
          .map((m) => ({ role: m.role, content: m.content })),
        guidance: {
          mode: budget.policy.mode,
          expanded: budget.scopeTier === 'expanded',
          smallWindow: guidance.smallWindow,
          messageCount: messages.length,
          lightweightFollowup: guidance.lightweightFollowup,
        },
        memories: memories
          .filter((m) => !excluded.has(m.id))
          .slice(0, budget.limit)
          .map(({ aiPrivacyToken: _token, searchText: _search, ...source }) => ({
            ...source,
            text: focusedExcerpt(_search || source.text, question),
            detail: source.detail ? focusedExcerpt(source.detail, question) : undefined,
            evidence: source.evidence?.map(({ searchText: _local, entryId: _entryId, ...e }) => ({
              ...e,
              text: focusedExcerpt(_local || e.text, question),
            })),
            results: source.results?.map((r) => ({ ...r, text: focusedExcerpt(r.text, question) })),
          })),
      }),
    },
  );
  if (!response.ok) throw new Error(result.error || 'model_unavailable');
  if (typeof result.reply !== 'string' || !result.reply.trim())
    throw new Error('model_unavailable');
  return result.reply;
}

export interface AvatarFactCandidate {
  action?: 'create_new' | 'reinforce_existing' | 'propose_supersede';
  targetObjectId?: string;
  revisionReason?: string;
  statement: string;
  kind: AvatarFactKind;
  sourceIndexes: number[];
  /** Exact quotes returned only after server validation. */
  evidences: string[];
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
  status: 'candidate' | 'confirmed' | 'retained';
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
  // Retain original positions before filtering and applying the request window.
  const anchoredSources = messages
    .map((message, userMessageIndex) => ({ message: structuredClone(message), userMessageIndex }))
    .filter(({ message }) => isAIMessageAllowed(message, privacy.entries, privacy.token))
    .filter(({ message }) => message.type === 'text' && message.role !== 'system')
    .slice(-120);
  const sources = anchoredSources.map(({ message }) => message);
  if (!sources.some((m) => m.role === 'user')) throw new Error('请先发送新的对话');
  const { response, result } = await avatarRequest<{
    error?: string;
    candidates?: AvatarFactCandidate[];
    candidate?: AvatarFactCandidate | null;
  }>(privacy.token, '/api/v1/avatar/memory/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(readAvatarModel() ? { modelConfig: readAvatarModel() } : {}),
      messages: sources.map((m) => ({ role: m.role, content: m.content })),
      memories: known
        .filter((m) => m.aiPrivacyToken === privacy.token)
        .map(({ aiPrivacyToken: _token, ...reference }) => reference),
    }),
  });
  if (!response.ok) {
    throw new Error(result.error || 'memory_extraction_failed');
  }
  const candidates = (result.candidates ?? (result.candidate ? [result.candidate] : [])).filter(
    (candidate) => CHAT_MEMORY_KINDS.has(candidate.kind),
  );
  return candidates.map((candidate) => {
    if (
      !Array.isArray(candidate.sourceIndexes) ||
      candidate.sourceIndexes.length === 0 ||
      candidate.sourceIndexes.length > 3 ||
      new Set(candidate.sourceIndexes).size !== candidate.sourceIndexes.length ||
      !Array.isArray(candidate.evidences) ||
      candidate.evidences.length !== candidate.sourceIndexes.length
    )
      throw new Error('invalid_memory_source');
    const evidenceAnchors = candidate.sourceIndexes.map((index, position) => {
      const source = Number.isInteger(index) ? anchoredSources[index] : undefined;
      const quote = candidate.evidences[position];
      if (
        !source ||
        source.message.role !== 'user' ||
        typeof quote !== 'string' ||
        !quote.trim() ||
        quote.length > 700 ||
        !source.message.content.includes(quote)
      )
        throw new Error('invalid_memory_source');
      return {
        sourceId: source.message.id,
        userMessageIndex: source.userMessageIndex,
        verbatimQuote: quote,
        sourceOccurredAt: source.message.created_at,
      };
    });
    return attestAvatarExtraction({
      ...candidate,
      // This token belongs to the validated request, never to an arbitrary source turn.
      aiPrivacyToken: privacy.token,
      evidenceAnchors,
      sources: candidate.sourceIndexes.map((index) => sources[index]),
    });
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
        ? entry?.supplements?.find(
            (s) => s.id === source.supplementId && !s.isEncrypted && s.createdAt <= Date.now(),
          )?.content
        : entry?.content;
      return !text || text !== source.content;
    }) ||
    args.entries.some((e) => !allowed.has(e.id))
  )
    throw new Error('记录未授权 AI 读取');
  const modelConfig = readAvatarModel();
  if (!modelConfig) throw new Error('model_not_configured');
  const { response, result } = await avatarRequest<AvatarGrowthPreview & { error?: string }>(
    privacy.token,
    '/api/v1/avatar/growth-preview',
    {
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
        // The caller may request IDs, but never supply cognition content or permissions.
        understandings: privacy.cognitiveContext
          .filter(
            ({ object, evidence }) =>
              args.understandings.some(
                (item) =>
                  !!item && typeof item === 'object' && 'id' in item && item.id === object.id,
              ) &&
              evidence.every((edge) =>
                args.evidenceSources.some((source) => source.entryId === edge.toId),
              ),
          )
          .map(({ object, evidence }) => ({
            id: object.id,
            statement: object.statement,
            status: 'confirmed',
            sourceEntryIds: [...new Set(evidence.map((edge) => edge.toId))],
            createdAt: Date.parse(object.createdAt),
            aiVisibility: 'allowed',
          })),
      }),
    },
  );
  if (!response.ok) throw new Error(result.error || 'model_unavailable');
  for (const candidate of result.atomicMemoryCandidates) {
    const quoted = candidate.sourceRefs.filter((ref) => ref.excerpt?.trim());
    if (
      !quoted.length ||
      !quoted.every((ref) =>
        args.evidenceSources.some(
          (source) =>
            ref.source === 'entry' &&
            ref.id === source.entryId &&
            ref.supplementId === source.supplementId &&
            source.content.includes(ref.excerpt!),
        ),
      )
    )
      continue;
    attestExperienceCandidate(candidate, privacy.token);
  }
  return result;
}

export async function extractAvatarFact(
  messages: ChatMessage[],
  known: AvatarMemoryExtractionReference[],
) {
  return (await extractAvatarFacts(messages, known))[0] ?? null;
}
