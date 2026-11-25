import type { DiaryEntry } from '../../../types';
import React, { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { SilkSegmentedTabs } from '../../../components/silk/SilkSegmentedTabs';
import { SilkFocusIsland } from '../../../components/silk/SilkFocusIsland';
import { SilkButton } from '../../../components/silk/SilkButton';
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
import { AvatarChatMessage } from './AvatarChatMessage';
import { useAvatarLanguage } from './avatarLanguage';
import { MODE_COPY, EN_MODE_COPY } from './avatarModeCopy';
import { AvatarReliabilityAssistant } from './AvatarReliabilityAssistant';
import type { AvatarReliabilityTask } from '../state/avatarReliabilityTasks';

interface AvatarChatSurfaceProps {
  sourceReview?: React.ReactNode;
  pastEntries?: DiaryEntry[];
  focusedObjectText?: string;
  graph: Parameters<typeof AvatarMemoryLibrary>[0]['graph'];
  onReviseMemory: Parameters<typeof AvatarMemoryLibrary>[0]['onRevise'];
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
  onAddMemory: () => void;
  onBack: () => void;
  onChangeInput: (value: string) => void;
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
  onOpenSettings: () => void;
  onOpenFuture?: () => void;
  onShowEarlierMessages: () => void;
  onJumpToLatest: () => void;
  onRefreshKnowledge: () => void;
  onRetry: () => void;
  onSelectEntry?: (entryId: string) => void;
  onSend: () => void;
  onSendPreview: (payload: RecordPreviewPayload) => void;
  onSetPreview: (payload: RecordPreviewPayload | null) => void;
  onSubmitModeAction: () => void;
  preview: RecordPreviewPayload | null;
  sending: boolean;
  setChatError: Dispatch<SetStateAction<string>>;
  showToast: (message: string) => void;
  showJumpToLatest: boolean;
  userMessageCount: number;
  validRecallMemories: AvatarRecallMemory[];
  liveInsight: AvatarStructuredInsight;
  reliabilityTask: AvatarReliabilityTask | null;
  onOpenDraft: () => void;
  draft: NowDraft;
}

export const AvatarChatSurface: React.FC<AvatarChatSurfaceProps> = ({
  sourceReview,
  pastEntries,
  focusedObjectText,
  graph,
  onReviseMemory,
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
  onAddMemory,
  onBack,
  onChangeInput,
  onConfirmMemory,
  onDismissMemory,
  onEditTags,
  onGenerateMemory,
  onMemoryTextChange,
  onSetLibraryView,
  onOpenSettings,
  onOpenFuture,
  onShowEarlierMessages,
  onJumpToLatest,
  onRefreshKnowledge,
  onRetry,
  onSelectEntry,
  onSend,
  onSendPreview,
  onSetPreview,
  onSubmitModeAction,
  preview,
  sending,
  setChatError,
  showToast,
  showJumpToLatest,
  userMessageCount,
  validRecallMemories,
  liveInsight,
  reliabilityTask,
  onOpenDraft,
  draft,
}) => {
  const { language, t } = useAvatarLanguage();
  const modeCopy = (language === 'en' ? EN_MODE_COPY : MODE_COPY)[launchContext.mode];
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
              onClick={() => libraryView !== 'chat' ? onSetLibraryView('chat') : onBack()}
              aria-label={libraryView !== 'chat' ? t('返回聊天') : t('返回')}
            >
              <ArrowLeft size={20} />
            </button>
            <SilkSegmentedTabs
              className="avatar-section-tabs"
              label={t('记忆分身导航')}
              value={libraryView}
              tabs={[
                { id: 'chat', label: t('对话') },
                { id: 'library', label: t('记忆档案') },
                { id: 'settings', label: t('设置与备份') },
              ] as const}
              onChange={(view) => view === 'settings' ? onOpenSettings() : onSetLibraryView(view)}
            />
          </div>
        </header>
      ) : (
        <header className="now-header">
          <button type="button" className="now-icon-button" onClick={onBack} aria-label={t('返回')}>
            <ArrowLeft size={20} />
          </button>
          <div className="now-time">
            {modeCopy.title}
          </div>
          {!mobileShell ? (
            <button
              type="button"
              className="now-icon-button"
              onClick={onBack}
              aria-label={t('关闭')}
            >
              <X size={20} />
            </button>
          ) : (
            <span className="now-header__badge">{t('协助')}</span>
          )}
        </header>
      )}
      {!general && (
        <section className="now-avatar-mode-intro">
          <div>
            <span>VECTOR</span>
            <p>
              {focusedObjectText
                ? `${t('当前讨论', 'Discussing')}: ${focusedObjectText}`
                : modeCopy.title}
            </p>
            <small>{modeCopy.description}</small>
          </div>
        </section>
      )}
      {general && libraryView !== 'chat' && (
        <AvatarMemoryLibrary
          graph={graph}
          onRevise={onReviseMemory}
          entries={pastEntries}
          onRefresh={onRefreshKnowledge}
          showToast={showToast}
          onAdd={onAddMemory}
          onSelectEntry={onSelectEntry}
        />
      )}
      <div className="avatar-chat-content" hidden={libraryView !== 'chat'}>
        <section
          ref={chatListRef}
          className="now-chat-list"
          aria-label={t('对话记录')}
          aria-live="polite"
        >
          {sourceReview}
          {hiddenMessageCount > 0 && (
            <button type="button" className="avatar-load-earlier" onClick={onShowEarlierMessages}>
              {t('查看更早消息', 'Earlier messages')} ({hiddenMessageCount})
            </button>
          )}
          {visibleMessages.map((message) => (
            <AvatarChatMessage
              key={message.id}
              message={message}
              pastEntries={pastEntries}
              preview={preview}
              sending={sending}
              launchContext={launchContext}
              onSelectEntry={onSelectEntry}
              onSetPreview={onSetPreview}
              onEditTags={onEditTags}
              onSendPreview={onSendPreview}
              onOpenFuture={onOpenFuture}
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
          {generating && <div className="now-chat-bubble">{t('正在整理…')}</div>}
        </section>
        {showJumpToLatest && (
          <button
            type="button"
            className="avatar-jump-latest"
            onClick={onJumpToLatest}
            aria-label={t('回到最新消息')}
          >
            {t('回到最新')}
          </button>
        )}
        {chatPending && <p role="status">{t('分身正在回复…')}</p>}
        {chatError && (
          <div role="alert">
            <p>{chatError}</p>
            <p>{t('本次没有生成替代回复；你的原始提问仍在对话记录中，可在修复连接后重试。')}</p>
            <button type="button" disabled={chatPending} onClick={onOpenSettings}>
              {t('检查模型接入')}
            </button>
            <button type="button" disabled={chatPending} onClick={onRetry}>
              {t('重试回复')}
            </button>
          </div>
        )}
        <SilkFocusIsland className="now-chat-input">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => onChangeInput(event.target.value)}
            aria-label={t('对话内容')}
            onKeyDown={(event) =>
              event.key === 'Enter' && !event.nativeEvent.isComposing && onSend()
            }
            placeholder={general ? t('直接说，我在听') : modeCopy.placeholder}
          />
          <SilkButton type="button" onClick={onSend} disabled={!input.trim() || chatPending}>
            {t('发送')}
          </SilkButton>
          {general && (
            <SilkButton
              variant="secondary"
              type="button"
              onClick={onGenerateMemory}
              disabled={generating || chatPending || userMessageCount === 0}
            >
              {t('提炼记忆')}
            </SilkButton>
          )}
          {!general && (
            <SilkButton type="button" variant="secondary" onClick={onSubmitModeAction} disabled={generating}>
              {modeCopy.action}
            </SilkButton>
          )}
        </SilkFocusIsland>
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
