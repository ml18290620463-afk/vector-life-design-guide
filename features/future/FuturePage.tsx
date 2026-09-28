import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ActionItem, DiaryEntry } from '../../types';
import type {
  ActionFeedbackNextStep,
  ActionFeedbackStatus,
  Goal,
  PracticeReflectionContext,
  Vision,
} from '../../types/future';
import { useFuture } from '../../hooks/useFuture';
import {
  deleteFutureAction,
  deleteGoal,
  deleteVision,
  localDate,
  recordActionPractice,
  saveFutureAction,
  saveGoal,
  saveVision,
  setGoalStatus,
} from '../../services/futureRepository';
import type { MobileMainTab } from '../mobile/types';
import { FutureEditor, type Editor } from './FutureEditor';
import { GrowthLoopCompletionDialog } from './GrowthLoopCompletionDialog';
import { FutureDesignResults } from './FutureDesignResults';
import { newestFirst, readableDate, visionSimilarity } from './futureTextRules';
import './future.css';

type FutureSection = 'design' | 'practice';
type PendingVision = Pick<Vision, 'text' | 'status'> & Partial<Pick<Vision, 'id' | 'revision'>>;
type PracticeCompletion = {
  action: ActionItem;
  feedback: {
    status: ActionFeedbackStatus;
    note: string;
    nextStep: ActionFeedbackNextStep;
  };
};

interface FuturePageProps {
  archiveMode?: boolean;
  entries: DiaryEntry[];
  onSelectEntry: (entry: DiaryEntry) => void;
  onNavigateModule?: (tab: MobileMainTab) => void;
  onReflectInPast?: (context: PracticeReflectionContext) => void;
  initialGoalId?: string;
}

