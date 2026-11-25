import { selectRevisionCandidates } from '../../../services/avatarRevisionSelection';
import { useAIVisibilityChoice } from '../../../components/AIVisibilityDialog';
import { saveReviewedAvatarCognition } from '../../../services/avatarOntologyCandidates';
import { readAvatarOntology } from '../../../services/avatarOntologyStore';
import { assertAIPrivacyUnchanged } from '../../../services/aiPrivacy';
import {
  memoryStatementKey,
} from '../../../services/avatarStatementComparison';
import { useEffect, useRef, useState } from 'react';
import { saveArchiveDirection } from '../../../services/futureRepository';
import { generateSecureId } from '../../../services/idGenerator';
import type {
  CognitiveCategory,
  CognitiveObject,
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
  const mapping: Record<
    AvatarFactCandidate['kind'],
    { category: AvatarMemoryCategory; facets: AvatarMemoryFacet[]; nature: AvatarMemoryNature }
  > = {
    profile: { category: 'profile', facets: ['domain_background'], nature: 'explicit' },
    preference: { category: 'recent_state', facets: ['preference'], nature: 'explicit' },
    boundary: { category: 'judgment', facets: ['boundary'], nature: 'explicit' },
    value: { category: 'judgment', facets: ['value'], nature: 'explicit' },
    habit: { category: 'habits', facets: ['habit'], nature: 'explicit' },
    goal: { category: 'goals', facets: ['aspirational_self'], nature: 'explicit' },
    expression: { category: 'expression', facets: ['preference'], nature: 'explicit' },
    pattern_candidate: { category: 'judgment', facets: ['cognitive_pattern'], nature: 'inferred' },
  };
  return mapping[kind];
};

interface UseAvatarMemoryCaptureOptions {
  draft: NowDraft;
  sessionId: string;
  avatarMemoryReferences: AvatarMemoryExtractionReference[];
  showToast: (message: string) => void;
  refreshAvatarMemories: () => void;
  appendReviewMessage?: (statement: string) => ChatMessage[];
  prepareExtraction: (messages: ChatMessage[]) => Promise<unknown>;
}

