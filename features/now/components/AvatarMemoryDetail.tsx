import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { isDirectionCandidate, isTimeSensitiveMemory } from '../../../services/avatarMemoryArchive';
import type { AvatarAtomicMemory, AvatarMemorySourceKind } from '../../avatar/types';

const sourceLabels: Record<AvatarMemorySourceKind, string> = {
  entry: '过去记录',
  message: '对话',
  future: '未来',
  principle: '原则',
  pattern: '规律',
  action: '行动',
};

export function AvatarMemoryDetail({
  memory,
  sources,
  onClose,
  onSave,
  onSupersede,
  readOnly = false,
  busy = false,
}: {
  memory: AvatarAtomicMemory;
  sources: AvatarAtomicMemory[];
  onClose: () => void;
  busy?: boolean;
  onSave: (
    statement: string,
    status: 'confirmed' | 'rejected',
    kind?: 'vision' | 'goal' | 'action',
  ) => void;
  onSupersede: (statement: string) => void;
  /** Canonical past/future records are indexed here and edited in their owner module. */
  readOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<'vision' | 'goal' | 'action'>('goal');
  const direction = isDirectionCandidate(memory);
  const pending = memory.status === 'candidate';
  const isPatternObservation = memory.facets.includes('cognitive_pattern') && pending;
  const isConfirmedPattern = memory.id.startsWith('atomic_pattern_') && !pending;
  const timeSensitive = isTimeSensitiveMemory(memory);
  const updatedAt = memory.updatedAt ?? memory.confirmedAt ?? memory.createdAt;
  const retainedWithoutExperience =
    memory.retainedAfterSourceDeletion === true &&
    !memory.sourceRefs.some((source) => source.source === 'entry');
  const updateLabel = timeSensitive ? '确认更新' : '保存修改';
  const messageEvidenceCount = new Set(
    memory.sourceRefs.filter((source) => source.source === 'message').map((source) => source.id),
  ).size;
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
        <button type="button" className="avatar-memory-dialog__back" aria-label="返回分身" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <h2 id="avatar-memory-detail-title">
          {forgetting
            ? '暂不采用这条理解？'
            : isPatternObservation
              ? '确认这条模式？'
              : pending
                ? '确认记忆'
                : '记忆详情'}
        </h2>
      </header>
      {forgetting ? (
        <p>分身将不再使用这条理解，原始记录和经历不会删除。</p>
      ) : editing ? (
        <>
          {direction && (
            <label>
              保存为
              <select
                aria-label="保存类型"
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="vision">愿景</option>
                <option value="goal">目标</option>
                <option value="action">行动</option>
              </select>
            </label>
          )}
          <label htmlFor="avatar-memory-edit">记忆内容</label>
          {isConfirmedPattern && (
            <p className="avatar-memory-detail__guidance">
              只有当这个规律持续变化时再修订；一次情绪或事件更适合留在记录中。
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
        <p className="avatar-memory-detail__statement">{memory.statement}</p>
      )}
      {!forgetting && !pending && (
        <p className="avatar-memory-detail__status">
          {timeSensitive ? '当前状态 · ' : '已确认 · '}
          最近更新于 {new Date(updatedAt).toLocaleDateString('zh-CN')}
        </p>
      )}
      {!forgetting && retainedWithoutExperience && (
        <p className="avatar-memory-detail__retained">
          这条理解由你选择保留；原始经历已删除，因此不再显示经历依据。
        </p>
      )}
      {!forgetting && !retainedWithoutExperience && memory.sourceRefs.length > 0 && (
        <p className="avatar-memory-detail__evidence-count">
          {isPatternObservation
            ? `已有 ${messageEvidenceCount} 条你的表达支持；确认后会作为模式保留。`
            : `基于 ${memory.sourceRefs.length} 条依据`}
        </p>
      )}
      {!forgetting && !retainedWithoutExperience && memory.sourceRefs.length > 0 && (
        <details className="avatar-library__source">
          <summary>查看依据</summary>
          {memory.sourceRefs.map((source, index) => {
            const record = sources.find(
              (item) =>
                item.id !== memory.id &&
                item.sourceRefs[0]?.source === source.source &&
                item.sourceRefs[0]?.id === source.id,
            );
            const excerpt =
              record?.statement ?? (source.source === 'message' ? source.excerpt : undefined);
            return (
              <p key={`${source.source}-${source.id}-${index}`}>
                {sourceLabels[source.source]}
                {excerpt ? `：${excerpt}` : ' · 暂无可展示的原文'}
              </p>
            );
          })}
        </details>
      )}
      <div className="avatar-memory-dialog__actions">
        {forgetting ? (
          <>
            <button disabled={busy} type="button" onClick={() => setForgetting(false)}>
              取消
            </button>
            <button
              disabled={busy}
              type="button"
              onClick={() => onSave(memory.statement, 'rejected')}
            >
              暂不采用
            </button>
          </>
        ) : (
          <>
            <button disabled={busy} type="button" onClick={onClose}>
              关闭
            </button>
            {editing ? (
              <>
                {pending && (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => onSave(memory.statement, 'rejected')}
                  >
                    暂不采用
                  </button>
                )}
                <button
                  type="button"
                  className="is-primary"
                  disabled={busy || !text.trim()}
                  onClick={() => (pending || direction ? onSave(text, 'confirmed', direction ? kind : undefined) : onSupersede(text))}
                >
                  {pending ? '确认记住' : updateLabel}
                </button>
              </>
            ) : (
              <>
                {!readOnly && (
                  <>
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => onSave(memory.statement, 'confirmed')}
                    >
                      {timeSensitive ? '仍适用' : '准确'}
                    </button>
                    <button disabled={busy} type="button" onClick={() => setEditing(true)}>
                      {timeSensitive ? '已经变化' : '调整表述'}
                    </button>
                    <button disabled={busy} type="button" onClick={() => setForgetting(true)}>
                      暂不采用
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
