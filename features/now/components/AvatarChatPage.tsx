import { selectAvatarGuidanceContext } from '../state/avatarGuidanceContext';
import { PatternReviewDialog } from '../../../components/PatternReviewDialog';
import {
  answerAvatarEvidence,
  resolvePatternCorrection,
} from '../../../services/avatarEvidenceDialogue';
import { resolveAvatarKnowledge } from '../../../services/avatarKnowledgeProjection';
import { modelError } from '../api/avatarModel';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionItem, DiaryEntry, Principle } from '../../../types';
import type { FutureState } from '../../../types/future';
import { buildGuidanceSources, extractAvatarName } from '../../../services/avatarGuidance';
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
  buildAssistantTextMessage,
  buildRecordPreviewMessage,
  buildUserTextMessage,
  getAvatarIntroMessages,
  readAndMarkAvatarIntroFirstVisit,
} from '../state/avatarChatRules';
import type { ChatMessage, NowDraft, NowRoute, RecordPreviewPayload } from '../types/now';
import type {
  AvatarLaunchContext,
  AvatarSourceReference,
  AvatarUnderstandingStatus,
} from '../../avatar/types';
import {
  atomicMemoryFromUnderstanding,
  isPatternMemoryReadyForConfirmation,
  readAvatarAtomicMemories,
  readAvatarConversation,
  readAvatarMemoryRelations,
  readAvatarUnderstandings,
  writeAvatarSession,
  writeAvatarUnderstanding,
} from '../../../services/avatarMemory';
import { subscribeVault } from '../../../services/vaultTransaction';

import { AvatarChatSurface } from './AvatarChatSurface';
import { useAvatarMemoryCapture } from '../hooks/useAvatarMemoryCapture';
import { useAvatarChatViewport } from '../hooks/useAvatarChatViewport';

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

