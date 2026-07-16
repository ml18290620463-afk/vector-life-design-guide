import React, { useMemo, useState } from 'react';
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
import { postRecord } from './api/records';
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
import { queuePendingRecord, readCustomAnchors } from './state/nowStorage';
import type { NowRecord, NowRoute } from './types/now';
import type { AvatarLaunchContext } from '../avatar/types';
import { DEFAULT_AVATAR_CONTEXT } from '../avatar/types';

interface NowFlowProps {
  route: NowRoute;
  theme: Theme;
  language: Language;
  mobileShell?: boolean;
  onRouteChange: (route: NowRoute) => void;
  onExit: () => void;
  onPersistRecord: (
    payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>,
  ) => Promise<DiaryEntry>;
  onRelatedEntriesResolved?: (entryId: string, relatedEntryIds: string[]) => void;
  onRecordComplete?: () => void;
  pastEntries?: DiaryEntry[];
  principles?: Principle[];
  actions?: ActionItem[];
  onActionResultRecorded?: (actionId: string, resultEntryId: string) => Promise<void> | void;
  onUpdatePrinciple?: (principle: Principle) => Promise<void> | void;
  avatarLaunchContext?: AvatarLaunchContext;
  onSelectEntry?: (entryId: string) => void;
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
  pastEntries = [],
  principles = [],
  actions = [],
  onActionResultRecorded,
  onUpdatePrinciple,
  avatarLaunchContext = DEFAULT_AVATAR_CONTEXT,
  onSelectEntry,
}) => {
  const { draft, setDraft, saveDraft, discardDraft, resetAfterSend } = useNowDraft();
  const { toastMessage, showToast } = useToast();
  const [sending, setSending] = useState(false);
  const semanticIndex = useMemo(() => buildLocalSemanticIndex(pastEntries), [pastEntries]);
  const isLight = theme === 'light';

  const submitRecord = async (
    source: NowRecord['source'],
    overrideDraft = draft,
    avatarSessionId: string | null = null,
    principleOutcome?: ExperienceFeedbackOutcome,
  ) => {
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
    const record = buildRecordFromDraft(overrideDraft, source, avatarSessionId);
    try {
      const entryPayload = recordToDiaryEntry(record);
      const reviewAction =
        avatarLaunchContext.mode === 'review' && avatarLaunchContext.actionId
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
      const reviewPrinciple = reviewAction?.principleId
        ? principles.find((principle) => principle.id === reviewAction.principleId)
        : undefined;
      const feedbackCreatedAt = Date.now();
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
      const persistedEntry = await onPersistRecord({
        ...entryPayload,
        relatedActionIds: reviewAction ? [reviewAction.id] : undefined,
        relatedEntryIds: relatedEntryIds.length > 0 ? relatedEntryIds : undefined,
        experienceEdges:
          relatedEntries.length > 0
            ? buildExperienceEdges({ ...entryPayload, principleFeedback }, relatedEntries)
            : undefined,
        relatedPrincipleIds: relatedPrincipleIds.length > 0 ? relatedPrincipleIds : undefined,
        principleFeedback,
      });
      if (reviewPrinciple && principleOutcome && onUpdatePrinciple) {
        await onUpdatePrinciple(
          applyPrincipleFeedback(reviewPrinciple, principleOutcome, feedbackCreatedAt),
        );
      }
      if (reviewAction && onActionResultRecorded) {
        await onActionResultRecorded(reviewAction.id, persistedEntry.id);
      }
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
      void postRecord(record).catch(() => {
        if (!queuePendingRecord(record)) console.warn('NowFlow: failed to queue pending record');
      });
      showToast(reviewAction ? '行动结果已回写' : '已存入过去');
      resetAfterSend();
      if (onRecordComplete) {
        onRecordComplete();
      } else {
        onRouteChange('now');
      }
      return true;
    } catch (error) {
      console.error('NowFlow: failed to persist local record', error);
      showToast('发送失败，请重试');
      return false;
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`now-shell ${isLight ? 'now-shell--light' : ''} ${
        mobileShell ? 'now-flow--mobile-shell' : ''
      }`}
    >
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
