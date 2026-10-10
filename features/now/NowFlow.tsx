import React, { useRef, useState } from 'react';
import { useFuture } from '../../hooks/useFuture';
import { generateSecureId } from '../../services/idGenerator';
import type {
  ActionItem,
  DiaryEntry,
  ExperienceFeedbackOutcome,
  Language,
  Principle,
  Theme,
} from '../../types';
import { useNowDraft } from './hooks/useNowDraft';
import { useToast } from './hooks/useToast';
import { TagSelectPage } from './components/TagSelectPage';
import { AvatarChatPage } from './components/AvatarChatPage';
import { NowPage } from './components/NowPage';
import {
  buildRecordFromDraft,
  getDisabledSendReason,
  recordToDiaryEntry,
  validateMaterials,
  validateTags,
} from './state/nowRules';
import { readCustomAnchors } from './state/nowStorage';
import type { NowRecord, NowRoute } from './types/now';
import type { AvatarLaunchContext } from '../avatar/types';
import { DEFAULT_AVATAR_CONTEXT } from '../avatar/types';
import type { ActionDraftContext } from '../../types/future';

interface NowFlowProps {
  route: NowRoute;
  theme: Theme;
  language: Language;
  mobileShell?: boolean;
  onRouteChange: (route: NowRoute) => void;
  onExit: () => void;
  onPersistRecord: (
    payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'> & { id?: string },
  ) => Promise<DiaryEntry>;
  onRelatedEntriesResolved?: (entryId: string, relatedEntryIds: string[]) => void;
  onRecordComplete?: () => void;
  /** Session-only next steps after a record is safely stored. */
  onReviewSavedRecord?: (entry: DiaryEntry) => void;
  onOpenFutureAction?: (context: ActionDraftContext) => void;
  pastEntries?: DiaryEntry[];
  principles?: Principle[];
  actions?: ActionItem[];
  onActionResultRecorded?: (actionId: string, resultEntryId: string) => Promise<void> | void;
  onUpdatePrinciple?: (principle: Principle) => Promise<void> | void;
  avatarLaunchContext?: AvatarLaunchContext;
  onSelectEntry?: (entryId: string) => void;
  onNavigateModule?: (module: 'past' | 'now' | 'future') => void;
}

