import { useEffect, useRef, useState } from 'react';
import { saveArchiveDirection } from '../../../services/futureRepository';
import {
  readAvatarAtomicMemories,
  supersedeAvatarAtomicMemory,
  writeAvatarAtomicMemory,
} from '../../../services/avatarMemory';
import { readAvatarNameStatement } from '../../../services/avatarMemoryPolicy';
import { generateSecureId } from '../../../services/idGenerator';
import type {
  AvatarMemoryCategory,
  AvatarMemoryFacet,
  AvatarMemoryNature,
  AvatarMemorySourceRef,
} from '../../avatar/types';
import {
  extractAvatarFacts,
  type AvatarFactCandidate,
  type AvatarMemoryExtractionReference,
} from '../api/avatar';
import { modelError } from '../api/avatarModel';
import type { ChatMessage, NowDraft, RecordPreviewPayload } from '../types/now';

const inferMemoryFacets = (payload: RecordPreviewPayload): AvatarMemoryFacet[] => {
  const text = `${payload.text} ${payload.mood_tags.join(' ')} ${payload.event_tags.join(' ')}`;
  const facets = new Set<AvatarMemoryFacet>();
  if (/(喜欢|偏好|更想|倾向|讨厌|不喜欢)/.test(text)) facets.add('preference');
  if (/(边界|底线|不能接受|不想再|拒绝)/.test(text)) facets.add('boundary');
  if (/(价值|重要|在意|原则|必须守住)/.test(text)) facets.add('value');
  if (/(习惯|总是|反复|经常)/.test(text)) facets.add('habit');
  if (/(总是|反复|经常).*(焦虑|难过|开心|生气|委屈|害怕|压力)/.test(text))
    facets.add('emotional_pattern');
  if (/(目标|愿景|想成为|长期|未来)/.test(text)) facets.add('aspirational_self');
  if (!facets.size) facets.add('domain_background');
  return Array.from(facets).slice(0, 3);
};

const factMemoryMetadata = (kind: AvatarFactCandidate['kind']) => {
  const mapping: Record<AvatarFactCandidate['kind'], { category: AvatarMemoryCategory; facets: AvatarMemoryFacet[]; nature: AvatarMemoryNature }> = {
    profile: { category: 'profile', facets: ['domain_background'], nature: 'explicit' },
    preference: { category: 'recent_state', facets: ['preference'], nature: 'explicit' },
    boundary: { category: 'judgment', facets: ['boundary'], nature: 'explicit' },
    value: { category: 'judgment', facets: ['value'], nature: 'explicit' },
    habit: { category: 'habits', facets: ['habit'], nature: 'explicit' },
    goal: { category: 'goals', facets: ['aspirational_self'], nature: 'explicit' },
    experience: { category: 'experience', facets: ['domain_background'], nature: 'experience' },
    expression: { category: 'expression', facets: ['preference'], nature: 'explicit' },
    pattern_candidate: { category: 'judgment', facets: ['cognitive_pattern'], nature: 'inferred' },
  };
  return mapping[kind];
};

