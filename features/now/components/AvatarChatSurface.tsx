import React, { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ArrowLeft, Settings2, X } from 'lucide-react';
import type {
  AvatarLaunchContext,
  AvatarMemoryFacet,
  AvatarMemoryNature,
} from '../../avatar/types';
import type { AvatarRecallMemory, AvatarStructuredInsight } from '../state/nowRules';
import type { ChatMessage, NowDraft, RecordPreviewPayload } from '../types/now';
import { AvatarMemoryConfirm } from './AvatarMemoryConfirm';
import { AvatarMemoryLibrary } from './AvatarMemoryLibrary';
import { AvatarModelSettings } from './AvatarModelSettings';
import { RecordPreviewCard } from './AvatarRecordPanels';
import { MODE_COPY } from './avatarModeCopy';
import { AvatarReliabilityAssistant } from './AvatarReliabilityAssistant';
import type { AvatarReliabilityTask } from '../state/avatarReliabilityTasks';

const AvatarChatMessage = React.memo(function AvatarChatMessage({
  message,
  preview,
  sending,
  launchContext,
  onSelectEntry,
  onSetPreview,
  onEditTags,
  onSendPreview,
}: {
  message: ChatMessage;
  preview: RecordPreviewPayload | null;
  sending: boolean;
  launchContext: AvatarLaunchContext;
  onSelectEntry?: (entryId: string) => void;
  onSetPreview: (payload: RecordPreviewPayload | null) => void;
  onEditTags: () => void;
  onSendPreview: (payload: RecordPreviewPayload) => void;
}) {
  if (message.type === 'record_preview' && message.payload) {
    const payload = preview ?? message.payload;
    return (
      <RecordPreviewCard
        payload={payload}
        sending={sending}
        onChange={onSetPreview}
        showPrincipleOutcome={launchContext.mode === 'review'}
        onEditTags={onEditTags}
        onSend={() => onSendPreview(payload)}
      />
    );
  }
  return (
    <div className={`now-chat-bubble ${message.role === 'user' ? 'is-user' : ''}`}>
      {message.content}
      {message.role === 'assistant' && message.references !== undefined && (
        <details className="avatar-message-evidence">
          <summary>本次依据与推断边界</summary>
          {message.references?.length ? (
            <ul>
              {message.references.map((reference) => (
                <li key={reference.entryId}>
                  <button type="button" onClick={() => onSelectEntry?.(reference.entryId)}>
                    {reference.title}（{new Date(reference.date).toLocaleDateString('zh-CN')}）
                  </button>
                  <span>：{reference.excerpt}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>本次没有从资料库检索到可引用资料。回答仅是模型的通用推断，请以你的实际情况判断。</p>
          )}
          {message.references?.length ? (
            <p>以上是可打开核对的资料；其余表述属于模型推断，并非已确认事实。</p>
          ) : null}
        </details>
      )}
    </div>
  );
});

interface AvatarChatSurfaceProps {
  focusedObjectText?: string;
  avatarMemories: ReturnType<
    typeof import('../../../services/avatarKnowledgeProjection').resolveAvatarKnowledge
  >['memories'];
  candidateSummary: RecordPreviewPayload | null;
  chatError: string;
  chatListRef: RefObject<HTMLElement | null>;
  hiddenMessageCount: number;
  chatPending: boolean;
  companionSaving: boolean;
  general: boolean;
  generating: boolean;
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  launchContext: AvatarLaunchContext;
  libraryOpen: boolean;
  memoryFacets: AvatarMemoryFacet[] | null;
  memoryNature: AvatarMemoryNature;
  candidateKind?: React.ComponentProps<typeof AvatarMemoryConfirm>['candidateKind'];
  candidateCategory?: React.ComponentProps<typeof AvatarMemoryConfirm>['categoryOverride'];
  candidateSourceCount?: number;
  candidatePosition?: number;
  candidateTotal?: number;
  replacementStatement?: string | null;
  visibleMessages: ChatMessage[];
  mobileShell: boolean;
  modelSettingsOpen: boolean;
  onAddMemory: () => void;
  onBack: () => void;
  onChangeInput: (value: string) => void;
  onCloseModelSettings: () => void;
  onConfirmMemory: (
    tags: string[],
    category: Parameters<React.ComponentProps<typeof AvatarMemoryConfirm>['onConfirm']>[1],
    nature: AvatarMemoryNature,
    directionKind?: 'vision' | 'goal' | 'action',
  ) => Promise<void>;
  onDismissMemory: () => void;
  onEditTags: () => void;
  onGenerateMemory: () => void;
  onMemoryTextChange: (text: string) => void;
  onOpenLibrary: (open: boolean) => void;
  onOpenModelSettings: () => void;
  onShowEarlierMessages: () => void;
  onJumpToLatest: () => void;
  onRefreshKnowledge: () => void;
  onRetry: () => void;
  onSelectEntry?: (entryId: string) => void;
  onSend: () => void;
  onSendPreview: (payload: RecordPreviewPayload) => void;
  onSetPreview: (payload: RecordPreviewPayload | null) => void;
  onSubmitModeAction: () => void;
  patterns: Parameters<typeof AvatarMemoryLibrary>[0]['patterns'];
  pendingMemories: Parameters<typeof AvatarMemoryLibrary>[0]['pendingMemories'];
  preview: RecordPreviewPayload | null;
  sending: boolean;
  setChatError: Dispatch<SetStateAction<string>>;
  showToast: (message: string) => void;
  showJumpToLatest: boolean;
  storedAvatarMemories: Parameters<typeof AvatarMemoryLibrary>[0]['historyMemories'];
  userMessageCount: number;
  validRecallMemories: AvatarRecallMemory[];
  liveInsight: AvatarStructuredInsight;
  reliabilityTask: AvatarReliabilityTask | null;
  onOpenDraft: () => void;
  draft: NowDraft;
}

export const AvatarChatSurface: React.FC<AvatarChatSurfaceProps> = ({
  focusedObjectText,
  avatarMemories,
  candidateSummary,
  chatError,
  chatListRef,
  hiddenMessageCount,
  chatPending,
  companionSaving,
  general,
  generating,
  input,
  inputRef,
  launchContext,
  libraryOpen,
  memoryFacets,
  memoryNature,
  candidateKind,
  candidateCategory,
  candidateSourceCount,
  candidatePosition,
  candidateTotal,
  replacementStatement,
  visibleMessages,
  mobileShell,
  modelSettingsOpen,
  onAddMemory,
  onBack,
  onChangeInput,
  onCloseModelSettings,
  onConfirmMemory,
  onDismissMemory,
  onEditTags,
  onGenerateMemory,
  onMemoryTextChange,
  onOpenLibrary,
  onOpenModelSettings,
  onShowEarlierMessages,
  onJumpToLatest,
  onRefreshKnowledge,
  onRetry,
  onSelectEntry,
  onSend,
  onSendPreview,
  onSetPreview,
  onSubmitModeAction,
  patterns,
  pendingMemories,
  preview,
  sending,
  setChatError,
  showToast,
  showJumpToLatest,
  storedAvatarMemories,
  userMessageCount,
  validRecallMemories,
  liveInsight,
  reliabilityTask,
  onOpenDraft,
  draft,
}) => {
  const modeCopy = MODE_COPY[launchContext.mode];
  return (
    <main
      className={`now-page now-chat-page ${general ? 'avatar-guide-page' : ''}`}
      data-testid="avatar-assist-page"
    >
      {general ? (
        <header className="avatar-page-controls">
          <div className="avatar-page-controls__left">
            <button
              type="button"
              className="now-icon-button"
              onClick={() => (libraryOpen ? onOpenLibrary(false) : onBack())}
              aria-label={libraryOpen ? '返回对话' : '返回'}
            >
              <ArrowLeft size={20} />
            </button>
            <nav className="avatar-section-tabs" aria-label="记忆分身导航">
              <button
                type="button"
                className={!libraryOpen ? 'is-active' : ''}
                aria-pressed={!libraryOpen}
                onClick={() => onOpenLibrary(false)}
              >
                聊天
              </button>
              <button
                type="button"
                className={libraryOpen ? 'is-active' : ''}
                aria-pressed={libraryOpen}
                onClick={() => onOpenLibrary(true)}
              >
                记忆档案
              </button>
            </nav>
          </div>
          <button
            type="button"
            className="avatar-settings-entry"
            disabled={chatPending}
            onClick={onOpenModelSettings}
            aria-label="打开分身设置"
          >
            <Settings2 size={18} aria-hidden="true" />
            <span>分身设置</span>
          </button>
        </header>
      ) : (
        <header className="now-header">
          <button type="button" className="now-icon-button" onClick={onBack} aria-label="返回">
            <ArrowLeft size={20} />
          </button>
          <div className="now-time">
            {mobileShell && launchContext.mode === 'capture' ? '记录协助' : modeCopy.title}
          </div>
          {!mobileShell ? (
            <button type="button" className="now-icon-button" onClick={onBack} aria-label="关闭">
              <X size={20} />
            </button>
          ) : (
            <span className="now-header__badge">协助</span>
          )}
        </header>
      )}
      {modelSettingsOpen && (
        <AvatarModelSettings
          onClose={onCloseModelSettings}
          onSaved={() =>
            setChatError((current) => (current ? '模型配置已更新，可以重试刚才的消息。' : ''))
          }
        />
      )}
      {general && (
        <details className="avatar-data-tools" open={reliabilityTask === 'backup' || undefined}>
          <summary>数据与备份</summary>
          <AvatarReliabilityAssistant
            task="backup"
            draft={draft}
            onOpenDraft={onOpenDraft}
            showToast={showToast}
          />
        </details>
      )}
      {!general && (
        <section className="now-avatar-mode-intro">
          <div>
            <span>VECTOR</span>
            <p>{focusedObjectText ? `当前讨论：${focusedObjectText}` : modeCopy.title}</p>
          </div>
        </section>
      )}
      {general && libraryOpen && (
        <AvatarMemoryLibrary
          memories={avatarMemories}
          historyMemories={storedAvatarMemories}
          patterns={patterns}
          pendingMemories={pendingMemories}
          onRefresh={onRefreshKnowledge}
          showToast={showToast}
          onAdd={onAddMemory}
        />
      )}
      <div className="avatar-chat-content" hidden={libraryOpen}>
        <section
          ref={chatListRef}
          className="now-chat-list"
          aria-label="对话记录"
          aria-live="polite"
        >
          {hiddenMessageCount > 0 && (
            <button type="button" className="avatar-load-earlier" onClick={onShowEarlierMessages}>
              查看更早消息（{hiddenMessageCount}）
            </button>
          )}
          {visibleMessages.map((message) => (
            <AvatarChatMessage
              key={message.id}
              message={message}
              preview={preview}
              sending={sending}
              launchContext={launchContext}
              onSelectEntry={onSelectEntry}
              onSetPreview={onSetPreview}
              onEditTags={onEditTags}
              onSendPreview={onSendPreview}
            />
          ))}
          {general && reliabilityTask && reliabilityTask !== 'backup' && (
            <AvatarReliabilityAssistant
              task={reliabilityTask}
              draft={draft}
              onOpenDraft={onOpenDraft}
              showToast={showToast}
            />
          )}
          {generating && <div className="now-chat-bubble">正在整理…</div>}
        </section>
        {showJumpToLatest && (
          <button
            type="button"
            className="avatar-jump-latest"
            onClick={onJumpToLatest}
            aria-label="回到最新消息"
          >
            回到最新
          </button>
        )}
        {chatPending && <p role="status">分身正在回复…</p>}
        {chatError && (
          <div role="alert">
            <p>{chatError}</p>
            <button type="button" disabled={chatPending} onClick={onOpenModelSettings}>
              检查模型接入
            </button>
            <button type="button" disabled={chatPending} onClick={onRetry}>
              重试回复
            </button>
          </div>
        )}
        <footer className="now-chat-input">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => onChangeInput(event.target.value)}
            aria-label="对话内容"
            onKeyDown={(event) =>
              event.key === 'Enter' && !event.nativeEvent.isComposing && onSend()
            }
            placeholder={general ? '直接说，我在听' : modeCopy.placeholder}
          />
          <button type="button" onClick={onSend} disabled={!input.trim() || chatPending}>
            发送
          </button>
          {general && (
            <button
              type="button"
              onClick={onGenerateMemory}
              disabled={generating || chatPending || userMessageCount === 0}
            >
              提炼记忆
            </button>
          )}
          {!general && (
            <button type="button" onClick={onSubmitModeAction} disabled={generating}>
              {modeCopy.action}
            </button>
          )}
        </footer>
      </div>
      {general && candidateSummary && (
        <AvatarMemoryConfirm
          text={candidateSummary.text}
          nature={memoryNature}
          candidateKind={candidateKind}
          categoryOverride={candidateCategory}
          sourceCount={candidateSourceCount}
          candidatePosition={candidatePosition}
          candidateTotal={candidateTotal}
          replacementStatement={replacementStatement}
          tags={candidateSummary.event_tags}
          facets={memoryFacets ?? []}
          onTextChange={onMemoryTextChange}
          onCancel={onDismissMemory}
          onConfirm={onConfirmMemory}
          sending={sending || companionSaving}
        />
      )}
    </main>
  );
};
