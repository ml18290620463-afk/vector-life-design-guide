import React, { useEffect, useId, useRef, useState } from 'react';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';
import {
  readAvatarUnderstandings,
  updateAvatarUnderstandingStatus,
} from '../services/avatarMemory';
import './PatternReviewDialog.css';

/** Only mounted after a deliberate extraction or a newly saved experience. */
export function PatternReviewDialog({
  pattern,
  onDone,
  onDefer,
}: {
  pattern: Pick<AvatarUnderstandingVersion, 'id' | 'statement' | 'status'>;
  onDone: (updated: AvatarUnderstandingVersion) => void;
  onDefer: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const input = useId();
  const [text, setText] = useState(pattern.statement);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const decide = (status: 'confirmed' | 'rejected') => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const latest = readAvatarUnderstandings().find((item) => item.id === pattern.id);
      if (!latest || latest.status !== pattern.status || latest.statement !== pattern.statement)
        throw new Error('这条理解已在其他页面更改，请关闭后重新提炼或询问分身。');
      const updated = updateAvatarUnderstandingStatus(pattern.id, status, text);
      if (!updated) throw new Error('决定尚未保存，请重试。');
      onDone(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="pattern-review-dialog"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onDefer();
      }}
    >
      <h2 id={heading}>这像是你的一个模式吗？</h2>
      <p className="pattern-review-dialog__hint">
        这是一条待你判断的理解。你可以认可、修改，或告诉我不符合。
      </p>
      <label htmlFor={input}>用你的话描述</label>
      <textarea
        id={input}
        value={text}
        rows={4}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="pattern-review-dialog__hint">想了解相关经历或适用范围，可以与分身聊聊。</p>
      {error && <p role="alert">{error}</p>}
      <div className="pattern-review-dialog__actions">
        <button type="button" disabled={busy} onClick={onDefer}>
          稍后再说
        </button>
        <button type="button" disabled={busy} onClick={() => decide('rejected')}>
          不认可
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={busy || !text.trim()}
          onClick={() => decide('confirmed')}
        >
          {text.trim() !== pattern.statement ? '保存修正' : '认可'}
        </button>
      </div>
    </dialog>
  );
}
