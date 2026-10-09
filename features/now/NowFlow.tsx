import React, { useMemo, useRef, useState } from 'react';
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
import { applyPrincipleFeedback, findRelatedPrinciples } from '../../services/experienceFeedback';
import { buildExperienceEdges } from '../../services/entryRelations';
import {
  buildLocalSemanticIndex,
  searchLocalSemanticIndex,
} from '../../services/localSemanticIndex';
import { findNeuralRelatedEntryIds } from '../../services/neuralSemanticRecall';
import { buildAvatarGrowthPreview } from '../../services/avatarIntelligence';
import { readAvatarUnderstandings, upsertAvatarAtomicMemories } from '../../services/avatarMemory';
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
  onRelatedEntriesResolved,
  onRecordComplete,
  onReviewSavedRecord,
  onOpenFutureAction,
  pastEntries = [],
  principles = [],
  actions = [],
  onActionResultRecorded,
  onUpdatePrinciple,
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
  const semanticIndex = useMemo(() => buildLocalSemanticIndex(pastEntries), [pastEntries]);
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
      const reviewAction = resumedEntry?.relatedActionIds?.length
        ? actions.find((action) => action.id === resumedEntry.relatedActionIds?.[0])
        : avatarLaunchContext.mode === 'review' && avatarLaunchContext.actionId
          ? actions.find((action) => action.id === avatarLaunchContext.actionId)
          : undefined;
      const relatedPrincipleIds = [
        ...new Set([
          ...findRelatedPrinciples(entryPayload, principles, pastEntries).map(
            (principle) => principle.id,
          ),
          ...(reviewAction?.principleId ? [reviewAction.principleId] : []),
        ]),
      ];
      const relatedEntries = searchLocalSemanticIndex(entryPayload, semanticIndex).map(
        ({ entry }) => entry,
      );
      const relatedEntryIds = relatedEntries.map((entry) => entry.id);
      const resumedFeedback = resumedEntry?.principleFeedback?.[0];
      principleOutcome = resumedFeedback?.outcome ?? principleOutcome;
      const reviewPrinciple = resumedFeedback
        ? principles.find((principle) => principle.id === resumedFeedback.principleId)
        : reviewAction?.principleId
          ? principles.find((principle) => principle.id === reviewAction.principleId)
          : undefined;
      const feedbackCreatedAt = resumedFeedback?.createdAt ?? attempt.updatedAt;
      const principleFeedback =
        reviewPrinciple && principleOutcome
          ? [
              {
                principleId: reviewPrinciple.id,
                outcome: principleOutcome,
                createdAt: feedbackCreatedAt,
              },
            ]
          : undefined;
      const payload = {
        ...entryPayload,
        id: attempt.id,
        relatedActionIds: reviewAction ? [reviewAction.id] : undefined,
        relatedEntryIds: relatedEntryIds.length > 0 ? relatedEntryIds : undefined,
        experienceEdges:
          relatedEntries.length > 0
            ? buildExperienceEdges({ ...entryPayload, principleFeedback }, relatedEntries)
            : undefined,
        relatedPrincipleIds: relatedPrincipleIds.length > 0 ? relatedPrincipleIds : undefined,
        principleFeedback,
      };
      const persistedEntry = resumedEntry ?? (await onPersistRecord(payload));
      const steps = [
        async () => {
          const preview = await buildAvatarGrowthPreview(
            {
              messages: [
                {
                  role: 'user',
                  content: persistedEntry.content,
                  createdAt: persistedEntry.createdAt,
                },
              ],
              source: 'now',
              sourceEntryId: persistedEntry.id,
              occurredAt: persistedEntry.createdAt,
            },
            {
              entries: pastEntries,
              understandings: readAvatarUnderstandings(),
              now: persistedEntry.createdAt,
            },
          );
          if (!upsertAvatarAtomicMemories(preview.atomicMemoryCandidates))
            throw new Error('分身记忆尚未保存');
        },
        async () => {
          if (reviewPrinciple && principleOutcome && onUpdatePrinciple)
            await onUpdatePrinciple(
              applyPrincipleFeedback(
                reviewPrinciple,
                principleOutcome,
                feedbackCreatedAt,
                persistedEntry.id,
              ),
            );
        },
        async () => {
          if (reviewAction && onActionResultRecorded)
            await onActionResultRecorded(reviewAction.id, persistedEntry.id);
        },
      ];
      const finished = new Set<number>();
      pendingCompletion.current = async () => {
        const errors: string[] = [];
        for (let index = 0; index < steps.length; index++) {
          if (finished.has(index)) continue;
          try {
            await steps[index]();
            finished.add(index);
          } catch (error) {
            errors.push(error instanceof Error ? error.message : '后续处理失败');
          }
        }
        if (!errors.length && !(await resetAfterSend())) errors.push('草稿清理失败，原文仍保留');
        if (errors.length) {
          setCompletionError('记录已保存。' + errors.join('；') + '。重试只补齐未完成的处理。');
          return;
        }
        pendingCompletion.current = null;
        setCompletionError('');
        retry.current = null;
        showToast('已存入过去');
        setCompletedEntry(persistedEntry);
      };
      if (onRelatedEntriesResolved) {
        void findNeuralRelatedEntryIds(persistedEntry.id, entryPayload, pastEntries)
          .then((neuralRelatedEntryIds) => {
            const mergedIds = [...new Set([...neuralRelatedEntryIds, ...relatedEntryIds])].slice(
              0,
              3,
            );
            onRelatedEntriesResolved(persistedEntry.id, mergedIds);
          })
          .catch(() => {
            // The deterministic on-device fingerprint already supplied a
            // result. Neural loading is an optional, non-blocking rerank.
          });
      }
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
          {completionError ||
            '这条记录已保存，正在等待完成后续处理。可安全重试，不会重复创建记录。'}
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
        <h1 id="now-completion-title">记录已存入过去</h1>
        <p>你可以继续写下此刻，回看这条资料，或把它作为下一步行动的依据。</p>
        <div className="now-completion__actions">
          <button type="button" onClick={() => setCompletedEntry(null)}>
            继续记录
          </button>
          <button type="button" onClick={() => onReviewSavedRecord?.(completedEntry)}>
            回看资料
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenFutureAction?.({
                sourceEntryId: completedEntry.id,
                evidenceEntryIds: [completedEntry.id],
                rationale: completedEntry.title || completedEntry.content.slice(0, 120),
              })
            }
          >
            建立行动
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
            重试未完成处理
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
