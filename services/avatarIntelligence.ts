import { eventTagForLookup } from '../features/now/constants/tags';
import type { DiaryEntry } from '../types';
import type {
  AvatarAtomicMemory,
  AvatarMemoryFacet,
  AvatarMemoryNature,
  AvatarMemorySensitivity,
  AvatarUnderstandingVersion,
  PastPatternDomain,
} from '../features/avatar/types';
import {
  analyzeAvatarInformation,
  buildAdaptiveFollowup,
  inferAvatarEventTags,
  inferAvatarMoodTags,
  selectAvatarRecallMemories,
} from '../features/now/state/nowRules';

export type AvatarExtractionFacet =
  | 'event'
  | 'emotion'
  | 'action'
  | 'thought'
  | 'result'
  | 'person'
  | 'goal'
  | 'boundary'
  | 'preference'
  | 'commitment';

export type AvatarMemoryScope = 'working' | 'longTerm';
export type AvatarTemporalFactStatus = 'candidate' | 'confirmed' | 'superseded' | 'rejected';
export type AvatarTemporalRelation = 'supports' | 'contradicts' | 'updates' | 'sameTheme';

export interface AvatarExtractionInput {
  messages: Array<{ role?: string; content: string; createdAt?: number }>;
  source?: 'now' | 'past' | 'future' | 'avatar';
  sourceEntryId?: string;
  occurredAt?: number;
}

export interface AvatarEvidenceReference {
  source: 'message' | 'entry' | 'understanding';
  id: string;
  excerpt: string;
  createdAt?: number;
}

export interface AvatarExperienceSignal {
  facet: AvatarExtractionFacet;
  text: string;
  confidence: number;
  evidence: AvatarEvidenceReference[];
}

export interface AvatarStructuredExtraction {
  summary: string;
  signals: AvatarExperienceSignal[];
  moodTags: string[];
  eventTags: string[];
  completeness: number;
  nextQuestion: string | null;
  needsUserConfirmation: boolean;
  sourceEntryId?: string;
  occurredAt: number;
}

export interface AvatarMemoryCandidate {
  id: string;
  statement: string;
  scope: AvatarMemoryScope;
  confidence: number;
  reason: string;
  sourceEntryIds: string[];
  evidence: AvatarEvidenceReference[];
}

export interface AvatarTemporalFact {
  id: string;
  subject: 'self' | 'relationship' | 'work' | 'health' | 'goal' | 'preference';
  predicate: string;
  object: string;
  validFrom: number;
  status: AvatarTemporalFactStatus;
  confidence: number;
  sourceEntryIds: string[];
  evidence: AvatarEvidenceReference[];
}

export interface AvatarTemporalEdge {
  fromId: string;
  toId: string;
  relation: AvatarTemporalRelation;
  confidence: number;
  reason: string;
}

export interface AvatarConflictCandidate {
  currentFactId: string;
  previousUnderstandingId: string;
  previousStatement: string;
  reason: string;
  confidence: number;
}

export interface AvatarGrowthPreview {
  extraction: AvatarStructuredExtraction;
  memoryCandidates: AvatarMemoryCandidate[];
  atomicMemoryCandidates: AvatarAtomicMemory[];
  temporalFacts: AvatarTemporalFact[];
  temporalEdges: AvatarTemporalEdge[];
  conflicts: AvatarConflictCandidate[];
  recallEntryIds: string[];
  writePolicy: {
    requiresUserConfirmation: true;
    mem0: 'pending';
    graphiti: 'pending';
  };
}

export interface AvatarGrowthContext {
  entries?: Array<Pick<DiaryEntry, 'id' | 'title' | 'content' | 'tags' | 'createdAt'>>;
  understandings?: AvatarUnderstandingVersion[];
  now?: number;
}

export interface StructuredExtractionProvider {
  extract(input: AvatarExtractionInput): Promise<AvatarStructuredExtraction>;
}

export interface LongTermMemoryProvider {
  propose(extraction: AvatarStructuredExtraction): Promise<AvatarMemoryCandidate[]>;
}

export interface TemporalGraphProvider {
  propose(
    extraction: AvatarStructuredExtraction,
    memoryCandidates: AvatarMemoryCandidate[],
    context?: AvatarGrowthContext,
  ): Promise<{
    facts: AvatarTemporalFact[];
    edges: AvatarTemporalEdge[];
    conflicts: AvatarConflictCandidate[];
  }>;
}

const clampConfidence = (value: number): number =>
  Math.max(0, Math.min(1, Number(value.toFixed(2))));

