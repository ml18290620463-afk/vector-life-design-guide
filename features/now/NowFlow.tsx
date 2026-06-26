import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUp, Bot, Image, Link as LinkIcon, Mic, Paperclip, Plus, Trash2, Video, X } from 'lucide-react';
import type { DiaryEntry, Language, Theme } from '../../types';
import { CONFIG, STORAGE_KEYS } from './constants/config';
import { EVENT_TAGS, MOOD_TAGS, TAG_SLOGAN } from './constants/tags';
import { postRecord } from './api/records';
import { summarizeAvatarMessages } from './api/avatar';
import { useMaterialPicker } from './hooks/useMaterialPicker';
import { useNowDraft } from './hooks/useNowDraft';
import { useToast } from './hooks/useToast';
import { useVoiceInput } from './hooks/useVoiceInput';
import {
  buildRecordFromDraft,
  buildAdaptiveFollowup,
  createEmptyDraft,
  getCanSend,
  getDisabledSendReason,
  getRecordableInformation,
  isContentSufficient,
  isDraftEmpty,
  validateMaterials,
  validateTags,
} from './state/nowRules';
import type { ChatMessage, Material, NowDraft, NowRecord, NowRoute, RecordPreviewPayload } from './types/now';

interface NowFlowProps {
  route: NowRoute;
  theme: Theme;
  language: Language;
  onRouteChange: (route: NowRoute) => void;
  onExit: () => void;
  onPersistRecord: (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>) => Promise<string>;
}

const makeId = (prefix = 'now') =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getCustomAnchors = (): string[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.customAnchors) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const recordToEntry = (record: Omit<NowRecord, 'id' | 'sync_status'>): Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'> => {
  const materialLines = record.materials.map((material) => `- ${material.type}: ${material.meta?.title || material.local_path || material.url || '本地素材'}`);
  const content = [record.text, materialLines.length ? `\n素材:\n${materialLines.join('\n')}` : '']
    .filter(Boolean)
    .join('\n');
  return {
    title: record.display_time,
    content,
    tags: [...record.mood_tags.map((tag) => `心情:${tag}`), ...record.event_tags.map((tag) => `事件:${tag}`)],
    updatedAt: Date.now(),
  };
};

export const NowFlow: React.FC<NowFlowProps> = ({
  route,
  theme,
  language: _language,
  onRouteChange,
  onExit,
  onPersistRecord,
}) => {
  const { draft, setDraft, saveDraft, discardDraft, resetAfterSend } = useNowDraft();
  const { toastMessage, showToast } = useToast();
  const [sending, setSending] = useState(false);
  const isLight = theme === 'light';

  const submitRecord = async (source: NowRecord['source'], overrideDraft = draft, avatarSessionId: string | null = null) => {
    const tagValidation = validateTags(overrideDraft.mood_tags, overrideDraft.event_tags, getCustomAnchors());
    const materialValidation = validateMaterials(overrideDraft.materials);
    if (tagValidation.ok === false) {
      showToast(tagValidation.message);
      return false;
    }
    if (materialValidation.ok === false) {
      showToast(materialValidation.message);
      return false;
    }
    const reason = getDisabledSendReason(overrideDraft);
    if (reason) {
      showToast(reason);
      return false;
    }
    setSending(true);
    const record = buildRecordFromDraft(overrideDraft, source, avatarSessionId);
    try {
      await postRecord(record);
      await onPersistRecord(recordToEntry(record));
      showToast('已存入过去');
      resetAfterSend();
      onRouteChange('now');
      return true;
    } catch {
      if (CONFIG.ENABLE_OFFLINE_QUEUE) {
        const pending = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.pendingRecords) || '[]');
        window.localStorage.setItem(STORAGE_KEYS.pendingRecords, JSON.stringify([...pending, record]));
      }
      showToast('发送失败，请重试');
      return false;
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`now-shell ${isLight ? 'now-shell--light' : ''}`}>
      {route === 'now' && (
        <NowPage
          draft={draft}
          setDraft={setDraft}
          sending={sending}
          onSend={() => void submitRecord('manual')}
          onSaveDraft={saveDraft}
          onDiscardDraft={discardDraft}
          onExit={onExit}
          onRouteChange={onRouteChange}
          showToast={showToast}
        />
      )}
      {route === 'tags' && (
        <TagSelectPage
          draft={draft}
          setDraft={setDraft}
          onBack={() => onRouteChange('now')}
          showToast={showToast}
        />
      )}
      {route === 'avatar-chat' && (
        <AvatarChatPage
          draft={draft}
          setDraft={setDraft}
          sending={sending}
          onBack={() => onRouteChange('now')}
          onRouteChange={onRouteChange}
          onSend={(preview, sessionId) => {
            const next = {
              ...draft,
              text: preview.text,
              mood_tags: preview.mood_tags,
              event_tags: preview.event_tags,
              updated_at: new Date().toISOString(),
            };
            return submitRecord('avatar_assisted', next, sessionId);
          }}
          showToast={showToast}
        />
      )}
      {toastMessage && <div className="now-toast">{toastMessage}</div>}
    </div>
  );
};

