import { useFutureFormDraft } from './useFutureFormDraft';
import { useEditorViewport } from '../../hooks/useEditorViewport';
import { GoalExecutionResults, goalExecutionRecords } from './GoalExecutionResults';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { ActionItem, DiaryEntry, Principle } from '../../types';
import type { ActionDraftContext, Goal, Vision, FutureState } from '../../types/future';
import { SilkButton } from '../../components/silk/SilkButton';
import { SilkSegmentedTabs } from '../../components/silk/SilkSegmentedTabs';
import { SilkFocusIsland } from '../../components/silk/SilkFocusIsland';

export type Editor =
  | { kind: 'vision'; value?: Vision }
  | { kind: 'goal'; value?: Goal; visionId?: string }
  | {
      kind: 'action';
      value?: ActionItem;
      goalId?: string;
      scheduledOn?: string;
      context?: ActionDraftContext;
    };

function Sheet({
  title,
  close,
  children,
  busy,
  opener,
  saveAction,
}: {
  saveAction?: ReactNode;
  title: string;
  close: () => void;
  children: ReactNode;
  busy: boolean;
  opener: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEditorViewport(dialog);

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
        {saveAction}
      </header>
      {children}
    </dialog>
  );
}

interface FutureEditorProps {
  actions?: ActionItem[];
  entries?: DiaryEntry[];
  principles?: Principle[];
  onSelectEntry?: (entry: DiaryEntry) => void;
  onArchive?: () => void;
  editor: Editor;
  state: FutureState;
  opener: HTMLElement | null;
  close: () => void;
  busy: boolean;
  notice: string;
  submit: (data: FormData) => Promise<boolean | void> | boolean | void;
  onKindChange?: (kind: 'vision' | 'goal' | 'action') => void;
  duplicateVision?: Vision | null;
  onContinueExisting?: () => void;
  onSaveDuplicate?: () => Promise<boolean | void> | boolean | void;
  onDelete?: () => void;
}