const normalizeText = (text: string): string => text.replace(/\s+/g, ' ').trim();

const compact = (text: string, maxLength = 96): string => {
  const normalized = normalizeText(text);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
};

const stableId = (prefix: string, parts: Array<string | number | undefined>): string => {
  const input = parts.filter((part) => part !== undefined && part !== '').join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
};

const latestMatchingLine = (lines: string[], pattern: RegExp): string | null =>
  [...lines].reverse().find((line) => pattern.test(line)) ?? null;

const buildMessageEvidence = (
  line: string,
  index: number,
  createdAt?: number,
): AvatarEvidenceReference => ({
  source: 'message',
  id: `message-${index + 1}`,
  excerpt: compact(line, 72),
  ...(typeof createdAt === 'number' ? { createdAt } : {}),
});

const pushSignal = (
  signals: AvatarExperienceSignal[],
  facet: AvatarExtractionFacet,
  line: string | null,
  evidence: AvatarEvidenceReference | null,
  confidence: number,
) => {
  if (!line || !evidence) return;
  if (signals.some((signal) => signal.facet === facet && signal.text === compact(line))) return;
  signals.push({
    facet,
    text: compact(line),
    confidence: clampConfidence(confidence),
    evidence: [evidence],
  });
};

const inferSubject = (eventTags: string[]): AvatarTemporalFact['subject'] => {
  if (
    eventTags.some((tag) => ['人际交往', '家庭亲密'].includes(tag)) ||
    eventTags.includes('人际关系') ||
    eventTags.includes('家庭情感')
  )
    return 'relationship';
  if (
    eventTags.some((tag) => ['工作事业', '财务收支'].includes(tag)) ||
    eventTags.includes('职业发展') ||
    eventTags.includes('财务状况')
  )
    return 'work';
  if (eventTags.includes('身心健康') || eventTags.includes('身体健康')) return 'health';
  if (eventTags.includes('自我实现') || eventTags.includes('个人成长')) return 'goal';
  return 'self';
};

const relationFromEntryTags = (
  eventTags: string[],
  entry: Pick<DiaryEntry, 'tags'>,
): AvatarTemporalRelation | null => {
  const normalizedEntryTags = entry.tags.map((tag) =>
    eventTagForLookup(tag.replace(/^(心情|事件):/, '').trim()),
  );
  if (eventTags.some((tag) => normalizedEntryTags.includes(tag))) return 'sameTheme';
  return null;
};

const contradictionPatterns = [
  ['不想', '想'],
  ['不再', '一直'],
  ['不是', '是'],
  ['拒绝', '接受'],
  ['边界', '承担'],
] as const;

const hasLikelyConflict = (current: string, previous: string): boolean =>
  contradictionPatterns.some(
    ([currentSignal, previousSignal]) =>
      current.includes(currentSignal) && previous.includes(previousSignal),
  );

const facetToAtomicFacet = (facet: AvatarExtractionFacet): AvatarMemoryFacet => {
  switch (facet) {
    case 'preference':
      return 'preference';
    case 'boundary':
      return 'boundary';
    case 'goal':
      return 'aspirational_self';
    case 'commitment':
      return 'motivation';
    case 'thought':
      return 'cognitive_pattern';
    case 'emotion':
      return 'emotional_trigger';
    case 'action':
      return 'behavioral_pattern';
    case 'person':
      return 'relationship_view';
    case 'result':
      return 'constraint';
    case 'event':
    default:
      return 'domain_background';
  }
};

const facetToNature = (facet: AvatarExtractionFacet): AvatarMemoryNature => {
  if (facet === 'commitment') return 'commitment';
  if (facet === 'emotion') return 'state';
  if (facet === 'event' || facet === 'result' || facet === 'action') return 'experience';
  if (facet === 'preference' || facet === 'boundary' || facet === 'goal') return 'explicit';
  return 'inferred';
};

const facetToSensitivity = (facet: AvatarExtractionFacet): AvatarMemorySensitivity =>
  facet === 'boundary' || facet === 'emotion' || facet === 'person' ? 'sensitive' : 'normal';

const domainToAtomicFacet = (domain?: PastPatternDomain): AvatarMemoryFacet => {
  switch (domain) {
    case 'behavioral':
      return 'behavioral_pattern';
    case 'emotional':
      return 'emotional_pattern';
    case 'relational':
      return 'relational_pattern';
    case 'motivational':
      return 'motivation';
    case 'coping':
      return 'recovery_resource';
    case 'cognitive':
    default:
      return 'cognitive_pattern';
  }
};