interface NowPageProps {
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  sending: boolean;
  onSend: () => void;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
  onExit: () => void;
  onRouteChange: (route: NowRoute) => void;
  showToast: (message: string) => void;
}

const NowPage: React.FC<NowPageProps> = ({
  draft,
  setDraft,
  sending,
  onSend,
  onSaveDraft,
  onDiscardDraft,
  onExit,
  onRouteChange,
  showToast,
}) => {
  const picker = useMaterialPicker({
    materials: draft.materials,
    onAdd: (materials) => {
      setDraft((current) => ({ ...current, materials: [...current.materials, ...materials] }));
    },
    onError: showToast,
  });
  const voice = useVoiceInput({
    onTranscription: (text) => setDraft((current) => ({ ...current, text: `${current.text}${current.text ? '\n' : ''}${text}` })),
    onAudioMaterial: (material) => {
      setDraft((current) => {
        const next = [...current.materials, { ...material, sort_order: current.materials.length }];
        const validation = validateMaterials(next);
        if (validation.ok === false) {
          showToast(validation.message);
          return current;
        }
        return { ...current, materials: next };
      });
    },
    onError: showToast,
  });
  const canSend = getCanSend(draft);

  const handleBack = () => {
    if (isDraftEmpty(draft)) {
      onExit();
      return;
    }
    const choice = window.prompt('输入 1 保存草稿，输入 2 放弃，留空取消');
    if (choice === '1') {
      onSaveDraft();
      onExit();
    }
    if (choice === '2') {
      onDiscardDraft();
      onExit();
    }
  };

  const removeMaterial = (id: string) => {
    setDraft((current) => ({
      ...current,
      materials: current.materials.filter((material) => material.id !== id),
    }));
  };

  return (
    <main className="now-page" data-testid="now-page">
      <header className="now-header">
        <button type="button" className="now-icon-button" onClick={handleBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div className="now-time">{draft.display_time}</div>
        <button type="button" className="now-icon-button" onClick={() => onRouteChange('avatar-chat')} aria-label="分身记录">
          <Bot size={20} />
        </button>
      </header>

      <section className="now-editor">
        <textarea
          value={draft.text}
          maxLength={CONFIG.MAX_TEXT_LENGTH}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
          placeholder="记下此刻…"
          aria-label="记录正文"
        />
        <MaterialPreview materials={draft.materials} onRemove={removeMaterial} />
      </section>

      <button type="button" className="now-tags-bar" onClick={() => onRouteChange('tags')}>
        {draft.mood_tags.length === 0 && draft.event_tags.length === 0 ? (
          <span className="now-tags-empty">未选标签</span>
        ) : (
          <span className="now-tags-scroll">
            {draft.mood_tags.map((tag) => `心情·${tag}`).join('  ')}
            {draft.mood_tags.length > 0 && draft.event_tags.length > 0 ? '  ' : ''}
            {draft.event_tags.map((tag) => `事件·${tag}`).join('  ')}
            <span className="now-tags-edit">改</span>
          </span>
        )}
      </button>

      <footer className="now-bottom-bar">
        <button
          type="button"
          className={`now-tool-button ${voice.recording ? 'is-recording' : ''}`}
          onPointerDown={() => void voice.start()}
          onPointerUp={voice.stop}
          onPointerCancel={voice.stop}
          aria-label="按住说话"
        >
          <Mic size={20} />
          {voice.recording && <span>{Math.ceil(voice.durationMs / 1000)}s</span>}
        </button>
        <div className="now-material-menu">
          <button type="button" className="now-tool-button" aria-label="图片" onClick={picker.openImagePicker}>
            <Image size={20} />
          </button>
          <button type="button" className="now-tool-button" aria-label="视频" onClick={picker.openVideoPicker}>
            <Video size={20} />
          </button>
          <button type="button" className="now-tool-button" aria-label="链接" onClick={picker.addLink}>
            <LinkIcon size={20} />
          </button>
        </div>
        <button
          type="button"
          className="now-send-button"
          data-state={sending ? 'loading' : canSend ? 'enabled' : 'disabled'}
          onClick={() => {
            const reason = getDisabledSendReason(draft);
            if (reason) {
              showToast(reason);
              return;
            }
            onSend();
          }}
          aria-label="发送过去"
          disabled={sending}
        >
          <ArrowUp size={22} />
        </button>
      </footer>
      {voice.recording && (
        <div className="now-recording-panel" role="status" aria-live="polite">
          <div className="now-recording-pulse" />
          <div>
            <strong>正在录音</strong>
            <span>{Math.ceil(voice.durationMs / 1000)} 秒</span>
          </div>
        </div>
      )}
      {voice.pendingCapture && (
        <div className="now-voice-choice" role="dialog" aria-label="录音处理方式">
          <div className="now-voice-choice__body">
            <div>
              <strong>录音完成</strong>
              <span>{Math.max(1, Math.ceil(voice.pendingCapture.durationMs / 1000))} 秒</span>
            </div>
            {voice.pendingCapture.url && <audio controls src={voice.pendingCapture.url} />}
            <div className="now-voice-choice__actions">
              <button type="button" onClick={voice.confirmTranscription}>
                转文字
              </button>
              <button type="button" onClick={voice.confirmAudioMaterial}>
                录音直接发送
              </button>
              <button type="button" onClick={voice.discardPendingCapture}>
                放弃
              </button>
            </div>
          </div>
        </div>
      )}
      <input ref={picker.imageInputRef} hidden type="file" accept="image/*" multiple onChange={(event) => picker.addFiles(event.target.files, 'image')} />
      <input ref={picker.videoInputRef} hidden type="file" accept="video/*" onChange={(event) => picker.addFiles(event.target.files, 'video')} />
    </main>
  );
};

const MaterialPreview: React.FC<{ materials: Material[]; onRemove: (id: string) => void }> = ({ materials, onRemove }) => {
  if (materials.length === 0) return null;
  return (
    <div className="now-materials">
      {materials.map((material) => (
        <div key={material.id} className="now-material">
          {material.type === 'image' && material.url ? <img src={material.url} alt={material.local_path || '图片素材'} /> : <Paperclip size={18} />}
          <span>{material.meta?.title || material.local_path || material.type}</span>
          <button type="button" onClick={() => onRemove(material.id)} aria-label="删除素材">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

const TagSelectPage: React.FC<{
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  onBack: () => void;
  showToast: (message: string) => void;
}> = ({ draft, setDraft, onBack, showToast }) => {
  const [moodTags, setMoodTags] = useState(draft.mood_tags);
  const [eventTags, setEventTags] = useState(draft.event_tags);
  const [customAnchors, setCustomAnchors] = useState(getCustomAnchors);

  const toggle = (tag: string, values: string[], setValues: (values: string[]) => void, max: number) => {
    if (values.includes(tag)) {
      setValues(values.filter((item) => item !== tag));
      return;
    }
    if (values.length >= max) {
      showToast('最多选择 3 个');
      return;
    }
    setValues([...values, tag]);
  };

  const addCustomAnchor = () => {
    const value = window.prompt('输入自定义锚点，2～12 字')?.trim();
    if (!value) return;
    if (value.length < 2 || value.length > 12) {
      showToast('自定义锚点需为 2～12 字');
      return;
    }
    const next = Array.from(new Set([...customAnchors, value]));
    setCustomAnchors(next);
    window.localStorage.setItem(STORAGE_KEYS.customAnchors, JSON.stringify(next));
    if (!eventTags.includes(value)) toggle(value, eventTags, setEventTags, CONFIG.MAX_EVENT_TAGS);
  };

  const confirm = () => {
    const validation = validateTags(moodTags, eventTags, customAnchors);
    if (validation.ok === false) {
      showToast(validation.message);
      return;
    }
    setDraft((current) => ({ ...current, mood_tags: moodTags, event_tags: eventTags }));
    onBack();
  };

  return (
    <main className="now-page now-tags-page">
      <header className="now-header">
        <button type="button" className="now-icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div className="now-time">选择标签</div>
        <button type="button" className="now-text-button" onClick={confirm}>
          确定
        </button>
      </header>
      <section className="now-tag-section">
        <p>{TAG_SLOGAN}</p>
        <h2>心情</h2>
        <div className="now-chip-grid">
          {MOOD_TAGS.map((tag) => (
            <button key={tag} type="button" className={moodTags.includes(tag) ? 'is-selected' : ''} onClick={() => toggle(tag, moodTags, setMoodTags, CONFIG.MAX_MOOD_TAGS)}>
              {tag}
            </button>
          ))}
        </div>
        <h2>事件</h2>
        <div className="now-chip-grid">
          {[...EVENT_TAGS.filter((tag) => tag !== '自定义锚点'), ...customAnchors].map((tag) => (
            <button key={tag} type="button" className={eventTags.includes(tag) ? 'is-selected' : ''} onClick={() => toggle(tag, eventTags, setEventTags, CONFIG.MAX_EVENT_TAGS)}>
              {tag}
            </button>
          ))}
          <button type="button" onClick={addCustomAnchor}>
            <Plus size={14} /> 自定义锚点
          </button>
        </div>
      </section>
    </main>
  );
};

const AvatarChatPage: React.FC<{
  draft: NowDraft;
  setDraft: (updater: NowDraft | ((draft: NowDraft) => NowDraft)) => void;
  sending: boolean;
  onBack: () => void;
  onRouteChange: (route: NowRoute) => void;
  onSend: (preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>;
  showToast: (message: string) => void;
}> = ({ draft, setDraft, sending, onBack, onRouteChange, onSend, showToast }) => {
  const sessionId = useMemo(() => makeId('avatar-session'), []);
  const [input, setInput] = useState('');
  const [followupRound, setFollowupRound] = useState(0);
  const [assistantTurns, setAssistantTurns] = useState(0);
  const [preview, setPreview] = useState<RecordPreviewPayload | null>(null);
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const first = window.localStorage.getItem(STORAGE_KEYS.avatarIntroShown) !== 'true';
    window.localStorage.setItem(STORAGE_KEYS.avatarIntroShown, 'true');
    const now = new Date().toISOString();
    return first
      ? [
          {
            id: makeId('msg'),
            role: 'assistant',
            type: 'text',
            content: '你好，我是你的分身。我可以帮你记录此刻：把今天发生的事、你的感受、想法，整理成一条完整记录，存进「过去」。',
            created_at: now,
          },
          {
            id: makeId('msg'),
            role: 'assistant',
            type: 'text',
            content: '使用规则：① 用语音或文字告诉我想记下什么 ② 说完点「记录完毕」③ 若内容较少，我会最多追问 2 轮 ④ 整理好后给你完整记录和心情/事件标签，你确认后发送。现在，说说今天想记下什么吧。',
            created_at: now,
          },
        ]
      : [
          {
            id: makeId('msg'),
            role: 'assistant',
            type: 'text',
            content: '说说今天想记下什么，说完点「记录完毕」。',
            created_at: now,
          },
        ];
  });

  const userMessages = messages.filter((message) => message.role === 'user');

  const sendMessage = () => {
    const content = input.trim();
    if (!content) return;
    const userMessage: ChatMessage = {
      id: makeId('msg'),
      role: 'user',
      type: 'text',
      content,
      created_at: new Date().toISOString(),
    };
    const nextUserMessages = [...userMessages, userMessage];
    const followup = assistantTurns < CONFIG.MAX_FOLLOWUP_ROUNDS ? buildAdaptiveFollowup(nextUserMessages, assistantTurns) : null;
    setMessages((current) => {
      const next = [...current, userMessage];
      if (!followup) return next;
      return [
        ...next,
        {
          id: makeId('msg'),
          role: 'assistant',
          type: 'text',
          content: followup,
          created_at: new Date().toISOString(),
        },
      ];
    });
    if (followup) setAssistantTurns((value) => value + 1);
    setInput('');
  };

  const finish = async () => {
    if (userMessages.length === 0) {
      showToast('请先说说想记下什么');
      return;
    }
    const recordableMessages = getRecordableInformation(userMessages);
    if (recordableMessages.length === 0) {
      const question = buildAdaptiveFollowup(userMessages, followupRound) ?? '这些内容还不足以整理成记录。请至少说清一件具体发生的事，或先返回手动记录。';
      if (followupRound < CONFIG.MAX_FOLLOWUP_ROUNDS) setFollowupRound((value) => value + 1);
      setMessages((current) => [
        ...current,
        { id: makeId('msg'), role: 'assistant', type: 'text', content: question, created_at: new Date().toISOString() },
      ]);
      return;
    }
    if (!isContentSufficient(userMessages) && followupRound < CONFIG.MAX_FOLLOWUP_ROUNDS) {
      const question = buildAdaptiveFollowup(userMessages, followupRound) ?? (followupRound === 0 ? '能具体说说是哪件事吗？当时你怎么想的？' : '这件事你现在的感受是什么？');
      setFollowupRound((value) => value + 1);
      setMessages((current) => [...current, { id: makeId('msg'), role: 'assistant', type: 'text', content: question, created_at: new Date().toISOString() }]);
      return;
    }
    setGenerating(true);
    try {
      const result = await summarizeAvatarMessages({ messages, record_time: draft.record_time, followup_round: followupRound });
      if (result.can_summarize === false || result.mood_tags.length === 0 || result.event_tags.length === 0 || !result.text.trim()) {
        setMessages((current) => [
          ...current,
          {
            id: makeId('msg'),
            role: 'assistant',
            type: 'text',
            content: result.followup_question || result.reason || '信息还不够具体，我不能替你随意生成记录或标签。请补充一件具体事实。',
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }
      if (result.followup_question && followupRound < CONFIG.MAX_FOLLOWUP_ROUNDS) {
        setFollowupRound((value) => value + 1);
        setMessages((current) => [...current, { id: makeId('msg'), role: 'assistant', type: 'text', content: result.followup_question!, created_at: new Date().toISOString() }]);
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
      setMessages((current) => [...current, { id: makeId('msg'), role: 'assistant', type: 'record_preview', content: 'record_preview', payload, created_at: new Date().toISOString() }]);
    } catch {
      showToast('整理失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="now-page now-chat-page">
      <header className="now-header">
        <button type="button" className="now-icon-button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div className="now-time">分身记录</div>
        <button type="button" className="now-icon-button" onClick={onBack} aria-label="关闭">
          <X size={20} />
        </button>
      </header>
      <section className="now-chat-list">
        {messages.map((message) =>
          message.type === 'record_preview' && message.payload ? (
            <RecordPreviewCard
              key={message.id}
              payload={message.payload}
              sending={sending}
              onChange={setPreview}
              onEditTags={() => {
                if (preview) {
                  setDraft((current) => ({ ...current, mood_tags: preview.mood_tags, event_tags: preview.event_tags }));
                }
                onRouteChange('tags');
              }}
              onSend={() => void onSend(preview ?? message.payload!, sessionId)}
            />
          ) : (
            <div key={message.id} className={`now-chat-bubble ${message.role === 'user' ? 'is-user' : ''}`}>
              {message.content}
            </div>
          ),
        )}
        {generating && <div className="now-chat-bubble">正在整理…</div>}
      </section>
      <footer className="now-chat-input">
        <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="输入想记录的内容" />
        <button type="button" onClick={sendMessage}>发送</button>
        <button type="button" onClick={() => void finish()} disabled={generating}>记录完毕</button>
      </footer>
    </main>
  );
};

const RecordPreviewCard: React.FC<{
  payload: RecordPreviewPayload;
  sending: boolean;
  onChange: (payload: RecordPreviewPayload) => void;
  onEditTags: () => void;
  onSend: () => void;
}> = ({ payload, sending, onChange, onEditTags, onSend }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(payload.text);
  return (
    <article className="now-preview-card">
      {editing ? (
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      ) : (
        <p>{text}</p>
      )}
      <div className="now-preview-tags">
        {[...payload.mood_tags.map((tag) => `心情·${tag}`), ...payload.event_tags.map((tag) => `事件·${tag}`)].join('  ')}
      </div>
      <div className="now-preview-actions">
        <button type="button" onClick={() => {
          if (editing) onChange({ ...payload, text });
          setEditing((value) => !value);
        }}>
          {editing ? '保存' : '修改'}
        </button>
        <button type="button" onClick={onEditTags}>改标签</button>
        <button type="button" onClick={onSend} disabled={sending}>发送过去</button>
      </div>
    </article>
  );
};