interface UseAvatarMemoryCaptureOptions {
  draft: NowDraft;
  sessionId: string;
  avatarMemoryReferences: AvatarMemoryExtractionReference[];
  onSend: (preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>;
  showToast: (message: string) => void;
  refreshAvatarMemories: () => void;
}

export const useAvatarMemoryCapture = ({
  draft,
  sessionId,
  avatarMemoryReferences,
  onSend,
  showToast,
  refreshAvatarMemories,
}: UseAvatarMemoryCaptureOptions) => {
  const [companionSummary, setCompanionSummary] = useState<RecordPreviewPayload | null>(null);
  const [memoryNature, setMemoryNature] = useState<AvatarMemoryNature>('inferred');
  const [candidateKind, setCandidateKind] = useState<AvatarFactCandidate['kind'] | null>(null);
  const [candidateCategory, setCandidateCategory] = useState<AvatarMemoryCategory | null>(null);
  const [candidatePatternKey, setCandidatePatternKey] = useState<string | null>(null);
  const [candidateReplacementId, setCandidateReplacementId] = useState<string | null>(null);
  const [candidateSources, setCandidateSources] = useState<AvatarMemorySourceRef[]>([]);
  const [extractedFacets, setExtractedFacets] = useState<AvatarMemoryFacet[] | null>(null);
  type CapturedCandidate = AvatarFactCandidate & { sources: ChatMessage[] };
  const [candidateQueue, setCandidateQueue] = useState<CapturedCandidate[]>([]);
  const [candidatePosition, setCandidatePosition] = useState(0);
  const [memorySaving, setMemorySaving] = useState(false);
  const [generatingMemory, setGeneratingMemory] = useState(false);
  const extractionBusy = useRef(false);
  const extractionMounted = useRef(true);
  const summaryOpen = useRef(false);
  const memorySavingRef = useRef(false);
  const directionProposalId = useRef<string | null>(null);
  summaryOpen.current = !!companionSummary;

  useEffect(() => {
    // React development Strict Mode replays effects. Resetting this flag on every
    // setup prevents the replay cleanup from permanently suppressing a completed
    // extraction and leaving the UI in its loading state.
    extractionMounted.current = true;
    return () => {
      extractionMounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!companionSummary) {
      directionProposalId.current = null;
      setExtractedFacets(null);
      setCandidateKind(null);
      setCandidateCategory(null);
      setCandidatePatternKey(null);
      setCandidateReplacementId(null);
      setCandidateSources([]);
    }
  }, [companionSummary]);

  const captureCandidateSources = (sourceMessages: ChatMessage[]): AvatarMemorySourceRef[] =>
    sourceMessages.map((message) => ({
      source: 'message' as const,
      id: message.id,
      excerpt: message.content.slice(0, 200),
      ...(Number.isFinite(Date.parse(message.created_at))
        ? { createdAt: Date.parse(message.created_at) }
        : {}),
      ...(sessionId.trim() ? { sessionId } : {}),
    }));

  const showCandidate = (candidate: CapturedCandidate) => {
    const metadata = factMemoryMetadata(candidate.kind);
    setMemoryNature(metadata.nature);
    setCandidateKind(candidate.kind);
    setCandidateCategory(metadata.category);
    setCandidatePatternKey(candidate.kind === 'pattern_candidate' ? candidate.patternKey ?? null : null);
    setCandidateReplacementId(candidate.replacesReferenceId ?? null);
    setExtractedFacets(metadata.facets);
    setCandidateSources(captureCandidateSources(candidate.sources));
    setCompanionSummary({
      text: candidate.statement, mood_tags: [], event_tags: [],
      record_time: draft.record_time, display_time: draft.display_time, is_sparse: false,
    });
  };

  const advanceCandidate = () => {
    const nextPosition = candidatePosition + 1;
    const next = candidateQueue[nextPosition];
    if (!next) {
      setCandidateQueue([]);
      setCandidatePosition(0);
      setCompanionSummary(null);
      return;
    }
    setCandidatePosition(nextPosition);
    showCandidate(next);
  };

  const dismissMemory = () => {
    if (candidateQueue.length) advanceCandidate();
    else setCompanionSummary(null);
  };

  const addMemory = () => {
    setCandidateQueue([]);
    setCandidatePosition(0);
    setMemoryNature('explicit');
    setCandidateKind(null);
    setCandidateCategory(null);
    setCandidatePatternKey(null);
    setCandidateReplacementId(null);
    setCandidateSources([]);
    setCompanionSummary({
      text: '',
      mood_tags: [],
      event_tags: [],
      record_time: new Date().toISOString(),
      display_time: '',
      is_sparse: false,
    });
  };

  const considerAvatarName = (name: string, source: ChatMessage) => {
    setCandidateQueue([]);
    setCandidatePosition(0);
    setMemoryNature('explicit');
    setCandidateKind('profile');
    setCandidateCategory('profile');
    setCandidateSources(captureCandidateSources([source]));
    setCompanionSummary({
      text: `用户为分身取名为「${name}」`,
      mood_tags: [],
      event_tags: ['分身称呼'],
      record_time: source.created_at,
      display_time: new Date(source.created_at).toLocaleString(),
      is_sparse: false,
    });
  };

  const generateCompanionSummary = async (sourceMessages: ChatMessage[], automatic = false) => {
    if (extractionBusy.current || summaryOpen.current) return;
    if (!sourceMessages.some((message) => message.role === 'user')) {
      showToast('先聊几句，再提炼个人信息');
      return;
    }
    extractionBusy.current = true;
    setGeneratingMemory(true);
    try {
      const candidates = await extractAvatarFacts(sourceMessages, avatarMemoryReferences);
      if (!extractionMounted.current || summaryOpen.current) return;
      const uniqueCandidates = candidates.filter((candidate, index) =>
        !avatarMemoryReferences.some((memory) => memory.text.trim() === candidate.statement.trim()) &&
        candidates.findIndex((item) => item.statement.trim() === candidate.statement.trim()) === index,
      );
      if (!uniqueCandidates.length) {
        if (!automatic) showToast('这段对话更适合留在聊天记录中，暂未发现需要写入档案的长期信息');
        return;
      }
      setCandidateQueue(uniqueCandidates);
      setCandidatePosition(0);
      showCandidate(uniqueCandidates[0]);
    } catch (error) {
      if (extractionMounted.current && !automatic) {
        const code = error instanceof Error ? error.message : 'memory_extraction_failed';
        showToast(
          code === 'memory_extraction_failed'
            ? '暂时无法提炼个人信息，请稍后重试'
            : modelError(code),
        );
      }
    } finally {
      extractionBusy.current = false;
      if (extractionMounted.current) setGeneratingMemory(false);
    }
  };

  const saveToPast = async (tags: string[]) => {
    if (!companionSummary?.text.trim()) return;
    try {
      if (await onSend({ ...companionSummary, event_tags: tags }, sessionId)) {
        advanceCandidate();
        showToast('已存入过去');
      }
    } catch {
      showToast('保存失败，请重试');
    }
  };

  const confirmMemory = async (
    tags: string[],
    category: AvatarMemoryCategory,
    confirmedNature: AvatarMemoryNature,
    directionKind?: 'vision' | 'goal' | 'action',
  ) => {
    if (!companionSummary?.text.trim()) return;
    if (
      confirmedNature === 'experience' ||
      (category === 'experience' && confirmedNature !== 'inferred')
    ) {
      void saveToPast(tags);
      return;
    }
    if (memorySavingRef.current) return;
    if (directionKind) {
      memorySavingRef.current = true;
      setMemorySaving(true);
      try {
        directionProposalId.current ??= generateSecureId('proposal');
        await saveArchiveDirection({
          proposalId: directionProposalId.current,
          kind: directionKind,
          text: companionSummary.text,
          tags,
          sourceRefs: candidateSources,
        });
        advanceCandidate();
        showToast('已存入方向与行动');
      } catch {
        showToast('保存失败，请重试');
      } finally {
        memorySavingRef.current = false;
        setMemorySaving(false);
      }
      return;
    }
    const replacementId = candidateReplacementId;
    if (replacementId) {
      const target = readAvatarAtomicMemories().find((memory) => memory.id === replacementId);
      if (!target || target.status !== 'confirmed') {
        showToast('原有理解已发生变化，请重新确认这条信息');
        return;
      }
      const updated = supersedeAvatarAtomicMemory(replacementId, companionSummary.text);
      if (!updated) {
        showToast('更新失败，请重试');
        return;
      }
      refreshAvatarMemories();
      advanceCandidate();
      showToast('已更新这条理解，旧版本已保留在我的变化中');
      return;
    }
    const now = Date.now();
    const isPatternCandidate = candidateKind === 'pattern_candidate';
    const saved = writeAvatarAtomicMemory({
      id:
        confirmedNature === 'explicit' && readAvatarNameStatement(companionSummary.text)
          ? 'avatar-name'
          : generateSecureId('avatar-memory'),
      statement: companionSummary.text.trim(),
      nature: confirmedNature,
      category,
      facets: extractedFacets ?? inferMemoryFacets(companionSummary),
      ...(isPatternCandidate && candidatePatternKey ? { patternKey: candidatePatternKey } : {}),
      tags,
      contexts: [
        candidateSources.length ? '对话记忆' : '手动添加',
        ...(isPatternCandidate ? ['待验证模式'] : []),
      ],
      sourceRefs: candidateSources,
      confidence: confirmedNature === 'inferred' ? 0.5 : 0.7,
      // A user may agree that an observation is worth retaining without
      // declaring it a stable trait. It stays a candidate until independent
      // conversations provide enough support for a final review.
      status: isPatternCandidate ? 'candidate' : 'confirmed',
      sensitivity: 'normal',
      createdAt: now,
      ...(isPatternCandidate ? {} : { confirmedAt: now, confirmedBy: 'user' as const }),
    });
    if (saved) {
      refreshAvatarMemories();
      advanceCandidate();
      showToast(isPatternCandidate ? '已保留为观察线索，更多表达支持后再请你确认' : '已存入记忆');
    } else showToast('保存失败，请重试');
  };

  return {
    companionSummary,
    setCompanionSummary,
    dismissMemory,
    candidatePosition,
    candidateTotal: candidateQueue.length,
    memoryNature,
    extractedFacets,
    candidateKind,
    candidateCategory,
    candidateReplacementId,
    replacementStatement: candidateReplacementId
      ? avatarMemoryReferences.find((memory) => memory.id === candidateReplacementId)?.text ?? null
      : null,
    candidateSources,
    memorySaving,
    generatingMemory,
    inferMemoryFacets,
    addMemory,
    considerAvatarName,
    generateCompanionSummary,
    confirmMemory,
  };
};
