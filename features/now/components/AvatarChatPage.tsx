import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageCircleMore, Palette, X } from 'lucide-react';
import type { DiaryEntry } from '../../../types';
import { generateSecureId } from '../../../services/idGenerator';
import { CONFIG } from '../constants/config';
import { summarizeAvatarMessages } from '../api/avatar';
import {
  AvatarInsightPanel,
  AvatarRecallPanel,
  AvatarUnderstandingCard,
  RecordPreviewCard,
} from './AvatarRecordPanels';
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
  readAvatarSession,
  writeAvatarSession,
  writeAvatarUnderstanding,
} from '../../../services/avatarMemory';
import { buildAvatarProactiveInvitation } from '../../avatar/proactiveInvitation';
import { AvatarAppearanceStudio, AvatarGlyph } from '../../avatar/AvatarAppearanceStudio';
import type { AvatarAppearance } from '../../avatar/appearance';
import { readAvatarAppearance, writeAvatarAppearance } from '../../../services/avatarAppearance';

const MODE_COPY = {
  capture: {
    title: '帮我记录',
    description: '把当下表达整理成一条可确认的记录。',
    placeholder: '输入想记录的内容',
    action: '记录完毕',
  },
  distill: {
    title: '帮我整理',
    description: '从这条经历中分清事实、感受与可复用经验。',
    placeholder: '你想重点整理什么？',
    action: '形成候选理解',
  },
  recall: {
    title: '问问过去',
    description: '用可追溯的记录回答，不替你下结论。',
    placeholder: '想从过去查找什么？',
    action: '继续检索',
  },
  decide: {
    title: '帮我分析',
    description: '结合过去经历，提供第二视角与可验证的下一步。',
    placeholder: '补充你的限制或犹豫',
    action: '形成候选理解',
  },
  review: {
    title: '回顾结果',
    description: '对照原行动与真实结果，更新你的经验。',
    placeholder: '实际发生了什么？',
    action: '形成候选理解',
  },
  general: {
    title: '问 VECTOR',
    description: '你的跨模块助手与第二视角，长期理解只在你确认后更新。',
    placeholder: '你想讨论什么？',
    action: '形成候选理解',
  },
} as const;

const referenceToRecallMemory = (reference: AvatarSourceReference): AvatarRecallMemory => ({
  id: `avatar-reference-${reference.entryId}`,
  sourceEntryId: reference.entryId,
  title: reference.title,
  excerpt: reference.excerpt,
  tags: [],
  score: 1,
  createdAt: reference.date,
  reason: reference.reason,
});

const entryToRecallMemory = (entry: DiaryEntry): AvatarRecallMemory => ({
  id: `avatar-entry-${entry.id}`,
  sourceEntryId: entry.id,
  title: entry.title,
  excerpt: entry.content.replace(/\s+/g, ' ').trim().slice(0, 120),
  tags: entry.tags ?? [],
  score: 1,
  createdAt: entry.createdAt,
  reason: '你正在整理的原始记录',
});

