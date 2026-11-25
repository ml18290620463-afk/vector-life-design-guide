import { resolveGuidanceBudget } from '../../../services/avatarGuidancePolicy';
import { useAvatarLanguage } from './avatarLanguage';
import { aiPrivacyToken, isAIMessageAllowed } from '../../../services/aiPrivacy';
/* eslint-disable max-lines -- This page composes the complete chat flow; focused logic lives in state and hooks. */
import {
  retrieveAvatarGuidanceContext,
  detectAvatarRetrievalIntent,
  getFocusText,
  resolveAvatarQueryScope,
} from '../state/avatarGuidanceContext';
import { AvatarMemoryDetail } from './AvatarMemoryDetail';
import { reviewArchiveCognition } from '../../../services/avatarOntologyArchive';
import {
  answerAvatarEvidence,
  resolvePatternCorrection,
} from '../../../services/avatarEvidenceDialogue';
import { modelError } from '../api/avatarModel';
import {
  buildDeterministicEntryCountReply,
  isAccessibleDiaryEntry,
  parseAvatarQueryPlan,
} from '../../../services/avatarQueryPlan';
import {
  buildAvatarEvidenceMetricReply,
  findAvatarEvidenceMetric,
} from '../../../services/avatarEvidenceMetrics';
import { searchNeuralRelatedEntryIds } from '../../../services/neuralSemanticRecall';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionItem, DiaryEntry, Principle } from '../../../types';
import type { FutureState } from '../../../types/future';
import {
  buildGuidanceSources,
  detectAvatarConversationIntent,
  extractAvatarName,
} from '../../../services/avatarGuidance';
import './avatarGuidance.css';
import { generateSecureId } from '../../../services/idGenerator';
import { CONFIG } from '../constants/config';
import { chatWithAvatar, summarizeAvatarMessages } from '../api/avatar';
import {
  buildAdaptiveFollowup,
  buildAvatarStructuredInsight,
  buildCompanionAcknowledgement,
  getRecordableInformation,
  isContentSufficient,
  selectAvatarRecallMemories,
  wantsDirectRecord,
} from '../state/nowRules';
import type { AvatarRecallMemory } from '../state/nowRules';
import {
  entryToRecallMemory,
  buildAssistantTextMessage as rawbuildAssistantTextMessage,
  buildRecordPreviewMessage as rawbuildRecordPreviewMessage,
  buildUserTextMessage as rawbuildUserTextMessage,
  getAvatarIntroMessages,
  readAndMarkAvatarIntroFirstVisit,
} from '../state/avatarChatRules';
import type { ChatMessage, NowDraft, NowRoute, RecordPreviewPayload } from '../types/now';
import type {
  AvatarLaunchContext,
  AvatarSourceReference,
  CognitiveObject,
} from '../../avatar/types';
import {
  initializeAvatarOntology,
  settleExpiredAvatarOntology,
  readAvatarOntology,
  type AvatarOntologySnapshot,
} from '../../../services/avatarOntologyStore';
import {
  createAvatarSessionWriter,
  selectAvatarConversation,
} from '../../../services/avatarOntologySessions';
import { subscribeVault } from '../../../services/vaultTransaction';
import { AvatarChatSurface } from './AvatarChatSurface';
import { detectAvatarReliabilityTask, reliabilityReply } from '../state/avatarReliabilityTasks';
import { useAvatarMemoryCapture } from '../hooks/useAvatarMemoryCapture';
import { useAvatarChatViewport } from '../hooks/useAvatarChatViewport';
import { buildAvatarMemoryReferences } from '../state/avatarMemoryReferences';
interface AvatarChatPageProps {
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  pastEntries: DiaryEntry[];
  principles?: Principle[];
  actions?: ActionItem[];
  future?: FutureState;
  onNavigateModule?: (module: 'past' | 'now' | 'future') => void;
  sending: boolean;
  mobileShell?: boolean;
  onBack: () => void;
  onRouteChange: (route: NowRoute) => void;
  onSend: (preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>;
  showToast: (message: string) => void;
  launchContext?: AvatarLaunchContext;
  onSelectEntry?: (entryId: string) => void;
}

export const AvatarChatPage: React.FC<AvatarChatPageProps> = (props) => {
  const { t } = useAvatarLanguage();
  const [graph, setGraph] = useState<AvatarOntologySnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void initializeAvatarOntology()
      .then(() => settleExpiredAvatarOntology())
      .then(
        (value) => {
          if (active) setGraph(value);
        },
        (reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : t('分身资料读取失败', 'Could not read avatar data.'),
            );
        },
      );
    return () => {
      active = false;
    };
  }, [t]);
  if (error) return <div role="alert">{error}</div>;
  if (!graph) return <div role="status">{t('正在核验分身资料…', 'Verifying avatar data…')}</div>;
  return <AvatarChatRuntime {...props} initialGraph={graph} />;
};