export const buildAtomicMemoryCandidates = (
  extraction: AvatarStructuredExtraction,
  memoryCandidates: AvatarMemoryCandidate[],
): AvatarAtomicMemory[] => {
  const durable = new Set(memoryCandidates.map((candidate) => candidate.statement));
  const baseRefs = extraction.sourceEntryId
    ? [{ source: 'entry' as const, id: extraction.sourceEntryId, createdAt: extraction.occurredAt }]
    : [];
  const candidates: AvatarAtomicMemory[] = extraction.signals
    .filter((signal) => durable.has(signal.text) && signal.facet !== 'emotion')
    .map((signal) => ({
      id: stableId('atomic', [signal.facet, signal.text, extraction.sourceEntryId]),
      statement: signal.text,
      nature: facetToNature(signal.facet),
      facets: [facetToAtomicFacet(signal.facet)],
      tags: extraction.eventTags,
      contexts: extraction.eventTags,
      sourceRefs: [
        ...baseRefs,
        ...signal.evidence.map((evidence) => ({
          source: evidence.source === 'understanding' ? ('pattern' as const) : evidence.source,
          id: evidence.id,
          excerpt: evidence.excerpt,
          ...(typeof evidence.createdAt === 'number' ? { createdAt: evidence.createdAt } : {}),
        })),
      ],
      confidence: signal.confidence,
      status: 'candidate' as const,
      sensitivity: facetToSensitivity(signal.facet),
      validFrom: extraction.occurredAt,
      createdAt: extraction.occurredAt,
    }));
  // Multiple facets describe one statement from the same extraction, not separate memories.
  // Never deduplicate historical records or similar statements from independent sources.
  const grouped = new Map<string, AvatarAtomicMemory>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.statement);
    if (!existing) {
      grouped.set(candidate.statement, candidate);
      continue;
    }
    existing.facets = [...new Set([...existing.facets, ...candidate.facets])];
    existing.sourceRefs.push(
      ...candidate.sourceRefs.filter(
        (ref) =>
          !existing.sourceRefs.some(
            (saved) =>
              saved.source === ref.source && saved.id === ref.id && saved.excerpt === ref.excerpt,
          ),
      ),
    );
    if (existing.nature !== candidate.nature) existing.nature = 'inferred';
    existing.confidence = Math.min(existing.confidence, candidate.confidence);
    if (candidate.sensitivity === 'sensitive') existing.sensitivity = 'sensitive';
  }
  return [...grouped.values()];
};

export const atomicMemoryFromPattern = (
  pattern: AvatarUnderstandingVersion,
): AvatarAtomicMemory => ({
  id: stableId('atomic_pattern', [pattern.id, pattern.statement]),
  statement: pattern.statement,
  nature: 'inferred',
  facets: [domainToAtomicFacet(pattern.patternDomain)],
  tags: [pattern.patternLabel, pattern.patternDomain]
    .filter((item): item is string => Boolean(item))
    .slice(0, 4),
  contexts: [pattern.patternLabel, pattern.trigger].filter((item): item is string => Boolean(item)),
  sourceRefs: [
    { source: 'pattern', id: pattern.id, excerpt: pattern.patternLabel ?? pattern.statement },
    ...pattern.sourceEntryIds.map((id) => ({ source: 'entry' as const, id })),
  ],
  confidence: pattern.status === 'confirmed' ? 0.82 : 0.58,
  status:
    pattern.status === 'confirmed'
      ? 'confirmed'
      : pattern.status === 'rejected'
        ? 'rejected'
        : 'candidate',
  sensitivity:
    pattern.patternDomain === 'relational' || pattern.patternDomain === 'emotional'
      ? 'sensitive'
      : 'normal',
  createdAt: pattern.confirmedAt ?? pattern.createdAt,
  ...(pattern.updatedAt ? { updatedAt: pattern.updatedAt } : {}),
  ...(pattern.confirmedAt
    ? { confirmedAt: pattern.confirmedAt, confirmedBy: 'user' as const }
    : {}),
  ...(pattern.retainedAfterSourceDeletion ? { retainedAfterSourceDeletion: true } : {}),
});