const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export function FuturePage({ onNavigateModule, onReflectInPast, ..._props }: FuturePageProps) {
  const { state, actions, ready, error, refresh, protectedVault } = useFuture();
  const [section, setSection] = useState<FutureSection>('design');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFeedbackActionId, setSelectedFeedbackActionId] = useState<string | null>(null);
  const [practiceEditorSource, setPracticeEditorSource] = useState<'pending' | 'continue'>('pending');
  const [practicePanelOpen, setPracticePanelOpen] = useState(false);
  const [practiceStatus, setPracticeStatus] = useState<ActionFeedbackStatus>('completed');
  const [practiceNextStep, setPracticeNextStep] = useState<ActionFeedbackNextStep>('end');
  const [duplicateVision, setDuplicateVision] = useState<Vision | null>(null);
  const [pendingVision, setPendingVision] = useState<PendingVision | null>(null);
  const [completion, setCompletion] = useState<PracticeCompletion | null>(null);
  const saving = useRef(false);
  const editorOpener = useRef<HTMLElement | null>(null);
  const completionOpener = useRef<HTMLElement | null>(null);
  const practiceOpener = useRef<HTMLElement | null>(null);
  const practicePanel = useRef<HTMLDialogElement | null>(null);
  const practiceWasOpen = useRef(false);

  useEffect(() => {
    if (!practicePanelOpen) return;
    practiceWasOpen.current = true;
    const panel = practicePanel.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (panel && !panel.open) panel.showModal();
    const frame = requestAnimationFrame(() => {
      panel?.querySelector<HTMLElement>('[data-practice-autofocus]')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (panel?.open) panel.close();
    };
  }, [practicePanelOpen]);

  useEffect(() => {
    if (practicePanelOpen || !practiceWasOpen.current) return;
    practiceWasOpen.current = false;
    const opener = practiceOpener.current;
    const frame = requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [practicePanelOpen]);

  const openEditor = (next: Editor) => {
    // Switching type or following a duplicate-warning link happens inside the
    // same sheet. Keep the original trigger so Close always returns people to
    // the control that opened the editor, rather than to a button that has
    // just been unmounted with the sheet.
    if (!editor)
      editorOpener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNotice('');
    setDuplicateVision(null);
    setPendingVision(null);
    setEditor(next);
  };

  const closeEditor = () => {
    if (busy) return;
    setEditor(null);
    setDuplicateVision(null);
    setPendingVision(null);
    setNotice('');
  };

  async function run(task: () => Promise<unknown>, close = true) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setNotice('');
    try {
      await task();
      await refresh();
      if (close) closeEditor();
      return true;
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '保存失败，请重试');
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const activeVisions = newestFirst(state.visions.filter((vision) => vision.status !== 'archived'));
  const activeGoals = newestFirst(
    state.goals.filter((goal) => goal.status === 'active' || goal.status === 'paused'),
  );
  const plannedActions = newestFirst(
    actions.filter((action) => action.status === 'pending' || action.status === 'active'),
  );
  const validEvents = [...state.events]
    .filter((event) => event.status === 'valid')
    .sort((left, right) => right.createdAt - left.createdAt);

  const feedbackCandidates = plannedActions.filter((action) => {
    const goal = action.goalId
      ? state.goals.find((candidate) => candidate.id === action.goalId)
      : undefined;
    if (action.goalId && (!goal || goal.status !== 'active')) return false;
    const latestPractice = (state.practiceRecords ?? []).find((record) => record.actionId === action.id);
    const latestFeedback = validEvents.find(
      (event) => event.sourceActionId === action.id && event.actionFeedback,
    );
    if (
      (latestPractice || latestFeedback) &&
      action.reviewedAt &&
      (action.updatedAt ?? 0) <= action.reviewedAt
    )
      return false;
    return (
      action.resultIntent === 'outcome' ||
      Boolean(action.scheduledOn && action.scheduledOn <= localDate())
    );
  });

  const legacyFeedbackResults = validEvents
    .filter((event) => Boolean(event.sourceActionId && event.actionFeedback))
    .map((event) => ({
      event,
      action: actions.find((action) => action.id === event.sourceActionId),
      goal: state.goals.find((goal) => goal.id === event.goalId),
    }))
    .filter((result): result is typeof result & { action: ActionItem; goal?: Goal } =>
      Boolean(result.action),
    );
  const feedbackResults = [
    ...(state.practiceRecords ?? []).map((record) => ({
      id: record.id,
      action: actions.find((action) => action.id === record.actionId),
      note: record.note,
      createdAt: record.createdAt,
    })),
    ...legacyFeedbackResults.map(({ event, action }) => ({
      id: event.id,
      action,
      note: event.actionFeedback!.note,
      createdAt: event.createdAt,
    })),
  ]
    .filter((result): result is typeof result & { action: ActionItem } => Boolean(result.action))
    .sort((left, right) => right.createdAt - left.createdAt);

  const practiceRecords = state.practiceRecords ?? [];
  const latestPracticeFor = (actionId: string) =>
    practiceRecords
      .filter((record) => record.actionId === actionId)
      .sort((left, right) => right.createdAt - left.createdAt)[0];
  const continuableActions = plannedActions.filter((action) => {
    if (action.status !== 'active') return false;
    const latest = latestPracticeFor(action.id);
    return Boolean(latest && (latest.nextStep === 'continue' || latest.nextStep === 'adjust'));
  });
  const isLatestPractice = (recordId: string, actionId: string) =>
    latestPracticeFor(actionId)?.id === recordId;
  const selectedFeedbackAction = actions.find((action) => action.id === selectedFeedbackActionId);
  const selectedFeedbackGoal = selectedFeedbackAction?.goalId
    ? state.goals.find((goal) => goal.id === selectedFeedbackAction.goalId)
    : undefined;

  const savePendingVision = () => {
    if (!pendingVision) return;
    void run(() => saveVision(pendingVision));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const data = new FormData(event.currentTarget);

    if (editor.kind === 'vision') {
      const nextVision: PendingVision = {
        ...editor.value,
        text: field(data, 'text'),
        status: (field(data, 'status') || 'active') as Vision['status'],
      };
      const duplicate = state.visions
        .filter((vision) => vision.id !== editor.value?.id)
        .map((vision) => ({ vision, score: visionSimilarity(nextVision.text, vision.text) }))
        .sort((left, right) => right.score - left.score)
        .find(({ score }) => score >= 0.82)?.vision;
      if (duplicate) {
        setPendingVision(nextVision);
        setDuplicateVision(duplicate);
        setNotice('');
        return;
      }
      void run(() => saveVision(nextVision));
      return;
    }

    if (editor.kind === 'goal') {
      const desiredStatus = (field(data, 'status') || editor.value?.status || 'active') as Goal['status'];
      void run(async () => {
        let current = editor.value;
        // A completed or ended goal must be reopened before it can be edited.
        // Do that transition first so the following content save always operates
        // on the current lifecycle revision.
        if (
          current &&
          current.status !== desiredStatus &&
          (current.status === 'completed' || current.status === 'ended')
        )
          current = (await setGoalStatus(current.id, desiredStatus, current.revision)).goal;
        const saved = await saveGoal({
          ...current,
          title: field(data, 'title'),
          status: current?.status ?? 'active',
          visionId: field(data, 'visionId') || undefined,
          startDate: current?.startDate,
          dueDate: field(data, 'dueDate') || undefined,
          tags: current?.tags ?? [],
          measurement: current?.measurement ?? { kind: 'narrative' },
        });
        if (saved.status !== desiredStatus)
          await setGoalStatus(saved.id, desiredStatus, saved.revision);
      });
      return;
    }

    if (editor.kind === 'action') {
      const goalId = field(data, 'goalId') || undefined;
      void run(() =>
        saveFutureAction({
          ...editor.value,
          title: field(data, 'title'),
          status: editor.value?.status ?? 'pending',
          scheduledOn: field(data, 'scheduledOn') || undefined,
          goalId,
          resultIntent: goalId ? 'outcome' : 'preparation',
        }),
      );
      return;
    }
  };

  const submitFeedback = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFeedbackAction) return;
    const data = new FormData(event.currentTarget);
    const feedbackStatus = practiceStatus;
    const nextStep = practiceNextStep;
    const note = field(data, 'note');
    const savedAction = selectedFeedbackAction;
    const savedFeedback = { status: feedbackStatus, note, nextStep };
    completionOpener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void run(
      () =>
        recordActionPractice({
          occurredOn: localDate(),
          actionId: selectedFeedbackAction.id,
          expectedActionRevision: selectedFeedbackAction.revision ?? 0,
          status: feedbackStatus,
          note,
          nextStep,
        }),
      false,
    ).then((saved) => {
      if (saved) {
        setSelectedFeedbackActionId(null);
        setPracticePanelOpen(false);
        setCompletion({ action: savedAction, feedback: savedFeedback });
      }
    });
  };

  const content: ReactNode = protectedVault ? (
    <section className="future-empty-state">
      <h2>资料库已锁定</h2>
      <p>解锁后可查看未来规划。</p>
    </section>
  ) : error ? (
    <p role="alert">{error}</p>
  ) : !ready ? (
    <p className="future-empty">正在读取…</p>
  ) : section === 'design' ? (
    <FutureDesignResults
      visions={activeVisions}
      goals={activeGoals}
      actions={plannedActions}
      onOpenEditor={() => openEditor({ kind: 'vision' })}
      onEditVision={(value) => openEditor({ kind: 'vision', value })}
      onEditGoal={(value) => openEditor({ kind: 'goal', value })}
      onEditAction={(value) => openEditor({ kind: 'action', value })}
    />
  ) : (
    <div className="future-practice-workspace">
      <section className="future-practice-records" aria-labelledby="practice-records-heading">
        <header className="future-section-header future-practice-header">
          <div>
            <h2 id="practice-records-heading">践行记录</h2>
            <small>{feedbackResults.length} 条</small>
          </div>
          {feedbackCandidates.length > 0 && (
            <button
              type="button"
              className="future-pending-entry"
              onClick={() => {
                practiceOpener.current =
                  document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setNotice('');
                setPracticeEditorSource('pending');
                setSelectedFeedbackActionId(null);
                setPracticePanelOpen(true);
              }}
            >
              待检视 {feedbackCandidates.length} <span aria-hidden="true">›</span>
            </button>
          )}
        </header>
        {feedbackResults.length ? (
          <div className="future-feedback-list">
          {feedbackResults.map(({ id, action, note }) => (
              <article className="future-feedback-result" key={id}>
                <strong>{action.title}</strong>
                <p>{note}</p>
                {continuableActions.some((candidate) => candidate.id === action.id) &&
                  isLatestPractice(id, action.id) && (
                    <button
                      type="button"
                      className="future-continue-practice"
                      onClick={() => {
                        practiceOpener.current =
                          document.activeElement instanceof HTMLElement ? document.activeElement : null;
                        setNotice('');
                        setPracticeEditorSource('continue');
                        setPracticeStatus('completed');
                        setPracticeNextStep('end');
                        setSelectedFeedbackActionId(action.id);
                        setPracticePanelOpen(true);
                      }}
                    >
                      继续记录
                    </button>
                  )}
              </article>
            ))}
          </div>
        ) : (
          <div className="future-empty-state future-practice-empty">
            <p>{feedbackCandidates.length ? '完成待检视行动后，记录会在这里出现。' : '先规划一个行动，再在这里留下真实进展。'}</p>
            {!feedbackCandidates.length && (
              <button type="button" className="future-empty-action" onClick={() => setSection('design')}>
                去设计行动
              </button>
            )}
          </div>
        )}
      </section>

      {practicePanelOpen && (
          <dialog
            ref={practicePanel}
            className="future-practice-panel"
            aria-labelledby="practice-panel-heading"
            onCancel={(event) => {
              event.preventDefault();
              if (busy) return;
              setNotice('');
              if (selectedFeedbackActionId) {
                if (practiceEditorSource === 'continue') setPracticePanelOpen(false);
                setSelectedFeedbackActionId(null);
                return;
              }
              setPracticePanelOpen(false);
            }}
          >
            <header className="future-section-header">
              <h2 id="practice-panel-heading">
                {selectedFeedbackAction ? '行动记录' : '待检视'}
              </h2>
              <button
                type="button"
                data-practice-autofocus={!selectedFeedbackAction || undefined}
                onClick={() => {
                  setSelectedFeedbackActionId(null);
                  setPracticePanelOpen(false);
                  setNotice('');
                }}
              >
                关闭
              </button>
            </header>

            {!selectedFeedbackAction ? (
              feedbackCandidates.length ? (
                <div className="future-feedback-list">
                  {feedbackCandidates.map((action) => {
                    const goal = state.goals.find((candidate) => candidate.id === action.goalId);
                    return (
                      <button
                        type="button"
                        data-practice-autofocus={undefined}
                        className="future-feedback-row"
                        key={action.id}
                        onClick={() => {
                          setNotice('');
                          setPracticeEditorSource('pending');
                          setPracticeStatus('completed');
                          setPracticeNextStep('end');
                          setSelectedFeedbackActionId(action.id);
                        }}
                      >
                        <span>
                          <strong>{action.title}</strong>
                          <small>{goal ? goal.title : '独立行动'}</small>
                        </span>
                        <time>{readableDate(action.scheduledOn)}</time>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="future-empty">暂无待检视行动</p>
              )
            ) : selectedFeedbackAction ? (
              <form className="future-feedback-editor" onSubmit={submitFeedback} key={selectedFeedbackAction.id}>
                <fieldset disabled={busy}>
                  <button
                    type="button"
                    className="future-back"
                    onClick={() => {
                      setNotice('');
                      if (practiceEditorSource === 'continue') setPracticePanelOpen(false);
                      setSelectedFeedbackActionId(null);
                    }}
                  >
                    {practiceEditorSource === 'continue' ? '‹ 返回践行' : '‹ 返回待检视'}
                  </button>
                  <div className="future-feedback-context">
                    <span>当前行动</span>
                    <strong>{selectedFeedbackAction.title}</strong>
                    <small>{selectedFeedbackGoal ? `所属目标 · ${selectedFeedbackGoal.title}` : '独立行动'}</small>
                  </div>
                  <label>
                    状态
                    <select
                      name="feedbackStatus"
                      value={practiceStatus}
                      autoFocus
                      onChange={(event) => {
                        const status = event.target.value as ActionFeedbackStatus;
                        setPracticeStatus(status);
                        if (status === 'completed' || status === 'cancelled') setPracticeNextStep('end');
                      }}
                    >
                      <option value="completed">已完成</option>
                      <option value="partial">有进展</option>
                      <option value="not_completed">尚未完成</option>
                      <option value="cancelled">不再继续</option>
                    </select>
                  </label>
                  <label>
                    实际情况
                    <textarea name="note" required />
                  </label>
                  <label>
                    下一步
                    <select
                      name="nextStep"
                      value={practiceNextStep}
                      disabled={practiceStatus === 'completed' || practiceStatus === 'cancelled'}
                      onChange={(event) =>
                        setPracticeNextStep(event.target.value as ActionFeedbackNextStep)
                      }
                    >
                      {(practiceStatus === 'completed' || practiceStatus === 'cancelled') ? (
                        <option value="end">结束行动</option>
                      ) : (
                        <>
                          <option value="continue">继续完成</option>
                          <option value="adjust">调整后再做</option>
                          <option value="pause">暂不安排</option>
                          <option value="end">结束行动</option>
                        </>
                      )}
                    </select>
                  </label>
                  {notice && <p role="alert">{notice}</p>}
                  <div className="future-feedback-submit">
                    <button type="submit" className="future-primary">
                      {busy ? '保存中…' : '保存记录'}
                    </button>
                  </div>
                </fieldset>
              </form>
            ) : null}
          </dialog>
      )}
    </div>
  );

  return (
    <main className="future-page">
      <div className="future-primary-tabs" role="tablist" aria-label="未来分区">
        {(['design', 'practice'] as const).map((value) => (
          <button
            type="button"
            role="tab"
            key={value}
            aria-selected={section === value}
            onClick={() => setSection(value)}
          >
            {value === 'design' ? '设计' : '践行'}
          </button>
        ))}
      </div>
      {content}
      {editor && !protectedVault && (
        <FutureEditor
          key={`${editor.kind}:${editor.value?.id ?? 'new'}`}
          editor={editor}
          state={state}
          opener={editorOpener.current}
          close={closeEditor}
          busy={busy}
          notice={notice}
          submit={submit}
          onKindChange={(kind) => openEditor({ kind })}
          duplicateVision={duplicateVision}
          onContinueExisting={() => {
            if (duplicateVision) openEditor({ kind: 'vision', value: duplicateVision });
          }}
          onSaveDuplicate={savePendingVision}
          onDelete={() => {
            if (!editor.value) return;
            if (editor.kind === 'vision')
              void run(() => deleteVision(editor.value!.id, editor.value!.revision));
            else if (editor.kind === 'goal')
              void run(() => deleteGoal(editor.value!.id, editor.value!.revision));
            else void run(() => deleteFutureAction(editor.value!.id, editor.value!.revision ?? 0));
          }}
        />
      )}
      {completion && !protectedVault && (
        <GrowthLoopCompletionDialog
          action={completion.action}
          feedback={completion.feedback}
          opener={completionOpener.current}
          onClose={() => setCompletion(null)}
          onNavigateModule={onNavigateModule}
          onReflectInPast={onReflectInPast}
        />
      )}
    </main>
  );
}