export const NowFlow: React.FC<NowFlowProps> = ({
  route,
  theme,
  language: _language,
  mobileShell = false,
  onRouteChange,
  onExit,
  onPersistRecord,
  onRecordComplete,
  onReviewSavedRecord,
  pastEntries = [],
  principles = [],
  actions = [],
  avatarLaunchContext = DEFAULT_AVATAR_CONTEXT,
  onSelectEntry,
  onNavigateModule,
}) => {
  const {
    draft,
    setDraft,
    saveDraft,
    discardDraft,
    resetAfterSend,
    ready,
    status: draftStatus,
    error: draftError,
    retryLoad,
  } = useNowDraft();
  const { toastMessage, showToast } = useToast();
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const [completionError, setCompletionError] = useState('');
  const [completedEntry, setCompletedEntry] = useState<DiaryEntry | null>(null);
  const pendingCompletion = useRef<(() => Promise<void>) | null>(null);
  const retryCompletion = async () => {
    if (inFlight.current || !pendingCompletion.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      await pendingCompletion.current();
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  const retry = useRef<{
    key: string;
    id: string;
    updatedAt: number;
  } | null>(null);
  const { state: future } = useFuture();
  const isLight = theme === 'light';

  const submitRecord = async (
    source: NowRecord['source'],
    overrideDraft = draft,
    avatarSessionId: string | null = null,
    principleOutcome?: ExperienceFeedbackOutcome,
  ) => {
    if (inFlight.current || pendingCompletion.current) return false;
    const tagValidation = validateTags(
      overrideDraft.mood_tags,
      overrideDraft.event_tags,
      readCustomAnchors(),
    );
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
    inFlight.current = true;
    const record = buildRecordFromDraft(overrideDraft, source, avatarSessionId);
    const key = JSON.stringify({ record, principleOutcome });
    if (retry.current?.key !== key)
      retry.current = {
        key,
        id: overrideDraft.submission_id ?? generateSecureId('now'),
        updatedAt: Date.now(),
      };
    const attempt = retry.current;
    try {
      if (!(await saveDraft({ ...overrideDraft, submission_id: attempt.id })))
        throw new Error('草稿尚未安全保存，请重试');
      const resumedEntry = pastEntries.find((entry) => entry.id === attempt.id);
      const entryPayload = recordToDiaryEntry(record);
      entryPayload.updatedAt = attempt.updatedAt;
      const persistedEntry =
        resumedEntry ?? (await onPersistRecord({ ...entryPayload, id: attempt.id }));
      pendingCompletion.current = async () => {
        try {
          if (!(await resetAfterSend())) throw new Error('草稿清理失败，原文仍保留');
        } catch (error) {
          setCompletionError(
            '记录已保存。' + (error instanceof Error ? error.message : '草稿清理失败'),
          );
          return;
        }
        pendingCompletion.current = null;
        setCompletionError('');
        retry.current = null;
        showToast('已存入过去');
        setCompletedEntry(persistedEntry);
      };
      await pendingCompletion.current();
      return true;
    } catch (error) {
      console.error('NowFlow: failed to persist local record', error);
      showToast(error instanceof Error ? error.message : '发送失败，请重试');
      return false;
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  };

  if (!ready)
    return (
      <div className="now-shell" role="status">
        {draftError || '正在恢复草稿…'}
        {draftError && (
          <button type="button" onClick={retryLoad}>
            重新读取草稿
          </button>
        )}
      </div>
    );

  if (pastEntries.some((entry) => entry.id === draft.submission_id))
    return (
      <div className="now-shell">
        <p role={completionError ? 'alert' : 'status'}>
          {completionError || '这条记录已保存，正在等待清理草稿。可安全重试，不会重复创建记录。'}
        </p>
        <button
          type="button"
          disabled={sending}
          onClick={() =>
            void (pendingCompletion.current ? retryCompletion() : submitRecord('manual'))
          }
        >
          继续完成
        </button>
      </div>
    );

  if (completedEntry)
    return (
      <main className="now-shell now-completion" aria-labelledby="now-completion-title">
        <h1 id="now-completion-title">经历已保存</h1>
        <div className="now-completion__actions">
          <button type="button" onClick={() => setCompletedEntry(null)}>
            继续记录
          </button>
          <button type="button" onClick={() => onReviewSavedRecord?.(completedEntry)}>
            回看这段经历
          </button>
        </div>
      </main>
    );

  return (
    <div
      className={`now-shell ${isLight ? 'now-shell--light' : ''} ${
        mobileShell ? 'now-flow--mobile-shell' : ''
      }`}
    >
      {completionError && (
        <div role="alert" className="now-draft-status">
          {completionError}
          <button type="button" disabled={sending} onClick={() => void retryCompletion()}>
            重试清理草稿
          </button>
        </div>
      )}
      {route !== 'avatar-chat' && (
        <div role={draftError ? 'alert' : 'status'} className="now-draft-status">
          {draftError || draftStatus}
          {draftError && (
            <button type="button" onClick={() => void saveDraft()}>
              重试保存
            </button>
          )}
        </div>
      )}
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
          mobileShell={mobileShell}
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
          principles={principles}
          actions={actions}
          future={future}
          onNavigateModule={onNavigateModule}
          draft={draft}
          setDraft={setDraft}
          pastEntries={pastEntries}
          sending={sending}
          mobileShell={mobileShell}
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
            return submitRecord('avatar_assisted', next, sessionId, preview.principle_outcome);
          }}
          showToast={showToast}
          launchContext={avatarLaunchContext}
          onSelectEntry={onSelectEntry}
        />
      )}
      {toastMessage && <div className="now-toast">{toastMessage}</div>}
    </div>
  );
};
