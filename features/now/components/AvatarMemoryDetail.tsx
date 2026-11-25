import { useAvatarLanguage } from './avatarLanguage';
import { PrivateVisibilityIcon } from '../../../components/PrivateVisibilityIcon';
import { resolveOntologyEvidence } from '../../../services/avatarSourceEvidence';
import { readAvatarConfirmationPreview } from '../../../services/avatarOntologyStore';
import { subscribeVault } from '../../../services/vaultTransaction';
import type { AvatarSession, EvidencedByEdge } from '../../avatar/types';
import type { DiaryEntry } from '../../../types';
import { selfMemoryVoice } from '../../../services/avatarMemoryVoice';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { CognitiveObject } from '../../avatar/types';

const EMPTY_ENTRIES: DiaryEntry[] = [];

export function AvatarMemoryDetail({
  memory,
  entries = EMPTY_ENTRIES,
  onClose,
  onSave,
  onSupersede,
  onToggleGuardrail,
  readOnly = false,
  busy = false,
}: {
  memory: CognitiveObject;
  sources?: CognitiveObject[];
  entries?: DiaryEntry[];
  onClose: () => void;
  busy?: boolean;
  onSave: (
    statement: string,
    status: 'confirmed' | 'rejected',
    kind?: 'vision' | 'goal' | 'action',
  ) => void;
  onSupersede: (statement: string) => void;
  onToggleGuardrail?: (enabled: boolean) => void;
  /** Canonical past/future records are indexed here and edited in their owner module. */
  readOnly?: boolean;
}) {
  const { language, t } = useAvatarLanguage();
  const [sourceState, setSourceState] = useState<{
    memory: CognitiveObject;
    inputEntries: DiaryEntry[];
    entries: DiaryEntry[];
    token: string;
    sessions: AvatarSession[];
    evidence: EvidencedByEdge[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const reload = () => {
      const request = ++generation;
      setSourceState(null);
      void readAvatarConfirmationPreview().then(
        ({ privacyToken, graph, entries: storedEntries }) => {
          if (active && request === generation)
            setSourceState({ memory, inputEntries: entries, entries: storedEntries,
              token: privacyToken, sessions: graph.sessions ?? [],
              evidence: graph.edges.filter((edge): edge is EvidencedByEdge =>
                edge.type === 'EVIDENCED_BY' && edge.fromId === memory.id) });
        },
        () => {
          if (active && request === generation) setSourceState(null);
        },
      );
    };
    const unsubscribe = subscribeVault(reload);
    reload();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [memory, entries]);
  // Props can invalidate a preview but cannot authorize or supply original evidence.
  const sourcesReady = sourceState?.memory === memory && sourceState?.inputEntries === entries;
  const evidence = sourcesReady
    ? resolveOntologyEvidence(
        sourceState.evidence,
        sourceState.entries,
        sourceState.sessions,
        Date.now(),
        sourceState.token,
      )
    : [];
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = memory.status === 'candidate';
  const isPatternObservation = memory.domain === 'my_understanding' && pending;
  const isConfirmedPattern = memory.domain === 'my_understanding' && !pending;
  const timeSensitive = memory.validity.mode === 'staged';
  const updatedAt = memory.updatedAt;
  const retainedWithoutExperience = memory.status === 'retained_after_source_delete';
  const updateLabel = timeSensitive ? t('确认更新') : t('保存修改');
  const [editing, setEditing] = useState(pending);
  const [forgetting, setForgetting] = useState(false);
  const [text, setText] = useState(memory.statement);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="avatar-memory-dialog"
      aria-labelledby="avatar-memory-detail-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        // Escape should always dismiss the topmost decision first.  When the
        // user is confirming deletion, closing the entire detail dialog makes
        // it needlessly hard to tell whether deletion was cancelled or not.
        else if (forgetting) {
          event.preventDefault();
          setForgetting(false);
        } else onClose();
      }}
    >
      <header className="avatar-memory-dialog__header">
        <button
          type="button"
          className="avatar-memory-dialog__back"
          aria-label={t('返回分身')}
          onClick={onClose}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2 id="avatar-memory-detail-title">
          {forgetting
            ? t('暂不采用这条理解？')
            : isPatternObservation
              ? t('确认这条模式？')
              : pending
                ? t('确认记忆')
                : t('记忆详情')}
        </h2>
      </header>
      {forgetting ? (
        <p>{t('分身将不再使用这条理解，原始记录和经历不会删除。')}</p>
      ) : editing ? (
        <>
          <label htmlFor="avatar-memory-edit">{t('记忆内容')}</label>
          {isConfirmedPattern && (
            <p className="avatar-memory-detail__guidance">
              {t('只有当这个规律持续变化时再修订；一次情绪或事件更适合留在记录中。')}
            </p>
          )}
          <textarea
            id="avatar-memory-edit"
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </>
      ) : (
        <>
          <p className="avatar-memory-detail__privacy">
            {!memory.privacy.aiVisible && <PrivateVisibilityIcon />}
            {memory.privacy.aiVisible
              ? t('允许 AI 可见 · 仍受来源权限限制')
              : t('仅自己可见')}
          </p>
          <p className="avatar-memory-detail__statement">{selfMemoryVoice(memory.statement)}</p>
        </>
      )}
      {!forgetting && !pending && (
        <p className="avatar-memory-detail__status">
          {timeSensitive ? t('当前状态 · ') : t('已确认 · ')}
          {t('最近更新于', 'Updated')}{' '}
          {new Date(updatedAt).toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN')}
        </p>
      )}
      {!forgetting && !pending && memory.status === 'confirmed' && memory.guardrail && onToggleGuardrail && (
        <label className="avatar-memory-detail__guardrail">
          <input type="checkbox" checked={memory.guardrail.enabled} disabled={busy}
            onChange={(event) => onToggleGuardrail(event.target.checked)} />
          {t('在选择与复盘时提醒我对照这条原则', 'Remind me of this principle when deciding or reviewing')}
        </label>
      )}
      {!forgetting && retainedWithoutExperience && (
        <p className="avatar-memory-detail__retained">
          {t('这条理解由你选择保留；原始经历已删除，因此不再显示经历依据。')}
        </p>
      )}
      {!forgetting && evidence.length > 0 && (
        <details className="avatar-memory-dialog__context">
          <summary>{t('出处摘录')}</summary>
          {evidence.map((source, index) => (
            <blockquote key={`${source.id}:${index}`}>
              <p>{source.verbatimQuote}</p>
              <small>
                {source.sourceKind === 'now_entry' || source.sourceKind === 'past_experience'
                  ? t('过往记录')
                  : source.sourceKind === 'chat_user_message'
                    ? t('来自聊天自述')
                    : t('来自记录')}
              </small>
            </blockquote>
          ))}
        </details>
      )}
      <div className="avatar-memory-dialog__actions">
        {forgetting ? (
          <>
            <button disabled={busy} type="button" onClick={() => setForgetting(false)}>
              {t('取消')}
            </button>
            <button
              disabled={busy}
              type="button"
              onClick={() => onSave(memory.statement, 'rejected')}
            >
              {t('暂不采用')}
            </button>
          </>
        ) : (
          <>
            <button disabled={busy} type="button" onClick={onClose}>
              {t('关闭')}
            </button>
            {editing ? (
              <>
                {pending && (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => onSave(memory.statement, 'rejected')}
                  >
                    {t('暂不采用')}
                  </button>
                )}
                <button
                  type="button"
                  className="is-primary"
                  disabled={busy || !text.trim()}
                  onClick={() =>
                    pending
                      ? onSave(text, 'confirmed')
                      : onSupersede(text)
                  }
                >
                  {pending ? t('确认记住') : updateLabel}
                </button>
              </>
            ) : (
              <>
                {!readOnly && (
                  <>
                    <button disabled={busy} type="button" onClick={() => setEditing(true)}>
                      {timeSensitive ? t('已经变化') : t('调整表述')}
                    </button>
                    <button disabled={busy} type="button" onClick={() => setForgetting(true)}>
                      {t('暂不采用')}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