export const AvatarChatPage: React.FC<AvatarChatPageProps> = ({
  draft,
  setDraft,
  pastEntries,
  principles = [],
  actions = [],
  future,
  sending,
  mobileShell = false,
  onBack,
  onRouteChange,
  onSend,
  showToast,
  launchContext = { mode: 'capture', source: 'now' },
  onSelectEntry,
}) => {
  const [restoredSession] = useState(() => readAvatarConversation(launchContext));
  const [sessionId] = useState(() => restoredSession?.id ?? generateSecureId('avatar-session'));
  const [sessionCreatedAt] = useState(() => restoredSession?.createdAt ?? Date.now());
  const [input, setInput] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatController = useRef<AbortController | null>(null);
  const failedChat = useRef<ChatMessage[] | null>(null);
  useEffect(() => () => chatController.current?.abort(), []);

  const general = launchContext.mode === 'general';
  const [patterns, setPatterns] = useState(readAvatarUnderstandings);
  const [storedAvatarMemories, setAvatarMemories] = useState(readAvatarAtomicMemories);
  const refreshAvatarKnowledge = () => {
    setPatterns(readAvatarUnderstandings());
    setAvatarMemories(readAvatarAtomicMemories());
  };
  useEffect(() => {
    const unsubscribe = subscribeVault(refreshAvatarKnowledge);
    window.addEventListener('focus', refreshAvatarKnowledge);
    window.addEventListener('storage', refreshAvatarKnowledge);
    refreshAvatarKnowledge();
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshAvatarKnowledge);
      window.removeEventListener('storage', refreshAvatarKnowledge);
    };
  }, [pastEntries]);
  const { memories: avatarMemories } = resolveAvatarKnowledge({
    memories: storedAvatarMemories,
    principles,
    actions,
    future,
    patterns,
    entries: pastEntries,
    relations: readAvatarMemoryRelations(),
  });
  const guidanceSources = buildGuidanceSources({
    entries: pastEntries,
    patterns,
    principles,
    actions,
    future,
    avatarMemories,
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
    const seed = launchContext.query || launchContext.prompt || '';
    const recalled = seed ? selectAvatarRecallMemories(pastEntries, seed) : [];
    if (!focusedEntry) return recalled;
    return [
      entryToRecallMemory(focusedEntry),
      ...recalled.filter((memory) => memory.sourceEntryId !== focusedEntry.id),
    ];
  });
  const [understanding, setUnderstanding] = useState<{
    id: string;
    statement: string;
    status: AvatarUnderstandingStatus;
  } | null>(null);
  const [choosingCorrection, setChoosingCorrection] = useState(false);
  const correctionIds = useRef<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const seed = launchContext.prompt || launchContext.query;
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

  const userMessages = useMemo(
    () => messages.filter((message) => message.role === 'user'),
    [messages],
  );
  const chatViewport = useAvatarChatViewport(messages, chatListRef);
  const validRecallMemories = useMemo(() => {
    const existingIds = new Set(pastEntries.map((entry) => entry.id));
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

  useEffect(() => {
    if (!messages.some((message) => message.role === 'user')) return;
    const saved = writeAvatarSession({
      id: sessionId,
      mode: launchContext.mode,
      context: launchContext,
      messages,
      references,
      createdAt: sessionCreatedAt,
      updatedAt: Date.now(),
    });
    if (!saved) setChatError('聊天记录未能保存，请检查浏览器存储空间后重试。');
  }, [launchContext, messages, references, sessionCreatedAt, sessionId]);

  const formUnderstanding = () => {
    const statement =
      liveInsight.thought || liveInsight.result || liveInsight.action || liveInsight.fact;
    if (!statement) {
      showToast('请先补充一个具体事实或想法');
      return;
    }
    const next = { id: generateSecureId('understanding'), statement, status: 'pending' as const };
    const saved = writeAvatarUnderstanding({
      ...next,
      sourceEntryIds: liveInsight.evidenceEntryIds,
      createdAt: Date.now(),
    });
    if (saved) setUnderstanding(next);
    else showToast('提炼尚未保存，请重试');
  };

  const continueRecall = () => {
    const query = input.trim();
    if (!query) {
      showToast('请输入想从过去查找的问题');
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
      showToast('请先说说想记下什么');
      return;
    }
    const recordableMessages = getRecordableInformation(conversationUserMessages);
    if (recordableMessages.length === 0) {
      const question =
        buildAdaptiveFollowup(conversationUserMessages, followupRound) ?? '补充一件具体事实。';
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
        buildAdaptiveFollowup(conversationUserMessages, followupRound) ??
        (followupRound === 0 ? '补充事实和想法。' : '补充感受。');
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
            result.followup_question || result.reason || '补充一件具体事实。',
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
      showToast('整理失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const requestReply = async (conversation: ChatMessage[]) => {
    if (chatController.current) return;
    const controller = new AbortController();
    chatController.current = controller;
    setChatPending(true);
    setChatError('');
    failedChat.current = conversation;
    try {
      const context = selectAvatarGuidanceContext(conversation, guidanceSources);
      const reply = await chatWithAvatar(conversation, context, controller.signal);
      if (controller.signal.aborted) return;
      const assistantMessage = buildAssistantTextMessage(reply, {
        id: generateSecureId('msg'),
        createdAt: new Date().toISOString(),
      });
      setMessages((current) => [...current, assistantMessage]);
      setAssistantTurns((value) => value + 1);
      failedChat.current = null;
    } catch (error) {
      if (controller.signal.aborted) return;
      setChatError(modelError(error instanceof Error ? error.message : ''));
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
    const activePatterns = readAvatarUnderstandings().filter((item) => item.status === 'confirmed');
    const correcting =
      /(?:修正|修改|不认可|不认同|纠正|不符合).*(?:模式|理解)|(?:模式|理解).*(?:不对|错了|不符合)/.test(
        content,
      );
    let localAnswer: string | null = null;
    if (correcting || choosingCorrection) {
      const { target, ordinal } = resolvePatternCorrection(
        content,
        activePatterns,
        choosingCorrection ? correctionIds.current : null,
      );
      if (target) {
        setUnderstanding(target);
        setChoosingCorrection(false);
        localAnswer = '请在弹窗中修正这条理解，或选择不认可。你的决定保存后会生效。';
      } else if (!activePatterns.length) {
        setChoosingCorrection(false);
        localAnswer =
          '目前还没有你认可的模式。继续告诉我具体经历、反应和结果；我会在分身档案中形成候选理解，并请你通过弹窗确认或修正。';
      } else if (correcting || ordinal) {
        setChoosingCorrection(true);
        correctionIds.current = activePatterns.map((item) => item.id);
        localAnswer =
          '你想修正哪一条？请回复完整描述或下面的编号：\n' +
          activePatterns.map((item, i) => `${i + 1}. ${item.statement}`).join('\n');
      } else setChoosingCorrection(false);
    }
    localAnswer ??= answerAvatarEvidence(
      content,
      readAvatarUnderstandings(),
      principles,
      pastEntries,
    );
    if (localAnswer) {
      setMessages((current) => [
        ...current,
        userMessage,
        buildAssistantTextMessage(localAnswer, {
          id: generateSecureId('msg'),
          createdAt: new Date().toISOString(),
        }),
      ]);
      setInput('');
      return;
    }
    const nextRecallMemories = selectAvatarRecallMemories(pastEntries, content);
    const nextUserMessages = [...userMessages, userMessage];
    const nextMessages = [...messages, userMessage];
    const avatarName = general ? extractAvatarName(content) : null;
    const acknowledgement = general
      ? null
      : buildCompanionAcknowledgement(nextUserMessages, assistantTurns, nextRecallMemories);
    if (avatarName) {
      memoryCapture.considerAvatarName(avatarName, userMessage);
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
    avatarMemoryReferences: avatarMemories.flatMap((memory) => {
      if (
        memory.status !== 'candidate' &&
        memory.status !== 'confirmed' &&
        memory.status !== 'retained'
      )
        return [];
      return [
        {
          id: memory.id,
          text: memory.statement,
          status: memory.status,
          ...(memory.patternKey ? { patternKey: memory.patternKey } : {}),
          ...(memory.category ? { category: memory.category } : {}),
        },
      ];
    }),
    onSend,
    showToast,
    refreshAvatarMemories: () => setAvatarMemories(readAvatarAtomicMemories()),
  });

  return (
    <>
      {understanding && (
        <PatternReviewDialog
          key={understanding.id}
          pattern={understanding}
          onDefer={() => setUnderstanding(null)}
          onDone={() => {
            setUnderstanding(null);
            refreshAvatarKnowledge();
            showToast('已保存你的判断');
          }}
        />
      )}
      <AvatarChatSurface
        avatarMemories={avatarMemories}
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
        libraryOpen={libraryOpen}
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
        candidatePosition={memoryCapture.candidatePosition}
        candidateTotal={memoryCapture.candidateTotal}
        replacementStatement={memoryCapture.replacementStatement}
        visibleMessages={chatViewport.visibleMessages}
        mobileShell={mobileShell}
        modelSettingsOpen={modelSettingsOpen}
        onAddMemory={memoryCapture.addMemory}
        onBack={onBack}
        onChangeInput={setInput}
        onCloseModelSettings={() => setModelSettingsOpen(false)}
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
        onGenerateMemory={() => void memoryCapture.generateCompanionSummary(messages)}
        onMemoryTextChange={(text) =>
          memoryCapture.companionSummary &&
          memoryCapture.setCompanionSummary({ ...memoryCapture.companionSummary, text })
        }
        onOpenLibrary={setLibraryOpen}
        onOpenModelSettings={() => setModelSettingsOpen(true)}
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
        patterns={patterns}
        pendingMemories={[
          ...patterns
            .filter((pattern) => pattern.status === 'pending')
            .map(atomicMemoryFromUnderstanding),
          ...storedAvatarMemories.filter(isPatternMemoryReadyForConfirmation),
        ]}
        preview={preview}
        sending={sending}
        setChatError={setChatError}
        showToast={showToast}
        showJumpToLatest={chatViewport.showJumpToLatest}
        storedAvatarMemories={storedAvatarMemories}
        userMessageCount={userMessages.length}
        validRecallMemories={validRecallMemories}
        liveInsight={liveInsight}
      />
    </>
  );
};
