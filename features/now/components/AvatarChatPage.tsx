import React, { useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { DiaryEntry } from '../../../types';
import { generateSecureId } from '../../../services/idGenerator';
import { CONFIG } from '../constants/config';
import { summarizeAvatarMessages } from '../api/avatar';
import {
  AvatarInsightPanel,
  AvatarRecallPanel,
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
}) => {
  const sessionId = useMemo(() => generateSecureId('avatar-session'), []);
  const [input, setInput] = useState('');
  const [followupRound, setFollowupRound] = useState(0);
  const [assistantTurns, setAssistantTurns] = useState(0);
  const [preview, setPreview] = useState<RecordPreviewPayload | null>(null);
  const [recallMemories, setRecallMemories] = useState<AvatarRecallMemory[]>([]);
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getAvatarIntroMessages({
      isFirstVisit: readAndMarkAvatarIntroFirstVisit(),
      createdAt: new Date().toISOString(),
      createId: () => generateSecureId('msg'),
    }),
  );

  const userMessages = messages.filter((message) => message.role === 'user');
  const liveInsight = useMemo(() => buildAvatarStructuredInsight(userMessages), [userMessages]);

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
        <div className="now-time">{mobileShell ? '记录协助' : '分身记录'}</div>
        {!mobileShell ? (
          <button type="button" className="now-icon-button" onClick={onBack} aria-label="关闭">
            <X size={20} />
          </button>
        ) : (
          <span className="now-header__badge">协助</span>
        )}
      </header>
      <section className="now-chat-list">
        {userMessages.length > 0 && <AvatarInsightPanel insight={liveInsight} />}
        {recallMemories.length > 0 && <AvatarRecallPanel memories={recallMemories} />}
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
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          placeholder="输入想记录的内容"
        />
        <button type="button" onClick={sendMessage}>
          发送
        </button>
        <button type="button" onClick={() => void finish()} disabled={generating}>
          记录完毕
        </button>
      </footer>
    </main>
  );
};