interface AvatarChatPageProps {
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  pastEntries: DiaryEntry[];
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
  sending,
  mobileShell = false,
  onBack,
  onRouteChange,
  onSend,
  showToast,
  launchContext = { mode: 'capture', source: 'now' },
  onSelectEntry,
}) => {
  const restoredSession = useMemo(() => readAvatarSession(launchContext), [launchContext]);
  const sessionId = useMemo(
    () => restoredSession?.id ?? generateSecureId('avatar-session'),
    [restoredSession],
  );
  const modeCopy = MODE_COPY[launchContext.mode];
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [followupRound, setFollowupRound] = useState(0);
  const [assistantTurns, setAssistantTurns] = useState(0);
  const [preview, setPreview] = useState<RecordPreviewPayload | null>(null);
  const [recallMemories, setRecallMemories] = useState<AvatarRecallMemory[]>(() => {
    if (restoredSession?.references.length) {
      return restoredSession.references.map(referenceToRecallMemory);
    }
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
  const [generating, setGenerating] = useState(false);
  const [appearance, setAppearance] = useState<AvatarAppearance>(() => readAvatarAppearance());
  const [appearanceDraft, setAppearanceDraft] = useState<AvatarAppearance>(() =>
    readAvatarAppearance(),
  );
  const [customizingAppearance, setCustomizingAppearance] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (restoredSession) return restoredSession.messages;
    const intro = getAvatarIntroMessages({
      isFirstVisit: readAndMarkAvatarIntroFirstVisit(),
      createdAt: new Date().toISOString(),
      createId: () => generateSecureId('msg'),
      mode: launchContext.mode,
    });
    const seed = launchContext.prompt || launchContext.query;
    if (!seed) return intro;
    const options = {
      id: generateSecureId('msg'),
      createdAt: new Date().toISOString(),
    };
    return launchContext.mode === 'review'
      ? [...intro, buildAssistantTextMessage(seed, options)]
      : [...intro, buildUserTextMessage(seed, options)];
  });

  const userMessages = messages.filter((message) => message.role === 'user');
  const liveInsight = useMemo(() => buildAvatarStructuredInsight(userMessages), [userMessages]);
  const references = useMemo<AvatarSourceReference[]>(
    () =>
      recallMemories.map((memory) => ({
        entryId: memory.sourceEntryId,
        title: memory.title,
        date: memory.createdAt,
        excerpt: memory.excerpt,
        reason: memory.reason,
      })),
    [recallMemories],
  );
  const proactiveInvitation = useMemo(
    () => buildAvatarProactiveInvitation(pastEntries),
    [pastEntries],
  );

  const chooseConversationStarter = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const openAppearanceStudio = () => {
    setAppearanceDraft(appearance);
    setCustomizingAppearance(true);
  };

  const cancelAppearanceStudio = () => {
    setAppearanceDraft(appearance);
    setCustomizingAppearance(false);
  };

  const saveAppearance = () => {
    const next = { ...appearanceDraft, name: appearanceDraft.name.trim() };
    if (!writeAvatarAppearance(next)) {
      showToast('保存失败，请重试');
      return;
    }
    setAppearance(next);
    setAppearanceDraft(next);
    setCustomizingAppearance(false);
    showToast('专属分身形象已保存到本机');
  };

  useEffect(() => {
    writeAvatarSession({
      id: sessionId,
      mode: launchContext.mode,
      context: launchContext,
      messages,
      references,
      createdAt: restoredSession?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  }, [launchContext, messages, references, restoredSession?.createdAt, sessionId]);

  const formUnderstanding = () => {
    const statement =
      liveInsight.thought || liveInsight.result || liveInsight.action || liveInsight.fact;
    if (!statement) {
      showToast('请先补充一个具体事实或想法');
      return;
    }
    const next = { id: generateSecureId('understanding'), statement, status: 'pending' as const };
    setUnderstanding(next);
    writeAvatarUnderstanding({
      ...next,
      sourceEntryIds: references.map((item) => item.entryId),
      createdAt: Date.now(),
    });
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

  const resolveUnderstanding = (status: 'confirmed' | 'rejected', statement: string) => {
    if (!understanding) return;
    const next = { ...understanding, statement, status };
    setUnderstanding(next);
    writeAvatarUnderstanding({
      id: next.id,
      statement,
      status,
      sourceEntryIds: references.map((item) => item.entryId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    showToast(status === 'confirmed' ? '已经你确认，写入长期理解' : '已标记为不准确');
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
        buildAdaptiveFollowup(conversationUserMessages, followupRound) ??
        '这些内容还不足以整理成记录。请至少说清一件具体事实，或先返回手动记录。';
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
        (followupRound === 0
          ? '能具体说说是哪件事吗？当时你怎么想的？'
          : '这件事你现在的感受是什么？');
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
              '信息还不够具体，我不能替你随意生成记录或标签。请补充一件具体事实。',
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

  const sendMessage = () => {
    const content = input.trim();
    if (!content) return;
    const userMessage = buildUserTextMessage(content, {
      id: generateSecureId('msg'),
      createdAt: new Date().toISOString(),
    });
    const nextRecallMemories = selectAvatarRecallMemories(pastEntries, content);
    const nextUserMessages = [...userMessages, userMessage];
    const nextMessages = [...messages, userMessage];
    const acknowledgement = buildCompanionAcknowledgement(
      nextUserMessages,
      assistantTurns,
      nextRecallMemories,
    );
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
    if (wantsDirectRecord(content)) void finish(nextUserMessages, nextMessages);
  };

  return (
    <main className="now-page now-chat-page" data-testid="avatar-assist-page">
      <header className="now-header">
        <button type="button" className="now-icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div className="now-time">
          {mobileShell && launchContext.mode === 'capture' ? '记录协助' : modeCopy.title}
        </div>
        {launchContext.mode === 'general' ? (
          <button
            type="button"
            className="now-avatar-customize"
            onClick={openAppearanceStudio}
            aria-label="定制分身形象"
          >
            <Palette size={17} aria-hidden="true" />
            <span>定制形象</span>
          </button>
        ) : !mobileShell ? (
          <button type="button" className="now-icon-button" onClick={onBack} aria-label="关闭">
            <X size={20} />
          </button>
        ) : (
          <span className="now-header__badge">协助</span>
        )}
      </header>
      <section className="now-avatar-mode-intro">
        {launchContext.mode === 'general' && <AvatarGlyph appearance={appearance} />}
        <div>
          <span>
            {launchContext.mode === 'general' ? appearance.name : 'VECTOR'} ·{' '}
            {launchContext.mode.toUpperCase()}
          </span>
          <p>{modeCopy.description}</p>
        </div>
      </section>
      {launchContext.mode === 'general' && customizingAppearance ? (
        <AvatarAppearanceStudio
          value={appearanceDraft}
          onChange={setAppearanceDraft}
          onSave={saveAppearance}
          onCancel={cancelAppearanceStudio}
        />
      ) : (
        launchContext.mode === 'general' &&
        userMessages.length === 0 && (
          <section className="now-avatar-invitation" aria-labelledby="avatar-invitation-title">
            <AvatarGlyph appearance={appearance} />
            <div className="now-avatar-invitation__copy">
              <span>{proactiveInvitation.eyebrow}</span>
              <h2 id="avatar-invitation-title">{proactiveInvitation.title}</h2>
              <p>{proactiveInvitation.context}</p>
            </div>
            <div className="now-avatar-invitation__starters" aria-label="选择一个开聊方向">
              {proactiveInvitation.prompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => chooseConversationStarter(prompt)}
                >
                  <MessageCircleMore size={16} aria-hidden="true" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
            <div className="now-avatar-invitation__foot">
              <span>点击只会放入输入框，不会自动发送</span>
              {proactiveInvitation.sourceEntryId && onSelectEntry && (
                <button
                  type="button"
                  onClick={() => onSelectEntry(proactiveInvitation.sourceEntryId!)}
                >
                  查看来源记录
                </button>
              )}
            </div>
          </section>
        )
      )}
      <section className="now-chat-list">
        {userMessages.length > 0 && <AvatarInsightPanel insight={liveInsight} />}
        {recallMemories.length > 0 && (
          <AvatarRecallPanel memories={recallMemories} onSelectEntry={onSelectEntry} />
        )}
        {understanding && (
          <AvatarUnderstandingCard
            statement={understanding.statement}
            status={understanding.status}
            onResolve={resolveUnderstanding}
          />
        )}
        {messages.map((message) =>
          message.type === 'record_preview' && message.payload ? (
            <RecordPreviewCard
              key={message.id}
              payload={message.payload}
              sending={sending}
              onChange={setPreview}
              onEditTags={() => {
                if (preview) {
                  setDraft((current) => ({
                    ...current,
                    mood_tags: preview.mood_tags,
                    event_tags: preview.event_tags,
                  }));
                }
                onRouteChange('tags');
              }}
              onSend={() => void onSend(preview ?? message.payload!, sessionId)}
            />
          ) : (
            <div
              key={message.id}
              className={`now-chat-bubble ${message.role === 'user' ? 'is-user' : ''}`}
            >
              {message.content}
            </div>
          ),
        )}
        {generating && <div className="now-chat-bubble">正在整理…</div>}
      </section>
      <footer className="now-chat-input">
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          placeholder={modeCopy.placeholder}
        />
        <button type="button" onClick={sendMessage}>
          发送
        </button>
        <button
          type="button"
          onClick={() => {
            if (launchContext.mode === 'capture') void finish();
            else if (launchContext.mode === 'recall') continueRecall();
            else formUnderstanding();
          }}
          disabled={generating}
        >
          {modeCopy.action}
        </button>
      </footer>
    </main>
  );
};
