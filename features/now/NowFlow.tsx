import React, { useState } from 'react';
import type { DiaryEntry, Language, Principle, Theme } from '../../types';
import { findRelatedPrinciples } from '../../services/experienceFeedback';
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

interface NowFlowProps {
  route: NowRoute;
  theme: Theme;
  language: Language;
  mobileShell?: boolean;
  onRouteChange: (route: NowRoute) => void;
  onExit: () => void;
  onPersistRecord: (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>) => Promise<string>;
  onRecordComplete?: () => void;
  pastEntries?: DiaryEntry[];
  principles?: Principle[];
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
  pastEntries = [],
  principles = [],
}) => {
  const { draft, setDraft, saveDraft, discardDraft, resetAfterSend } = useNowDraft();
  const { toastMessage, showToast } = useToast();
  const [sending, setSending] = useState(false);
  const isLight = theme === 'light';

  const submitRecord = async (
    source: NowRecord['source'],
    overrideDraft = draft,
    avatarSessionId: string | null = null,
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
      const relatedPrincipleIds = findRelatedPrinciples(entryPayload, principles, pastEntries).map(
        (principle) => principle.id,
      );
      await onPersistRecord({
        ...entryPayload,
        relatedPrincipleIds: relatedPrincipleIds.length > 0 ? relatedPrincipleIds : undefined,
      });
      void postRecord(record).catch(() => {
        if (!queuePendingRecord(record)) console.warn('NowFlow: failed to queue pending record');
      });
      showToast('已存入过去');
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
            return submitRecord('avatar_assisted', next, sessionId);
          }}
          showToast={showToast}
        />
      )}
      {toastMessage && <div className="now-toast">{toastMessage}</div>}
    </div>
  );
};