const AvatarChatRuntime: React.FC<
  AvatarChatPageProps & { initialGraph: AvatarOntologySnapshot }
> = ({
  initialGraph,
  draft,
  setDraft,
  pastEntries,
  principles = [],
  actions = [],
  future,
  onNavigateModule,
  sending,
  mobileShell = false,
  onBack,
  onRouteChange,
  onSend,
  showToast,
  launchContext = { mode: 'capture', source: 'now' },
  onSelectEntry,
}) => {
  const { language, t } = useAvatarLanguage();
  const [liveGraph, setLiveGraph] = useState(initialGraph);
  const privacyToken = aiPrivacyToken(pastEntries, future, actions, principles, liveGraph);
  const buildAssistantTextMessage = (...args: Parameters<typeof rawbuildAssistantTextMessage>) => ({
    ...rawbuildAssistantTextMessage(...args),
    aiPrivacyToken: privacyToken,
  });
  const buildUserTextMessage = (...args: Parameters<typeof rawbuildUserTextMessage>) => ({
    ...rawbuildUserTextMessage(...args),
    aiPrivacyToken: privacyToken,
  });
  const buildRecordPreviewMessage = (...args: Parameters<typeof rawbuildRecordPreviewMessage>) => ({
    ...rawbuildRecordPreviewMessage(...args),
    aiPrivacyToken: privacyToken,
  });
  const launchAllowed =
    !launchContext.entryId ||
    pastEntries.some((e) => e.id === launchContext.entryId && isAccessibleDiaryEntry(e));
  const [restoredSession] = useState(() => selectAvatarConversation(initialGraph, launchContext));
  const [sessionId] = useState(() => restoredSession?.id ?? generateSecureId('avatar-session'));
  const [sessionCreatedAt] = useState(() => restoredSession?.createdAt ?? Date.now());
  const [input, setInput] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [expandedScope, setExpandedScope] = useState(false);
  const [smallWindow, setSmallWindow] = useState(false);
  const [excludedSources, setExcludedSources] = useState<string[]>([]);
  const [libraryView, setLibraryView] = useState<'chat' | 'library'>('chat');
  const [chatError, setChatError] = useState('');
  const [reliabilityTask, setReliabilityTask] = useState<
    import('../state/avatarReliabilityTasks').AvatarReliabilityTask | null
  >(null);
  const chatController = useRef<AbortController | null>(null);
  const failedChat = useRef<ChatMessage[] | null>(null);
  useEffect(() => () => chatController.current?.abort(), [privacyToken]);
  const general = launchContext.mode === 'general';
  const refreshAvatarKnowledge = () => {
    void readAvatarOntology()
      .then(setLiveGraph)
      .catch(() => {
        chatController.current?.abort();
        setChatError(
          t('分身资料核验失败，请重新进入。', 'Avatar verification failed. Please reopen it.'),
        );
      });
  };
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      try {
        const graph = await readAvatarOntology();
        if (active && request === generation) setLiveGraph(graph);
      } catch {
        if (active && request === generation) {
          chatController.current?.abort();
          setChatError(
            t('分身资料核验失败，请重新进入。', 'Avatar verification failed. Please reopen it.'),
          );
        }
      }
    };
    const unsubscribe = subscribeVault(() => {
      void refresh();
    });
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [t]);
  const guidanceSources = buildGuidanceSources({
    entries: pastEntries,
    principles,
    actions,
    future,
    graph: liveGraph,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const chatListRef = useRef<HTMLElement>(null);
  const [followupRound, setFollowupRound] = useState(0);
  const [assistantTurns, setAssistantTurns] = useState(0);
  const [preview, setPreview] = useState<RecordPreviewPayload | null>(null);
  const [recallMemories, setRecallMemories] = useState<AvatarRecallMemory[]>(() => {
    const focusedEntry = launchContext.entryId
      ? pastEntries.find((entry) => entry.id === launchContext.entryId)
      : undefined;
    const seed = launchAllowed ? launchContext.query || launchContext.prompt || '' : '';
    const recalled = seed ? selectAvatarRecallMemories(pastEntries, seed) : [];
    if (!focusedEntry || !isAccessibleDiaryEntry(focusedEntry)) return recalled;
    return [
      entryToRecallMemory(focusedEntry),
      ...recalled.filter((memory) => memory.sourceEntryId !== focusedEntry.id),
    ];
  });
  const [understanding, setUnderstanding] = useState<CognitiveObject | null>(null);
  const [choosingCorrection, setChoosingCorrection] = useState(false);
  const correctionIds = useRef<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const lastPrivacyToken = useRef(privacyToken);
  useEffect(() => {
    if (lastPrivacyToken.current === privacyToken) return;
    lastPrivacyToken.current = privacyToken;
    failedChat.current = null;
    setPreview(null);
    setUnderstanding(null);
    setChoosingCorrection(false);
    correctionIds.current = [];
    setChatError(
      t(
        '记录权限已变化，历史对话保留在本机，后续回答将使用新的授权范围。',
        'Record permissions changed. Local chat history is retained; future replies use the new permissions.',
      ),
    );
  }, [privacyToken, t]);
  const [storedMessages, setMessages] = useState<ChatMessage[]>(() => {
    const seed = launchAllowed ? launchContext.prompt || launchContext.query : undefined;
    if (launchContext.mode === 'general') {
      const history = restoredSession?.messages ?? [];
      return seed
        ? [
            ...history,
            buildUserTextMessage(seed, {
              id: generateSecureId('msg'),
              createdAt: new Date().toISOString(),
            }),
          ]
        : history;
    }
    const intro = getAvatarIntroMessages({
      isFirstVisit: readAndMarkAvatarIntroFirstVisit(),
      createdAt: new Date().toISOString(),
      createId: () => generateSecureId('msg'),
      mode: launchContext.mode,
      language,
    });
    if (!seed) return intro;
    const options = {
      id: generateSecureId('msg'),
      createdAt: new Date().toISOString(),
    };
    return launchContext.mode === 'review'
      ? [...intro, buildAssistantTextMessage(seed, options)]
      : [...intro, buildUserTextMessage(seed, options)];
  });
  const messages = useMemo(
    () => storedMessages.filter((m) => isAIMessageAllowed(m, pastEntries, privacyToken)),
    [storedMessages, pastEntries, privacyToken],
  );
  const userMessages = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);
  const chatViewport = useAvatarChatViewport(storedMessages, chatListRef);
  const validRecallMemories = useMemo(() => {
    const existingIds = new Set(
      pastEntries.filter((e) => isAccessibleDiaryEntry(e)).map((entry) => entry.id),
    );
    return recallMemories.filter((memory) => existingIds.has(memory.sourceEntryId));
  }, [pastEntries, recallMemories]);
  const liveInsight = useMemo(
    () => buildAvatarStructuredInsight(userMessages, validRecallMemories),
    [userMessages, validRecallMemories],
  );
  const references = useMemo<AvatarSourceReference[]>(
    () =>
      validRecallMemories.map((memory) => ({
        entryId: memory.sourceEntryId,
        title: memory.title,
        date: memory.createdAt,
        excerpt: memory.excerpt,
        reason: memory.reason,
      })),
    [validRecallMemories],
  );
  const [saveSession] = useState(createAvatarSessionWriter);
  const persistConversation = () =>
    saveSession({
      id: sessionId,
      mode: launchContext.mode,
      context: restoredSession?.context ?? launchContext,
      messages: storedMessages,
      references,
      createdAt: sessionCreatedAt,
      updatedAt: Date.now(),
    });
  // Vault refreshes recreate prop arrays. Save only semantic conversation changes,
  // otherwise each write triggers a refresh and queues another identical write.
  const conversationSnapshot = JSON.stringify({
    id: sessionId,
    mode: launchContext.mode,
    context: restoredSession?.context ?? launchContext,
    messages: storedMessages,
    references,
    createdAt: sessionCreatedAt,
  });
  useEffect(() => {
    const conversation = JSON.parse(conversationSnapshot) as Omit<
      import('../../avatar/types').AvatarSession,
      'updatedAt'
    >;
    if (!conversation.messages.some((message) => message.role === 'user')) return;
    let active = true;
    void saveSession({ ...conversation, updatedAt: Date.now() }).catch(() => {
      if (active)
        setChatError(t('聊天记录未能保存，请重试。', 'Could not save the chat. Please retry.'));
    });
    return () => {
      active = false;
    };
  }, [conversationSnapshot, t, saveSession]);
  const formUnderstanding = () => {
    void memoryCapture.generateCompanionSummary(storedMessages);
  };
  const continueRecall = () => {
    const query = input.trim();
    if (!query) {
      showToast(t('请输入想从过去查找的问题', 'Enter a question to search your past records.'));
      return;
    }
    setRecallMemories(selectAvatarRecallMemories(pastEntries, query));
    sendMessage();
  };
  const finish = async (
    conversationUserMessages = userMessages,
    conversationMessages = messages,
  ) => {
    if (conversationUserMessages.length === 0) {
      showToast(t('请先说说想记下什么', 'Tell me what you would like to record first.'));
      return;
    }
    const recordableMessages = getRecordableInformation(conversationUserMessages);
    if (recordableMessages.length === 0) {
      const question =
        (language === 'en'
          ? null
          : buildAdaptiveFollowup(conversationUserMessages, followupRound)) ??
        t('补充一件具体事实。', 'Please add one specific fact.');
      if (followupRound < CONFIG.MAX_FOLLOWUP_ROUNDS) setFollowupRound((value) => value + 1);
      setMessages((current) => [
        ...current,
        buildAssistantTextMessage(question, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
        }),
      ]);
      return;
    }
    const latestContent =
      conversationUserMessages[conversationUserMessages.length - 1]?.content ?? '';
    if (
      !wantsDirectRecord(latestContent) &&
      !isContentSufficient(conversationUserMessages) &&
      followupRound < CONFIG.MAX_FOLLOWUP_ROUNDS
    ) {
      const question =
        (language === 'en'
          ? null
          : buildAdaptiveFollowup(conversationUserMessages, followupRound)) ??
        (followupRound === 0
          ? t('补充事实和想法。', 'Please add the facts and your thoughts.')
          : t('补充感受。', 'How did you feel?'));
      setFollowupRound((value) => value + 1);
      setMessages((current) => [
        ...current,
        buildAssistantTextMessage(question, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
        }),
      ]);
      return;
    }
    setGenerating(true);
    try {
      const result = await summarizeAvatarMessages({
        messages: conversationMessages,
        record_time: draft.record_time,
        followup_round: followupRound,
      });
      if (
        result.can_summarize === false ||
        result.mood_tags.length === 0 ||
        result.event_tags.length === 0 ||
        !result.text.trim()
      ) {
        setMessages((current) => [
          ...current,
          buildAssistantTextMessage(
            result.followup_question ||
              result.reason ||
              t('补充一件具体事实。', 'Please add one specific fact.'),
            { id: generateSecureId('msg'), createdAt: new Date().toISOString() },
          ),
        ]);
        return;
      }
      if (
        !wantsDirectRecord(latestContent) &&
        result.followup_question &&
        followupRound < CONFIG.MAX_FOLLOWUP_ROUNDS
      ) {
        setFollowupRound((value) => value + 1);
        setMessages((current) => [
          ...current,
          buildAssistantTextMessage(result.followup_question!, {
            id: generateSecureId('msg'),
            createdAt: new Date().toISOString(),
          }),
        ]);
        return;
      }
      const payload = {
        text: result.text,
        mood_tags: result.mood_tags,
        event_tags: result.event_tags,
        record_time: draft.record_time,
        display_time: draft.display_time,
        is_sparse: result.is_sparse,
      };
      setPreview(payload);
      setMessages((current) => [
        ...current,
        buildRecordPreviewMessage(payload, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
        }),
      ]);
    } catch {
      showToast(t('整理失败，请重试', 'Could not organize this record. Please retry.'));
    } finally {
      setGenerating(false);
    }
  };
  const requestReply = async (conversation: ChatMessage[], expand = expandedScope) => {
    if (chatController.current) return;
    const controller = new AbortController();
    chatController.current = controller;
    setChatPending(true);
    setChatError('');
    failedChat.current = conversation;
    try {
      // A local statistics reply may already follow the question in the transcript.
      const lastUserIndex = conversation.findLastIndex((message) => message.role === 'user');
      const queryConversation = conversation.slice(0, lastUserIndex + 1);
      const { scopedQuestion: question } = resolveAvatarQueryScope(queryConversation);
      const plan = parseAvatarQueryPlan(question);
      const eligibleEntries = pastEntries.filter(
        (entry) =>
          isAccessibleDiaryEntry(entry) &&
          (!plan.range ||
            (entry.createdAt >= plan.range.start && entry.createdAt < plan.range.end)),
      );
      const intent = detectAvatarConversationIntent(question);
      const preferredEntryIds =
        (plan.kind === 'general_recall' || plan.kind === 'period_recall') &&
        ['unknown', 'advice', 'emotion'].includes(intent)
          ? await searchNeuralRelatedEntryIds(
              { title: '', content: question, tags: [] },
              eligibleEntries,
              3,
            ).catch(() => [])
          : [];
      const freshGraph = await settleExpiredAvatarOntology();
      if (controller.signal.aborted) return;
      if (aiPrivacyToken(pastEntries, future, actions, principles, freshGraph) !== privacyToken) {
        setLiveGraph(freshGraph);
        throw new Error('privacy_changed');
      }
      const diagnostics = { privacyCount: 0, expiryCount: 0 };
      const { sources: context, manifest } = retrieveAvatarGuidanceContext(
        queryConversation,
        buildGuidanceSources({
          entries: pastEntries,
          principles,
          actions,
          future,
          graph: freshGraph,
          diagnostics,
          includeExpiredHistory:
            resolveGuidanceBudget(question, { mode: launchContext.mode, expanded: expand })
              .scopeTier === 'expanded' && ['recall', 'review'].includes(launchContext.mode),
        }),
        launchContext,
        preferredEntryIds,
        { expanded: expand, smallWindow, excludedIds: excludedSources, ...diagnostics },
      );
      const metric = findAvatarEvidenceMetric(question, pastEntries);
      const modelConversation = metric
        ? [
            ...conversation,
            {
              id: 'verified-count',
              aiPrivacyToken: privacyToken,
              role: 'user' as const,
              type: 'text' as const,
              created_at: new Date().toISOString(),
              content: `已核验统计：${buildAvatarEvidenceMetricReply(metric)} 请只回答用户的分析或建议部分。不得改写统计数量、将记录数解释为实际发生次数，或将推测当作事实。`,
            },
          ]
        : conversation;
      const reply = await chatWithAvatar(modelConversation, context, controller.signal, {
        mode: launchContext.mode,
        expanded: manifest.scopeTier === 'expanded',
        smallWindow,
        excludedIds: excludedSources,
      });
      if (controller.signal.aborted) return;
      const replyReferences = context
        .flatMap((source) =>
          (source.evidence ?? []).map((evidence) => ({ evidence, reason: source.kind })),
        )
        .map(({ evidence, reason }) => {
          const entry = pastEntries.find(
            (candidate) => isAccessibleDiaryEntry(candidate) && candidate.id === evidence.entryId,
          );
          return entry
            ? {
                entryId: entry.id,
                title: entry.title,
                date: entry.createdAt,
                excerpt: evidence.text,
                reason,
              }
            : undefined;
        })
        .flatMap((reference) => (reference ? [reference] : []));
      const uniqueReplyReferences = Array.from(
        new Map(replyReferences.map((reference) => [reference.entryId, reference])).values(),
      );
      const sourceDates = uniqueReplyReferences
        .map((reference) => reference.date)
        .sort((a, b) => a - b);
      const assistantMessage = buildAssistantTextMessage(reply, {
        id: generateSecureId('msg'),
        createdAt: new Date().toISOString(),
        references: uniqueReplyReferences,
        modelAssistance: {
          sourceCount: context.length,
          manifest,
          ...(sourceDates.length
            ? {
                earliestSourceDate: sourceDates[0],
                latestSourceDate: sourceDates[sourceDates.length - 1],
              }
            : {}),
        },
      });
      setMessages((current) => [...current, assistantMessage]);
      setAssistantTurns((value) => value + 1);
      failedChat.current = null;
    } catch (error) {
      if (controller.signal.aborted) return;
      setChatError(modelError(error instanceof Error ? error.message : '', language));
    } finally {
      if (!controller.signal.aborted) setChatPending(false);
      chatController.current = null;
    }
  };
  const sendMessage = () => {
    const content = input.trim();
    if (!content || chatController.current) return;
    const userMessage = buildUserTextMessage(content, {
      id: generateSecureId('msg'),
      createdAt: new Date().toISOString(),
    });
    const activePatterns = liveGraph.objects.filter(
      (item) =>
        item.domain === 'my_understanding' &&
        item.status === 'confirmed' &&
        guidanceSources.some((s) => s.id === item.id),
    );
    const requestedReliabilityTask = general ? detectAvatarReliabilityTask(content) : null;
    const correcting =
      /(?:修正|修改|不认可|不认同|纠正|不符合).*(?:模式|理解)|(?:模式|理解).*(?:不对|错了|不符合)|(?:correct|edit|change|reject).*(?:pattern|understanding)/i.test(
        content,
      );
    let localAnswer: string | null = null;
    let localReferences: ChatMessage['references'];
    if (requestedReliabilityTask) {
      setReliabilityTask(requestedReliabilityTask);
      localAnswer = reliabilityReply(requestedReliabilityTask, language);
    } else if (correcting || choosingCorrection) {
      const { target, ordinal } = resolvePatternCorrection(
        content,
        activePatterns,
        choosingCorrection ? correctionIds.current : null,
      );
      if (target) {
        setUnderstanding(target);
        setChoosingCorrection(false);
        localAnswer = t(
          '请在弹窗中修正这条理解，或选择不认可。你的决定保存后会生效。',
          'Edit this understanding in the dialog or reject it. Your choice takes effect when saved.',
        );
      } else if (!activePatterns.length) {
        setChoosingCorrection(false);
        localAnswer = t(
          '目前还没有你认可的模式。继续告诉我具体经历、反应和结果；我会在分身档案中形成候选理解，并请你通过弹窗确认或修正。',
          'No confirmed patterns yet. Share specific experiences, reactions, and outcomes. Candidate understandings require your review.',
        );
      } else if (correcting || ordinal) {
        setChoosingCorrection(true);
        correctionIds.current = activePatterns.map((item) => item.id);
        localAnswer =
          t(
            '你想修正哪一条？请回复完整描述或下面的编号：\n',
            'Which pattern would you like to edit? Reply with the full statement or its number:\n',
          ) + activePatterns.map((item, i) => `${i + 1}. ${item.statement}`).join('\n');
      } else setChoosingCorrection(false);
    }
    const metric = language === 'zh' ? findAvatarEvidenceMetric(content, pastEntries) : null;
    if (metric) {
      localAnswer = buildAvatarEvidenceMetricReply(metric);
      localReferences = metric.matches.flatMap((match) => {
        const entry = pastEntries.find((candidate) => candidate.id === match.entryId);
        if (!entry) return [];
        return [
          {
            entryId: entry.id,
            title: entry.title || t('未命名记录', 'Untitled record'),
            date: entry.createdAt,
            excerpt: entry.content.replace(/\s+/g, ' ').trim().slice(0, 120),
            reason:
              match.reason === 'tag'
                ? t('明确标签', 'Explicit tag')
                : t('原文明确表达', 'Explicit statement in the record'),
          },
        ];
      });
    }
    if (detectAvatarRetrievalIntent(content) !== 'decision_support') {
      localAnswer ??= answerAvatarEvidence(
        content,
        liveGraph,
        principles.filter((p) => guidanceSources.some((s) => s.kind === '原则' && s.id === p.id)),
        pastEntries,
        language,
      );
    }
    if (language === 'zh') localAnswer ??= buildDeterministicEntryCountReply(content, pastEntries);
    if (localAnswer) {
      const answeredMessages = [
        ...messages,
        userMessage,
        buildAssistantTextMessage(localAnswer, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
          modelAssistance: {
            sourceCount: 0,
            manifest: {
              mode: launchContext.mode,
              scopeTier: 'local_deterministic',
              appliedLimit: 0,
              matchedCount: 0,
              filteredOutByPrivacyCount: 0,
              filteredOutByExpiryCount: 0,
              excludedByUserCount: 0,
              searchedTags: [],
              breakdown: { aboutMeCount: 0, understandingCount: 0, rawRecordCount: 0 },
              triggeredGuardrailIds: [],
              canExpandScope: false,
            },
          },
          ...(localReferences?.length ? { references: localReferences } : {}),
        }),
      ];
      setMessages((current) => [...current, ...answeredMessages.slice(-2)]);
      setInput('');
      if (
        metric &&
        general &&
        /(为什么|为何|怎么|建议|分析|总结|why|how|advice|analy[sz]e|summari[sz]e)/i.test(content)
      ) {
        void requestReply(answeredMessages);
      }
      return;
    }
    const nextRecallMemories = selectAvatarRecallMemories(pastEntries, content);
    const nextUserMessages = [...userMessages, userMessage];
    const nextMessages = [...messages, userMessage];
    const avatarName = general ? extractAvatarName(content) : null;
    const acknowledgement =
      general || language === 'en'
        ? null
        : buildCompanionAcknowledgement(nextUserMessages, assistantTurns, nextRecallMemories);
    if (avatarName) {
      memoryCapture.considerAvatarName(avatarName, nextMessages);
    }
    setRecallMemories(nextRecallMemories);
    setMessages((current) => {
      const next = [...current, userMessage];
      if (!acknowledgement) return next;
      return [
        ...next,
        buildAssistantTextMessage(acknowledgement, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
        }),
      ];
    });
    if (acknowledgement) setAssistantTurns((value) => value + 1);
    setInput('');
    if (general) void requestReply(nextMessages);
    if (!general && wantsDirectRecord(content)) void finish(nextUserMessages, nextMessages);
  };
  const memoryCapture = useAvatarMemoryCapture({
    draft,
    sessionId,
    avatarMemoryReferences: buildAvatarMemoryReferences(
      liveGraph.objects.filter((m) => guidanceSources.some((s) => s.id === m.id)),
    ).map((ref) => ({ ...ref, aiPrivacyToken: privacyToken })),
    showToast,
    refreshAvatarMemories: () => {
      void readAvatarOntology().then(setLiveGraph);
    },
    appendReviewMessage: (statement) => {
      const next = [
        ...storedMessages,
        buildUserTextMessage(statement, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
        }),
      ];
      setMessages(next);
      return next;
    },
    prepareExtraction: (sourceMessages) =>
      saveSession({
        id: sessionId,
        mode: launchContext.mode,
        context: restoredSession?.context ?? launchContext,
        messages: sourceMessages,
        references,
        createdAt: sessionCreatedAt,
        updatedAt: Date.now(),
      }),
  });

  const reviseMemory = async (object: CognitiveObject, statement: string) => {
    const message = buildUserTextMessage(statement, {
      id: generateSecureId('msg'),
      createdAt: new Date().toISOString(),
    });
    const next = [...storedMessages, message];
    setMessages(next);
    setLibraryView('chat');
    await memoryCapture.generateCompanionSummary(next, false, object);
  };

  return (
    <>
      {memoryCapture.dialog}
      {understanding && (
        <AvatarMemoryDetail
          key={understanding.id}
          memory={understanding}
          entries={pastEntries}
          onClose={() => setUnderstanding(null)}
          onSave={(_statement, status) => {
            if (status !== 'rejected') return;
            void reviewArchiveCognition(liveGraph, understanding, status, false)
              .then(() => {
                setUnderstanding(null);
                refreshAvatarKnowledge();
              })
              .catch((error) => showToast(error.message));
          }}
          onSupersede={(statement) => {
            void reviseMemory(understanding, statement)
              .then(() => setUnderstanding(null))
              .catch((error) => showToast(error.message));
          }}
        />
      )}
      <AvatarChatSurface
        sourceReview={
          libraryView === 'chat' && (
            <details className="avatar-message-references">
              <summary>{t('本次携带资料快检', 'Review request sources')}</summary>
              <p>
                {t(
                  '资料将发往当前配置的服务商，发出后中止无法撤回。取消勾选可从本次请求中剔除来源。',
                  'Data is sent to the configured provider. Aborting cannot retract data already sent. Uncheck a source to exclude it.',
                )}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={smallWindow}
                  onChange={(event) => setSmallWindow(event.target.checked)}
                />
                {t('小窗口模型：最多参考两条', 'Small context model: up to two sources')}
              </label>
              {retrieveAvatarGuidanceContext(
                [
                  ...messages,
                  ...(input.trim()
                    ? [
                        buildUserTextMessage(input, {
                          id: 'preview-query',
                          createdAt: new Date().toISOString(),
                        }),
                      ]
                    : []),
                ],
                buildGuidanceSources({
                  entries: pastEntries,
                  principles,
                  actions,
                  future,
                  graph: liveGraph,
                  includeExpiredHistory:
                    ['recall', 'review'].includes(launchContext.mode) &&
                    resolveGuidanceBudget(
                      input.trim() || resolveAvatarQueryScope(messages).scopedQuestion,
                      { mode: launchContext.mode, expanded: expandedScope },
                    ).scopeTier === 'expanded',
                }),
                launchContext,
                [],
                { expanded: expandedScope, smallWindow },
              ).sources.map((source) => (
                <label key={source.id} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={!excludedSources.includes(source.id)}
                    onChange={(event) =>
                      setExcludedSources((ids) =>
                        event.target.checked
                          ? ids.filter((id) => id !== source.id)
                          : [...ids, source.id],
                      )
                    }
                  />
                  {source.kind} · {source.text}
                </label>
              ))}
              <button
                type="button"
                disabled={!input.trim() || chatPending}
                onClick={sendMessage}
              >
                {t('确认资料并发送', 'Confirm sources and send')}
              </button>
              <button
                type="button"
                disabled={
                  launchContext.mode === 'capture' ||
                  chatPending ||
                  !messages.some((message) => message.role === 'user')
                }
                onClick={() => {
                  setExpandedScope(true);
                  void requestReply(messages, true);
                }}
              >
                {t('扩大范围重新参考', 'Expand scope and retry')}
              </button>
            </details>
          )
        }
        pastEntries={pastEntries}
        graph={liveGraph}
        onReviseMemory={reviseMemory}
        candidateSummary={memoryCapture.companionSummary}
        chatError={chatError}
        chatListRef={chatListRef}
        hiddenMessageCount={chatViewport.hiddenMessageCount}
        chatPending={chatPending}
        companionSaving={memoryCapture.memorySaving}
        general={general}
        generating={generating || memoryCapture.generatingMemory}
        input={input}
        inputRef={inputRef}
        launchContext={launchContext}
        focusedObjectText={getFocusText(guidanceSources, launchContext)}
        libraryView={libraryView}
        memoryFacets={
          memoryCapture.extractedFacets ??
          memoryCapture.inferMemoryFacets(
            memoryCapture.companionSummary ?? {
              text: '',
              mood_tags: [],
              event_tags: [],
              record_time: '',
              display_time: '',
              is_sparse: false,
            },
          )
        }
        memoryNature={memoryCapture.memoryNature}
        candidateKind={memoryCapture.candidateKind}
        candidateCategory={memoryCapture.candidateCategory}
        candidateSourceCount={memoryCapture.candidateSources.length}
        candidateSourceRefs={memoryCapture.candidateSources}
        candidatePosition={memoryCapture.candidatePosition}
        candidateTotal={memoryCapture.candidateTotal}
        draft={draft}
        replacementStatement={memoryCapture.replacementStatement}
        visibleMessages={chatViewport.visibleMessages}
        mobileShell={mobileShell}
        onAddMemory={() => {
          setLibraryView('chat');
          inputRef.current?.focus();
          memoryCapture.addMemory();
        }}
        onBack={onBack}
        onChangeInput={setInput}
        onConfirmMemory={memoryCapture.confirmMemory}
        onDismissMemory={memoryCapture.dismissMemory}
        onEditTags={() => {
          if (preview)
            setDraft((current) => ({
              ...current,
              mood_tags: preview.mood_tags,
              event_tags: preview.event_tags,
            }));
          onRouteChange('tags');
        }}
        onGenerateMemory={() => {
          void persistConversation()
            .then(() => memoryCapture.generateCompanionSummary(storedMessages))
            .catch(() =>
              setChatError(
                t(
                  '请先成功保存会话，再提炼认知。',
                  'Save the conversation before extracting cognition.',
                ),
              ),
            );
        }}
        onMemoryTextChange={(text) =>
          memoryCapture.companionSummary &&
          memoryCapture.setCompanionSummary({ ...memoryCapture.companionSummary, text })
        }
        onSetLibraryView={setLibraryView}
        onOpenSettings={() => onRouteChange('avatar-settings')}
        onOpenFuture={() => onNavigateModule?.('future')}
        onShowEarlierMessages={chatViewport.showEarlier}
        onJumpToLatest={chatViewport.jumpToLatest}
        onRefreshKnowledge={refreshAvatarKnowledge}
        onRetry={() => {
          if (failedChat.current) void requestReply(failedChat.current);
        }}
        onSelectEntry={onSelectEntry}
        onSend={sendMessage}
        onSendPreview={(payload) => void onSend(payload, sessionId)}
        onSetPreview={setPreview}
        onSubmitModeAction={() => {
          if (launchContext.mode === 'capture') void finish();
          else if (launchContext.mode === 'recall') continueRecall();
          else formUnderstanding();
        }}
        preview={preview}
        sending={sending}
        setChatError={setChatError}
        showToast={showToast}
        showJumpToLatest={chatViewport.showJumpToLatest}
        userMessageCount={userMessages.length}
        validRecallMemories={validRecallMemories}
        liveInsight={liveInsight}
        reliabilityTask={reliabilityTask}
        onOpenDraft={() => onNavigateModule?.('now')}
      />
    </>
  );
};