export const useAvatarMemoryCapture = ({
  draft,
  sessionId,
  avatarMemoryReferences,
  showToast,
  refreshAvatarMemories,
  prepareExtraction,
  appendReviewMessage,
}: UseAvatarMemoryCaptureOptions) => {
  const visibilityChoice = useAIVisibilityChoice('zh', 'memory');
  const [companionSummary, setCompanionSummary] = useState<RecordPreviewPayload | null>(null);
  const [memoryNature, setMemoryNature] = useState<AvatarMemoryNature>('inferred');
  const [candidateKind, setCandidateKind] = useState<AvatarFactCandidate['kind'] | null>(null);
  const [candidateCategory, setCandidateCategory] = useState<AvatarMemoryCategory | null>(null);
  const [candidateReplacementId, setCandidateReplacementId] = useState<string | null>(null);
  const [candidateSources, setCandidateSources] = useState<AvatarMemorySourceRef[]>([]);
  const [extractedFacets, setExtractedFacets] = useState<AvatarMemoryFacet[] | null>(null);
  type CapturedCandidate = Awaited<ReturnType<typeof extractAvatarFacts>>[number];
  const [candidateQueue, setCandidateQueue] = useState<CapturedCandidate[]>([]);
  const [candidatePosition, setCandidatePosition] = useState(0);
  const [memorySaving, setMemorySaving] = useState(false);
  const [generatingMemory, setGeneratingMemory] = useState(false);
  const extractionBusy = useRef(false);
  const extractionMounted = useRef(true);
  const summaryOpen = useRef(false);
  const memorySavingRef = useRef(false);
  const revisionTarget = useRef<CognitiveObject | null>(null);
  const candidatePrivacyToken = useRef<string | null>(null);
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
      setCandidateReplacementId(null);
      setCandidateSources([]);
    }
  }, [companionSummary]);

  const showCandidate = (candidate: CapturedCandidate) => {
    candidatePrivacyToken.current = candidate.aiPrivacyToken;
    const metadata = factMemoryMetadata(candidate.kind);
    setMemoryNature(metadata.nature);
    setCandidateKind(candidate.kind);
    setCandidateCategory(metadata.category);
    setCandidateReplacementId((revisionTarget.current?.status === 'confirmed' ? revisionTarget.current.id : null) ??
      (candidate.action === 'propose_supersede' ? candidate.targetObjectId : null) ?? candidate.replacesReferenceId ?? null);
    setExtractedFacets(metadata.facets);
    setCandidateSources(
      candidate.evidenceAnchors.map((anchor) => ({
        source: 'message' as const,
        id: anchor.sourceId,
        excerpt: anchor.verbatimQuote,
        createdAt: Date.parse(anchor.sourceOccurredAt),
        sessionId,
      })),
    );
    setCompanionSummary({
      text: candidate.statement,
      mood_tags: [],
      event_tags: [],
      record_time: draft.record_time,
      display_time: draft.display_time,
      is_sparse: false,
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
    showToast('请先在对话中表达要保存的信息，再提炼并确认');
  };

  const considerAvatarName = (_name: string, sourceMessages: ChatMessage[]) => {
    // Naming follows the same server quote verification as every other expression.
    void generateCompanionSummary(sourceMessages);
  };

  const generateCompanionSummary = async (sourceMessages: ChatMessage[], automatic = false, revision?: CognitiveObject, revalidation = false) => {
    if (extractionBusy.current || (summaryOpen.current && !revalidation)) return;
    if (!sourceMessages.some((message) => message.role === 'user')) {
      showToast('先聊几句，再提炼个人信息');
      return;
    }
    revisionTarget.current = revision ?? null;
    extractionBusy.current = true;
    setGeneratingMemory(true);
    try {
      await prepareExtraction(sourceMessages);
      const candidates = await extractAvatarFacts(sourceMessages, avatarMemoryReferences);
      if (!extractionMounted.current || (summaryOpen.current && !revalidation)) return;
      const eligibleCandidates = revision
        ? selectRevisionCandidates(candidates, sourceMessages, revision)
        : candidates;
      const uniqueCandidates = eligibleCandidates.filter(
        (candidate, index) => eligibleCandidates.findIndex(
          (item) => memoryStatementKey(item.statement) === memoryStatementKey(candidate.statement),
        ) === index,
      );
      if (!uniqueCandidates.length) {
        if (!automatic) showToast('这段对话更适合留在聊天记录中，暂未发现需要写入档案的长期信息');
        return;
      }
      // One explicit revision action can replace the target only once.
      const reviewCandidates = revision ? uniqueCandidates.slice(0, 1) : uniqueCandidates;
      setCandidateQueue(reviewCandidates);
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

  const confirmMemory = async (
    tags: string[],
    category: AvatarMemoryCategory,
    confirmedNature: AvatarMemoryNature,
    directionKind?: 'vision' | 'goal' | 'action',
  ) => {
    if (!companionSummary?.text.trim()) return;
    // This hook only handles chat candidates. Past entries are created through
    // the recording flow, never by confirming a conversation extraction.
    if (confirmedNature === 'experience' || category === 'experience') {
      showToast('经历请在「现在」中记录后保存到过去');
      return;
    }
    if (memorySavingRef.current) return;
    memorySavingRef.current = true;
    setMemorySaving(true);
    try {
      const reviewedCandidate = candidateQueue[candidatePosition];
      if (!directionKind && reviewedCandidate && companionSummary.text !== reviewedCandidate.statement) {
        if (!appendReviewMessage) {
          showToast('审核内容已修改，请重新核验用户原话');
          return;
        }
        const messages = appendReviewMessage(companionSummary.text);
        await generateCompanionSummary(messages, false, revisionTarget.current ?? undefined, true);
        // Revalidation only presents a fresh proposal. A separate explicit action
        // is required before choosing visibility and committing the new receipt.
        return;
      }
      const aiVisibility = await visibilityChoice.request();
      if (!aiVisibility) return;
      try {
        if (candidatePrivacyToken.current !== null)
          await assertAIPrivacyUnchanged(candidatePrivacyToken.current);
      } catch {
        showToast('记录的 AI 权限已变化，请重新提炼后确认');
        setCandidateQueue([]);
        setCompanionSummary(null);
        return;
      }
      if (directionKind) {
        try {
          directionProposalId.current ??= generateSecureId('proposal');
          await saveArchiveDirection({
            proposalId: directionProposalId.current,
            aiVisibility,
            kind: directionKind,
            text: companionSummary.text,
            tags,
            sourceRefs: candidateSources,
          });
          advanceCandidate();
          showToast('已存入方向与行动');
        } catch {
          showToast('保存失败，请重试');
        }
        return;
      }
      const candidate = candidateQueue[candidatePosition];
      if (!candidate) {
        showToast('缺少经过核验的用户原话，请重新提炼');
        return;
      }
      const categories: Record<AvatarFactCandidate['kind'], CognitiveCategory> = {
        profile: 'foundation_situation',
        preference: 'preferences_boundaries',
        boundary: 'preferences_boundaries',
        value: 'values_motivation',
        habit: 'foundation_situation',
        expression: 'preferences_boundaries',
        pattern_candidate: 'understanding_judgment',
        goal: 'foundation_situation',
      };
      const graph = await readAvatarOntology();
      const saved = await saveReviewedAvatarCognition({
        extraction: candidate,
        expectedRevision: graph.revision,
        sessionId,
        domain: candidate.kind === 'pattern_candidate' ? 'my_understanding' : 'about_me',
        category: revisionTarget.current?.category ?? categories[candidate.kind],
        ...(revisionTarget.current?.status === 'candidate'
          ? { replacesCandidateId: revisionTarget.current.id } : {}),
        aiVisible: aiVisibility === 'allowed',
        statement: companionSummary.text,
        ...(candidateReplacementId
          ? { revision: { previousObjectId: candidateReplacementId, reason: candidate.revisionReason } }
          : {}),
      });
      refreshAvatarMemories();
      advanceCandidate();
      const object = saved.graph.objects.find((item) => item.id === saved.objectId)!;
      showToast(
        object.status === 'candidate'
          ? '已保留为观察线索，更多独立证据支持后再请你确认'
          : candidateReplacementId
            ? '已更新这条理解，旧版本已保留在我的变化中'
            : '已存入记忆',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      memorySavingRef.current = false;
      setMemorySaving(false);
    }
  };

  return {
    dialog: visibilityChoice.dialog,
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
      ? (avatarMemoryReferences.find((memory) => memory.id === candidateReplacementId)?.text ??
        null)
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
