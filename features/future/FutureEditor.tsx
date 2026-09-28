import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ActionItem } from '../../types';
import type { Goal, Vision, FutureState } from '../../types/future';

export type Editor =
  | { kind: 'vision'; value?: Vision }
  | { kind: 'goal'; value?: Goal; visionId?: string }
  | { kind: 'action'; value?: ActionItem; goalId?: string; scheduledOn?: string };

function Sheet({
  title,
  close,
  children,
  busy,
  opener,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  busy: boolean;
  opener: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (node && !node.open) node.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      node?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <dialog
      className="future-dialog future-editor-screen"
      aria-label={title}
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <button type="button" disabled={busy} onClick={close} aria-label="返回">
          <span aria-hidden="true">←</span>
        </button>
      </header>
      {children}
    </dialog>
  );
}

interface FutureEditorProps {
  editor: Editor;
  state: FutureState;
  opener: HTMLElement | null;
  close: () => void;
  busy: boolean;
  notice: string;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  onKindChange?: (kind: 'vision' | 'goal' | 'action') => void;
  duplicateVision?: Vision | null;
  onContinueExisting?: () => void;
  onSaveDuplicate?: () => void;
  onDelete?: () => void;
}

export function FutureEditor({
  editor,
  state,
  opener,
  close,
  busy,
  notice,
  submit,
  onKindChange,
  duplicateVision,
  onContinueExisting,
  onSaveDuplicate,
  onDelete,
}: FutureEditorProps) {
  const isNewDesign = !editor.value;
  // A fresh vision is the only editor made up of one writing field.  Let that
  // field take the remaining canvas instead of leaving an empty lower half.
  const isSingleWritingSurface = isNewDesign && editor.kind === 'vision';
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const title = editor.kind === 'action' ? '行动规划' : editor.kind === 'goal' ? '目标' : '愿景';

  return (
    <Sheet title={title} close={close} busy={busy} opener={opener}>
      <form
        className={`future-editor-form${isSingleWritingSurface ? ' future-editor-form--single-writing' : ''}`}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          {isNewDesign && onKindChange && (
            <div className="future-kind-picker" role="group" aria-label="规划类型">
              {(
                [
                  ['vision', '愿景'],
                  ['goal', '目标'],
                  ['action', '行动规划'],
                ] as const
              ).map(([kind, label]) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={editor.kind === kind}
                  onClick={() => onKindChange(kind)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {editor.kind === 'vision' && (
            <>
              <label>
                愿景内容
                <textarea name="text" required defaultValue={editor.value?.text} autoFocus />
              </label>
              {editor.value && (
                <label>
                  状态
                  <select name="status" defaultValue={editor.value.status}>
                    <option value="active">进行中</option>
                    <option value="paused">暂停</option>
                    <option value="archived">结束</option>
                  </select>
                </label>
              )}
            </>
          )}

          {editor.kind === 'goal' && (
            <>
              <label>
                目标内容
                <textarea name="title" required defaultValue={editor.value?.title} autoFocus />
              </label>
              <label>
                完成时间（可选）
                <input name="dueDate" type="date" defaultValue={editor.value?.dueDate} />
              </label>
              <label>
                所属愿景（可选）
                <select
                  name="visionId"
                  defaultValue={editor.value?.visionId ?? editor.visionId ?? ''}
                >
                  <option value="">不关联</option>
                  {state.visions
                    .filter(
                      (vision) =>
                        vision.status !== 'archived' || vision.id === editor.value?.visionId,
                    )
                    .map((vision) => (
                      <option key={vision.id} value={vision.id}>
                        {vision.text}
                      </option>
                    ))}
                </select>
              </label>
              {editor.value && (
                <label>
                  状态
                  <select name="status" defaultValue={editor.value.status}>
                    <option value="active">进行中</option>
                    <option value="paused">暂停</option>
                    <option value="completed">已完成</option>
                    <option value="ended">结束</option>
                  </select>
                </label>
              )}
            </>
          )}

          {editor.kind === 'action' && (
            <>
              <label>
                行动内容
                <textarea name="title" required defaultValue={editor.value?.title} autoFocus />
              </label>
              <label>
                计划日期（可选）
                <input
                  name="scheduledOn"
                  type="date"
                  defaultValue={editor.value?.scheduledOn ?? editor.scheduledOn}
                />
              </label>
              <label>
                所属目标（可选）
                <select name="goalId" defaultValue={editor.value?.goalId ?? editor.goalId ?? ''}>
                  <option value="">不关联</option>
                  {state.goals
                    .filter((goal) => goal.status === 'active' || goal.id === editor.value?.goalId)
                    .map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}

          {notice && <p role="alert">{notice}</p>}
          {duplicateVision ? (
            <section className="future-duplicate-vision" role="alert" aria-live="polite">
              <strong>发现相似愿景</strong>
              <p>“{duplicateVision.text}”已经存在，是否继续推进？</p>
              <div className="future-toolbar">
                <button type="button" className="future-primary" onClick={onContinueExisting}>
                  继续已有愿景
                </button>
                <button type="button" onClick={onSaveDuplicate}>
                  仍然保存
                </button>
              </div>
            </section>
          ) : (
            <div className="future-form-submit">
              <button type="submit" className="future-primary">
                {busy ? '保存中…' : '确定'}
              </button>
            </div>
          )}
          {editor.value && onDelete && (
            <div className="future-delete-control">
              {confirmingDelete ? (
                <div className="future-delete-confirmation" role="alert">
                  <p>删除后无法恢复，确定删除吗？</p>
                  <div className="future-toolbar">
                    <button type="button" onClick={() => setConfirmingDelete(false)}>
                      取消
                    </button>
                    <button type="button" className="future-danger" onClick={onDelete}>
                      确认删除
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="future-delete-button" onClick={() => setConfirmingDelete(true)}>
                  删除{title}
                </button>
              )}
            </div>
          )}
        </fieldset>
      </form>
    </Sheet>
  );
}
