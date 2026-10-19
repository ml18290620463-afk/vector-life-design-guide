import type { DiaryEntry } from '../../../types';
import { formatAvatarReply } from '../state/avatarReplyFormat';
import React, { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ArrowLeft, Settings2, X } from 'lucide-react';
import type {
  AvatarLaunchContext,
  AvatarMemoryFacet,
  AvatarMemoryNature,
  AvatarMemorySourceRef,
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
      {message.role === 'assistant' ? formatAvatarReply(message.content) : message.content}
      {message.role === 'assistant' && message.references?.length ? (
        <button
          type="button"
          className="avatar-message-references"
          onClick={() => onSelectEntry?.(message.references![0].entryId)}
        >
          查看 {message.references.length} 条经历
        </button>
      ) : null}
    </div>
  );
});

interface AvatarChatSurfaceProps {
  pastEntries?: DiaryEntry[];
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
  libraryView: 'chat' | 'library';
  memoryFacets: AvatarMemoryFacet[] | null;
  memoryNature: AvatarMemoryNature;
  candidateKind?: React.ComponentProps<typeof AvatarMemoryConfirm>['candidateKind'];
  candidateCategory?: React.ComponentProps<typeof AvatarMemoryConfirm>['categoryOverride'];
  candidateSourceCount?: number;
  candidateSourceRefs?: AvatarMemorySourceRef[];
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
  onSetLibraryView: (view: 'chat' | 'library') => void;
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
  pastEntries,
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
  libraryView,
  memoryFacets,
  memoryNature,
  candidateKind,
  candidateCategory,
  candidateSourceCount,
  candidateSourceRefs,
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
  onSetLibraryView,
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
  const [backupWorkspaceOpen, setBackupWorkspaceOpen] = React.useState(false);
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
              onClick={() =>
                backupWorkspaceOpen
                  ? setBackupWorkspaceOpen(false)
                  : libraryView !== 'chat'
                    ? onSetLibraryView('chat')
                    : onBack()
              }
              aria-label={backupWorkspaceOpen || libraryView !== 'chat' ? '返回聊天' : '返回'}
            >
              <ArrowLeft size={20} />
            </button>
            <nav className="avatar-section-tabs" aria-label="记忆分身导航">
              <button
                type="button"
                className={!backupWorkspaceOpen && libraryView === 'chat' ? 'is-active' : ''}
                aria-pressed={!backupWorkspaceOpen && libraryView === 'chat'}
                onClick={() => {
                  setBackupWorkspaceOpen(false);
                  onSetLibraryView('chat');
                }}
              >
                聊天
              </button>
              <button
                type="button"
                className={!backupWorkspaceOpen && libraryView === 'library' ? 'is-active' : ''}
                aria-pressed={!backupWorkspaceOpen && libraryView === 'library'}
                onClick={() => {
                  setBackupWorkspaceOpen(false);
                  onSetLibraryView('library');
                }}
              >
                记忆库
              </button>
              <button
                type="button"
                className={backupWorkspaceOpen ? 'is-active' : ''}
                aria-pressed={backupWorkspaceOpen}
                onClick={() => setBackupWorkspaceOpen(true)}
              >
                备份
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
      {!general && (
        <section className="now-avatar-mode-intro">
          <div>
            <span>VECTOR</span>
            <p>{focusedObjectText ? `当前讨论：${focusedObjectText}` : modeCopy.title}</p>
          </div>
        </section>
      )}
      {general && !backupWorkspaceOpen && libraryView !== 'chat' && (
        <AvatarMemoryLibrary
          memories={avatarMemories}
          entries={pastEntries}
          historyMemories={storedAvatarMemories}
          patterns={patterns}
          pendingMemories={pendingMemories}
          onRefresh={onRefreshKnowledge}
          showToast={showToast}
          onAdd={onAddMemory}
        />
      )}
      {general && backupWorkspaceOpen && (
        <section className="avatar-backup-workspace" aria-labelledby="avatar-backup-title">
          <header className="avatar-backup-workspace__header">
            <p>资料管理</p>
            <h1 id="avatar-backup-title">备份与恢复</h1>
            <span>带走完整资料，回到任何一台设备后继续使用。</span>
          </header>
          <AvatarReliabilityAssistant
            task="backup"
            draft={draft}
            onOpenDraft={onOpenDraft}
            showToast={showToast}
          />
        </section>
      )}
      <div className="avatar-chat-content" hidden={backupWorkspaceOpen || libraryView !== 'chat'}>
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
            <p>本次没有生成替代回复；你的原始提问仍在对话记录中，可在修复连接后重试。</p>
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
          sourceRefs={candidateSourceRefs}
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