export function FutureEditor({
  actions = [],
  entries = [],
  principles = [],
  onSelectEntry,
  onArchive,
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
  const [editing, setEditing] = useState(!editor.value);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useFutureFormDraft(`${editor.kind}:${editor.value?.id ?? 'new'}`, editing, formRef);
  const initialValues = useRef('');
  const [dirty, setDirty] = useState(false);
  const snapshot = (form: HTMLFormElement) =>
    JSON.stringify(Array.from(new FormData(form).entries()));
  useEffect(() => {
    if (formRef.current) initialValues.current = snapshot(formRef.current);
  }, [editing]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const leave = (action: () => void) => {
    if (busy) return;
    if (
      !dirty ||
      window.confirm('内容尚未保存为正式规划。离开后可重新打开同类规划继续草稿，确定返回吗？')
    )
      action();
  };

  const affectedGoals = state.goals.filter((g) =>
    editor.kind === 'vision'
      ? g.visionId === editor.value?.id
      : editor.kind === 'goal' && g.id === editor.value?.id,
  );
  const affectedActions = actions.filter((a) =>
    editor.kind === 'action'
      ? a.id === editor.value?.id
      : affectedGoals.some((g) => g.id === a.goalId),
  );
  const feedbackCount =
    (state.practiceRecords ?? []).filter((r) => affectedActions.some((a) => a.id === r.actionId))
      .length +
    (state.goalFeedbackRecords ?? []).filter((r) => affectedGoals.some((g) => g.id === r.goalId))
      .length;
  const title = editor.kind === 'action' ? '行动规划' : editor.kind === 'goal' ? '目标' : '愿景';

  if (!editing && editor.value) {
    const content = editor.kind === 'vision' ? editor.value.text : editor.value.title;
    const direction =
      editor.kind === 'goal'
        ? state.visions.find((vision) => vision.id === editor.value?.visionId)?.text
        : editor.kind === 'action'
          ? state.goals.find((goal) => goal.id === editor.value?.goalId)?.title
          : undefined;
    const date =
      editor.kind === 'goal'
        ? editor.value.dueDate
        : editor.kind === 'action'
          ? editor.value.scheduledOn
          : undefined;
    return (
      <Sheet title={title} close={close} busy={busy} opener={opener}>
        <article className="future-reading-view">
          <h2>{title}</h2>
          <p>{content}</p>
          {direction && (
            <p className="future-reading-context">
              <span>{editor.kind === 'goal' ? '所属愿景' : '所属目标'} · </span>
              {direction}
            </p>
          )}
          {date && (
            <p className="future-reading-context">
              {editor.kind === 'goal' ? '完成时间' : '计划日期'} · {date.replaceAll('-', '.')}
            </p>
          )}
          <button type="button" className="future-reading-edit" onClick={() => setEditing(true)}>
            编辑
          </button>
          {editor.kind === 'action' && (
            <section aria-label="行动来源">
              {editor.value.principleId && (
                <p>
                  实践原则：
                  {principles.find((p) => p.id === editor.value?.principleId)?.text ??
                    '来源原则已不可用'}
                </p>
              )}
              {Array.from(
                new Set(
                  [editor.value.sourceEntryId, ...(editor.value.evidenceEntryIds ?? [])].filter(
                    Boolean,
                  ),
                ),
              ).map((id) => {
                const entry = entries.find((e) => e.id === id);
                return (
                  <p key={id}>
                    {entry ? (
                      <button type="button" onClick={() => onSelectEntry?.(entry)}>
                        查看来源经历：{entry.title || '未命名记录'}
                      </button>
                    ) : (
                      '来源经历已删除或不可访问'
                    )}
                  </p>
                );
              })}
            </section>
          )}
          {editor.kind === 'goal' && (
            <details className="future-action-drawer">
              <summary>执行进展</summary>
              <GoalExecutionResults
                records={goalExecutionRecords(
                  editor.value.id,
                  state.practiceRecords ?? [],
                  actions,
                )}
                actions={actions.filter((action) => action.goalId === editor.value?.id)}
              />
            </details>
          )}
        </article>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={title}
      close={() => leave(close)}
      busy={busy}
      opener={opener}
      saveAction={
        !duplicateVision && (
          <SilkButton
            type="submit"
            form={formId}
            variant="primary"
            className="future-editor-save"
            disabled={busy || !draft.ready}
            aria-busy={busy}
          >
            {busy ? '保存中…' : '保存'}
          </SilkButton>
        )
      }
    >
      <form
        id={formId}
        ref={formRef}
        onChange={() => {
          if (formRef.current) setDirty(snapshot(formRef.current) !== initialValues.current);
          draft.changed();
        }}
        className={`future-editor-form${isSingleWritingSurface ? ' future-editor-form--single-writing' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void draft
            .finish(() => submit(data))
            .then((saved) => {
              if (saved) close();
            });
        }}
      >
        {draft.loadFailed && (
          <button type="button" onClick={draft.retry}>
            重新读取草稿
          </button>
        )}
        <p role="status">{draft.message || (!draft.ready ? '正在读取加密草稿…' : '')}</p>
        <fieldset disabled={busy || !draft.ready || draft.saved}>
          {editor.kind === 'action' && (
            <>
              <input
                type="hidden"
                name="principleId"
                defaultValue={editor.context?.principleId ?? editor.value?.principleId ?? ''}
              />
              <input
                type="hidden"
                name="sourceEntryId"
                defaultValue={editor.context?.sourceEntryId ?? editor.value?.sourceEntryId ?? ''}
              />
              <input
                type="hidden"
                name="evidenceEntryIds"
                defaultValue={JSON.stringify(
                  editor.context?.evidenceEntryIds ?? editor.value?.evidenceEntryIds ?? [],
                )}
              />
              <input
                type="hidden"
                name="rationale"
                defaultValue={editor.context?.rationale ?? editor.value?.rationale ?? ''}
              />
            </>
          )}
          {isNewDesign && onKindChange && (
            <SilkSegmentedTabs
              className="future-kind-picker"
              label="规划类型"
              tabs={[{ id: 'vision', label: '愿景' }, { id: 'goal', label: '目标' }, { id: 'action', label: '行动规划' }]}
              value={editor.kind}
              onChange={(kind) => { if (kind !== editor.kind) leave(() => onKindChange(kind)); }}
            />
          )}

          {editor.kind === 'vision' && (
            <>
              <SilkFocusIsland><label>
                愿景内容
                <textarea name="text" required defaultValue={editor.value?.text} autoFocus />
              </label></SilkFocusIsland>
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
              <details className="future-optional-fields">
                <summary>时间与关联（可选）</summary>
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
              </details>
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
              {editor.context?.rationale && (
                <p className="future-action-context" role="status">
                  行动依据：{editor.context.rationale}
                </p>
              )}
              <label>
                行动内容
                <textarea name="title" required defaultValue={editor.value?.title} autoFocus />
              </label>
              <details>
                <summary>可选设置</summary>
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
                      .filter(
                        (goal) => goal.status === 'active' || goal.id === editor.value?.goalId,
                      )
                      .map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                  </select>
                </label>
              </details>
            </>
          )}

          {notice && <p role="alert">{notice}</p>}
          {duplicateVision ? (
            <section className="future-duplicate-vision" role="alert" aria-live="polite">
              <strong>发现相似愿景</strong>
              <p>“{duplicateVision.text}”已经存在，是否继续推进？</p>
              <div className="future-toolbar">
                <SilkButton type="button" variant="primary" onClick={onContinueExisting}>
                  继续已有愿景
                </SilkButton>
                <button
                  type="button"
                  onClick={() =>
                    void draft
                      .finish(() => onSaveDuplicate?.())
                      .then((saved) => {
                        if (saved) close();
                      })
                  }
                >
                  仍然保存
                </button>
              </div>
            </section>
          ) : null}
          {editor.value && onDelete && (
            <>
              {editor.kind !== 'action' && onArchive && (
                <div className="future-delete-control">
                  <button type="button" onClick={onArchive}>
                    归档并保留历史
                  </button>
                  <p>愿景归档不改变子目标状态；目标归档会结束目标，保留关联行动与反馈。</p>
                </div>
              )}
              <div className="future-delete-control">
                {confirmingDelete ? (
                  <div className="future-delete-confirmation" role="alert">
                    <p>
                      永久删除后无法恢复。本次影响 {affectedGoals.length} 个目标、
                      {affectedActions.length} 个行动、{feedbackCount}{' '}
                      条反馈，以及这些目标的成果与修订历史。
                    </p>
                    <ul>
                      {affectedGoals.map((g) => (
                        <li key={g.id}>目标：{g.title}</li>
                      ))}
                      {affectedActions.map((a) => (
                        <li key={a.id}>行动：{a.title}</li>
                      ))}
                    </ul>
                    <p>普通经历原文保留。若只想结束规划，请取消并选择归档保留历史。</p>
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
                  <button
                    type="button"
                    className="future-delete-button"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    删除{title}
                  </button>
                )}
              </div>
            </>
          )}
        </fieldset>
      </form>
    </Sheet>
  );
}