export class LocalStructuredExtractionProvider implements StructuredExtractionProvider {
  async extract(input: AvatarExtractionInput): Promise<AvatarStructuredExtraction> {
    const userMessages = input.messages
      .map((message, index) => ({
        content: normalizeText(message.content),
        role: message.role,
        index,
        createdAt: message.createdAt,
      }))
      .filter((message) => message.role === 'user' && message.content.length > 0);
    const lines = userMessages.map((message) => message.content);
    const joinedText = lines.join('\n');
    const slots = analyzeAvatarInformation(userMessages);
    const moodTags = inferAvatarMoodTags(joinedText);
    const eventTags = inferAvatarEventTags(joinedText);
    const completeness = Math.round(
      ([slots.hasFact, slots.hasAction, slots.hasFeeling, slots.hasThought, slots.hasResult].filter(
        Boolean,
      ).length /
        5) *
        100,
    );
    const signals: AvatarExperienceSignal[] = [];
    const evidenceForLine = (line: string | null) => {
      if (!line) return null;
      const match = userMessages.find((message) => message.content === line);
      return match ? buildMessageEvidence(match.content, match.index, match.createdAt) : null;
    };

    const fact = latestMatchingLine(
      lines,
      /今天|昨天|刚刚|上午|下午|晚上|发生|看到|听到|遇到|收到|去了|来了|工作|项目|会议|家人|朋友|同事|身体/,
    );
    const action = latestMatchingLine(
      lines,
      /我做|我说|我没|我去了|我完成|我决定|我选择|回复|拒绝|接受|处理|推进|整理|复盘/,
    );
    const feeling = latestMatchingLine(
      lines,
      /开心|高兴|兴奋|焦虑|担心|不开心|难过|愤怒|生气|委屈|疲惫|很累|累了|迷茫|感动|平静|害怕|失落|压力/,
    );
    const thought = latestMatchingLine(
      lines,
      /我想|觉得|感觉|认为|意识到|明白|理解|判断|希望|担心|在意|因为|所以/,
    );
    const result = latestMatchingLine(
      lines,
      /结果|最后|后来|现在|已经|完成|结束|变成|导致|影响|收获|没成功|成功/,
    );
    const boundary = latestMatchingLine(lines, /边界|拒绝|不想|不再|不能一直|需要空间|保留自己/);
    const goal = latestMatchingLine(lines, /目标|希望|计划|想要|未来|方向|成为|完成|实现/);
    const preference = latestMatchingLine(lines, /喜欢|不喜欢|偏好|希望你|不要|需要你|适合我/);
    const commitment = latestMatchingLine(lines, /承诺|决定|接下来|我会|我要|明天|本周|下次/);

    pushSignal(signals, 'event', fact, evidenceForLine(fact), 0.74);
    pushSignal(signals, 'action', action, evidenceForLine(action), 0.78);
    pushSignal(signals, 'emotion', feeling, evidenceForLine(feeling), 0.8);
    pushSignal(signals, 'thought', thought, evidenceForLine(thought), 0.76);
    pushSignal(signals, 'result', result, evidenceForLine(result), 0.72);
    pushSignal(signals, 'boundary', boundary, evidenceForLine(boundary), 0.7);
    pushSignal(signals, 'goal', goal, evidenceForLine(goal), 0.68);
    pushSignal(signals, 'preference', preference, evidenceForLine(preference), 0.78);
    pushSignal(signals, 'commitment', commitment, evidenceForLine(commitment), 0.72);

    return {
      summary: compact(fact ?? thought ?? feeling ?? joinedText, 140),
      signals,
      moodTags,
      eventTags,
      completeness,
      nextQuestion: buildAdaptiveFollowup(userMessages, 0),
      needsUserConfirmation: true,
      ...(input.sourceEntryId ? { sourceEntryId: input.sourceEntryId } : {}),
      occurredAt: input.occurredAt ?? Date.now(),
    };
  }
}

export class LocalLongTermMemoryProvider implements LongTermMemoryProvider {
  async propose(extraction: AvatarStructuredExtraction): Promise<AvatarMemoryCandidate[]> {
    const durableFacets = new Set<AvatarExtractionFacet>([
      'thought',
      'boundary',
      'goal',
      'preference',
      'commitment',
    ]);
    return extraction.signals
      .filter(
        (signal) =>
          durableFacets.has(signal.facet) &&
          signal.evidence.length > 0 &&
          !/开玩笑|随口说|假如|假设|比如说/.test(signal.text) &&
          // A passing mood or wish is context, not a durable preference.
          (!/今天|此刻|现在|暂时|这会儿/.test(signal.text) ||
            /长期|一直|每次|反复|计划|接下来|决定|边界/.test(signal.text)),
      )
      .map((signal) => ({
        id: stableId('memory', [signal.facet, signal.text, extraction.sourceEntryId]),
        statement: signal.text,
        scope: signal.confidence >= 0.72 ? 'longTerm' : 'working',
        confidence: signal.confidence,
        reason:
          signal.facet === 'preference'
            ? '这是用户对产品或表达方式的明确偏好，适合进入长期记忆候选。'
            : signal.facet === 'boundary'
              ? '这是用户对边界和自我保护的表达，适合长期追踪变化。'
              : '这是可能影响未来判断的自我理解，需经用户确认后沉淀。',
        sourceEntryIds: extraction.sourceEntryId ? [extraction.sourceEntryId] : [],
        evidence: signal.evidence,
      }));
  }
}

