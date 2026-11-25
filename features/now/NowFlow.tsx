import { AvatarUpgradeBoundary } from './components/AvatarUpgradeBoundary';
import { useAvatarLanguage } from './components/avatarLanguage';
import { useAIVisibilityChoice } from '../../components/AIVisibilityDialog';
import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { AvatarChatPage } from './avatarChatLazy';
import { AvatarDataModelCenter } from './components/AvatarDataModelCenter';
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
  onSetPassword?: (password: string) => Promise<void>;
  onUnlockAvatar?: () => void;
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
  /** Open the saved record in Past after persistence succeeds. */
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
  onSetPassword,
  onUnlockAvatar,
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
  const { t } = useAvatarLanguage();
  const {
    draft,
    setDraft,
    saveDraft,
    discardDraft,
    resetAfterSend,
    ready,
    error: draftError,
    retryLoad,
  } = useNowDraft();
  const { toastMessage, showToast } = useToast();
  const [sending, setSending] = useState(false);
  const privacy = useAIVisibilityChoice(_language);
  const editorContainer = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<{ element: HTMLElement; top: number }[]>([]);
  const changeRecordingRoute = (next: NowRoute) => {
    if (next === 'tags') {
      const positions: { element: HTMLElement; top: number }[] = [];
      let element = editorContainer.current;
      while (element) {
        positions.push({ element, top: element.scrollTop });
        element = element.parentElement as HTMLDivElement | null;
      }
      if (document.scrollingElement instanceof HTMLElement)
        positions.push({
          element: document.scrollingElement,
          top: document.scrollingElement.scrollTop,
        });
      scrollPositions.current = positions;
    }
    onRouteChange(next);
  };
  useLayoutEffect(() => {
    if (route !== 'now') return;
    scrollPositions.current.forEach(({ element, top }) => {
      element.scrollTop = top;
    });
  }, [route]);
  const inFlight = useRef(false);
  const savedSubmission = pastEntries.some((entry) => entry.id === draft.submission_id);
  const cleanupStarted = useRef(false);
  useEffect(() => {
    if (!ready || !savedSubmission || inFlight.current || cleanupStarted.current) return;
    cleanupStarted.current = true;
    void resetAfterSend()
      .catch(() => false)
      .finally(() => {
        cleanupStarted.current = false;
      });
  }, [ready, savedSubmission, resetAfterSend]);
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
    if (inFlight.current || savedSubmission) return false;
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
      showToast(t(reason));
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
      const aiVisibility = await privacy.request();
      if (!aiVisibility) return false;
      if (!(await saveDraft({ ...overrideDraft, submission_id: attempt.id })))
        throw new Error('草稿尚未安全保存，请重试');
      const resumedEntry = pastEntries.find((entry) => entry.id === attempt.id);
      const entryPayload = recordToDiaryEntry(record);
      entryPayload.updatedAt = attempt.updatedAt;
      const persistedEntry =
        resumedEntry ??
        (await onPersistRecord({
          ...entryPayload,
          id: attempt.id,
          aiVisibility,
          aiConsentAt: Date.now(),
          aiSourceSessionId: avatarSessionId ?? undefined,
        }));
      // Start cleanup before navigation so unmount cannot flush the submitted draft again.
      const cleanup = resetAfterSend().catch(() => false);
      retry.current = null;
      if (onReviewSavedRecord) onReviewSavedRecord(persistedEntry);
      else if (onRecordComplete) onRecordComplete();
      else onExit();
      await cleanup;
      showToast(
        _language === 'zh'
          ? '已保存到本机，可在「过去」查看；本机保存不等于已备份'
          : 'Saved on this device. View in Past; a local save is not a backup.',
      );
      return true;
    } catch (error) {
      console.error('NowFlow: failed to persist local record', error);
      showToast(
        _language === 'zh'
          ? error instanceof Error
            ? error.message
            : '保存失败，请重试'
          : 'Could not save. Your draft is retained; please retry.',
      );
      return false;
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  };

  if (!ready)
    return (
      <div className="now-shell" role="status">
        {draftError}
        {draftError && (
          <button type="button" onClick={retryLoad}>
            {t('重新读取草稿', 'Reload draft')}
          </button>
        )}
      </div>
    );

  if (savedSubmission)
    return draftError ? (
      <div className="now-shell" role="alert">
        {draftError}
        <button type="button" onClick={() => void resetAfterSend()}>
          {t('重试', 'Retry')}
        </button>
      </div>
    ) : null;

  return (
    <div
      className={`now-shell ${isLight ? 'now-shell--light' : ''} ${
        mobileShell ? 'now-flow--mobile-shell' : ''
      }`}
    >
      {route !== 'avatar-chat' && draftError && (
        <div role="alert" className="now-draft-status">
          {draftError}
          {draftError && (
            <button type="button" onClick={() => void saveDraft()}>
              {t('重试保存', 'Retry saving')}
            </button>
          )}
        </div>
      )}
      {(route === 'now' || route === 'tags') && (
        <div ref={editorContainer} hidden={route === 'tags'}>
          <NowPage
            draft={draft}
            setDraft={setDraft}
            sending={sending}
            onSend={() => void submitRecord('manual')}
            onSaveDraft={saveDraft}
            onDiscardDraft={discardDraft}
            onExit={onExit}
            onRouteChange={changeRecordingRoute}
            showToast={showToast}
            mobileShell={mobileShell}
          />
        </div>
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
        <AvatarUpgradeBoundary
          language={_language}
          onSetPassword={onSetPassword}
          onUnlock={onUnlockAvatar}
          onBack={() => onRouteChange('now')}
        >
          <Suspense
            fallback={<div className="now-shell" aria-busy="true" aria-label="正在打开分身" />}
          >
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
          </Suspense>
        </AvatarUpgradeBoundary>
      )}
      {route === 'avatar-settings' && (
        <AvatarDataModelCenter
          draft={draft}
          onBack={() => onRouteChange('avatar-chat')}
          onOpenDraft={() => onRouteChange('now')}
          showToast={showToast}
        />
      )}
      {privacy.dialog}
      {toastMessage && <div className="now-toast">{toastMessage}</div>}
    </div>
  );
};