export class LocalTemporalGraphProvider implements TemporalGraphProvider {
  async propose(
    extraction: AvatarStructuredExtraction,
    memoryCandidates: AvatarMemoryCandidate[],
    context: AvatarGrowthContext = {},
  ): Promise<{
    facts: AvatarTemporalFact[];
    edges: AvatarTemporalEdge[];
    conflicts: AvatarConflictCandidate[];
  }> {
    const subject = inferSubject(extraction.eventTags);
    const facts: AvatarTemporalFact[] = extraction.signals.map((signal) => ({
      id: stableId('fact', [
        signal.facet,
        signal.text,
        extraction.occurredAt,
        extraction.sourceEntryId,
      ]),
      subject: signal.facet === 'preference' ? 'preference' : subject,
      predicate: signal.facet,
      object: signal.text,
      validFrom: extraction.occurredAt,
      status: 'candidate',
      confidence: signal.confidence,
      sourceEntryIds: extraction.sourceEntryId ? [extraction.sourceEntryId] : [],
      evidence: signal.evidence,
    }));
    const temporalEdges: AvatarTemporalEdge[] = [];

    for (const entry of context.entries ?? []) {
      const relation = relationFromEntryTags(extraction.eventTags, entry);
      if (!relation) continue;
      for (const fact of facts.slice(0, 3)) {
        temporalEdges.push({
          fromId: fact.id,
          toId: entry.id,
          relation,
          confidence: 0.64,
          reason: `与过去记录「${compact(entry.title, 24)}」属于相近主题，可作为召回来源。`,
        });
      }
    }

    for (const candidate of memoryCandidates) {
      const sourceFact = facts.find((fact) => fact.object === candidate.statement);
      if (!sourceFact) continue;
      temporalEdges.push({
        fromId: sourceFact.id,
        toId: candidate.id,
        relation: 'updates',
        confidence: candidate.confidence,
        reason: '候选长期记忆由这条时间事实提炼而来。',
      });
    }

    const conflicts = facts.flatMap((fact) =>
      (context.understandings ?? [])
        .filter(
          (understanding) =>
            understanding.status === 'confirmed' &&
            hasLikelyConflict(fact.object, understanding.statement),
        )
        .map((understanding) => ({
          currentFactId: fact.id,
          previousUnderstandingId: understanding.id,
          previousStatement: understanding.statement,
          reason: '新的表达可能更新或挑战旧的分身理解，需要用户确认后再替换。',
          confidence: 0.62,
        })),
    );

    return { facts, edges: temporalEdges, conflicts };
  }
}

export const buildAvatarGrowthPreview = async (
  input: AvatarExtractionInput,
  context: AvatarGrowthContext = {},
  providers: {
    extraction?: StructuredExtractionProvider;
    memory?: LongTermMemoryProvider;
    graph?: TemporalGraphProvider;
  } = {},
): Promise<AvatarGrowthPreview> => {
  const extractionProvider = providers.extraction ?? new LocalStructuredExtractionProvider();
  const memoryProvider = providers.memory ?? new LocalLongTermMemoryProvider();
  const graphProvider = providers.graph ?? new LocalTemporalGraphProvider();
  const extraction = await extractionProvider.extract({
    ...input,
    occurredAt: input.occurredAt ?? context.now ?? Date.now(),
  });
  const memoryCandidates = await memoryProvider.propose(extraction);
  const atomicMemoryCandidates = buildAtomicMemoryCandidates(extraction, memoryCandidates);
  const graphPreview = await graphProvider.propose(extraction, memoryCandidates, context);
  const recallEntryIds = selectAvatarRecallMemories(
    context.entries ?? [],
    [extraction.summary, ...extraction.moodTags, ...extraction.eventTags].join(' '),
    5,
  ).map((memory) => memory.sourceEntryId);

  return {
    extraction,
    memoryCandidates,
    atomicMemoryCandidates,
    temporalFacts: graphPreview.facts,
    temporalEdges: graphPreview.edges,
    conflicts: graphPreview.conflicts,
    recallEntryIds,
    writePolicy: {
      requiresUserConfirmation: true,
      mem0: 'pending',
      graphiti: 'pending',
    },
  };
};
