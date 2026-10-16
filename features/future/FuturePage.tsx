import { ActionFeedbackList } from './ActionFeedbackList';
import { ActionFeedbackReading } from './ActionFeedbackReading';
import { FeedbackEditor } from './FeedbackEditor';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { DiaryEntry, ExperienceFeedbackOutcome, Principle } from '../../types';
import type {
  ActionFeedbackNextStep,
  ActionFeedbackStatus,
  ActionDraftContext,
  Goal,
  GoalFeedbackDecision,
  PracticeReflectionContext,
  Vision,
} from '../../types/future';
import { useFuture } from '../../hooks/useFuture';
import {
  deleteFutureAction,
  deleteFutureActions,
  deleteActionPractice,
  deleteGoalFeedback,
  deleteGoal,
  deleteVision,
  localDate,
  recordActionPractice,
  recordGoalFeedback,
  saveFutureAction,
  saveGoal,
  saveVision,
  setGoalStatus,
} from '../../services/futureRepository';
import type { MobileMainTab } from '../mobile/types';
import { FutureEditor, type Editor } from './FutureEditor';
import { FutureDesignResults } from './FutureDesignResults';
import {
  latestPracticesByAction,
  newestFirst,
  prioritizedActionItems,
  visionSimilarity,
} from './futureTextRules';
import './future.css';
type FutureSection = 'design' | 'practice';
type PendingVision = Pick<Vision, 'text' | 'status'> & Partial<Pick<Vision, 'id' | 'revision'>>;

interface FuturePageProps {
  archiveMode?: boolean;
  entries: DiaryEntry[];
  onSelectEntry: (entry: DiaryEntry) => void;
  onNavigateModule?: (tab: MobileMainTab) => void;
  onReflectInPast?: (context: PracticeReflectionContext) => void;
  initialGoalId?: string;
  initialActionContext?: ActionDraftContext | null;
  principles?: Principle[];
}
const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export function FuturePage({
  onNavigateModule: _onNavigateModule,
  onReflectInPast: _onReflectInPast,
  initialActionContext,
  entries: _entries,
  principles = [],
  onSelectEntry: _onSelectEntry,
  archiveMode: _archiveMode,
  initialGoalId: _initialGoalId,
}: FuturePageProps) {
  const { state, actions: allActions, ready, error, refresh, protectedVault } = useFuture();
  const [section, setSection] = useState<FutureSection>('design');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFeedbackActionId, setSelectedFeedbackActionId] = useState<string | null>(null);
  const [goalDecision, setGoalDecision] = useState<GoalFeedbackDecision | ''>('');
  const actions = allActions.filter((action) => !action.archivedToPast);
  const [practicePanelOpen, setPracticePanelOpen] = useState(false);
  const [practiceEditing, setPracticeEditing] = useState(false);
  const [practiceStatus, setPracticeStatus] = useState<ActionFeedbackStatus>('completed');
  const [practiceNextStep, setPracticeNextStep] = useState<ActionFeedbackNextStep>('end');
  const [practicePrincipleOutcome, setPracticePrincipleOutcome] = useState<
    ExperienceFeedbackOutcome | ''
  >('');
  const [duplicateVision, setDuplicateVision] = useState<Vision | null>(null);
  const [pendingVision, setPendingVision] = useState<PendingVision | null>(null);
  const saving = useRef(false);
  const editorOpener = useRef<HTMLElement | null>(null);
  const practiceOpener = useRef<HTMLElement | null>(null);
  const practicePanel = useRef<HTMLDialogElement | null>(null);
  const practiceWasOpen = useRef(false);
  const openedActionContext = useRef<ActionDraftContext | null>(null);
  // `openEditor` intentionally changes identity on render; the context is a
  // one-shot cross-module handoff and must not reopen after it has been closed.
  useEffect(() => {
    if (!initialActionContext || openedActionContext.current === initialActionContext) return;
    openedActionContext.current = initialActionContext;
    openEditor({ kind: 'action', context: initialActionContext });
  }, [initialActionContext]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const practiceRecords = state.practiceRecords ?? [];
  const latestPracticeByAction = latestPracticesByAction(practiceRecords);
  const plannedActions = prioritizedActionItems(
    actions.filter((action) => action.status === 'pending' || action.status === 'active'),
    state.goals,
    latestPracticeByAction,
    localDate(),
  );
  const selectedFeedbackAction = actions.find((action) => action.id === selectedFeedbackActionId);
  const feedbackGoal = state.goals.find((goal) => goal.id === selectedFeedbackAction?.goalId);
  const feedbackVision = state.visions.find((vision) => vision.id === feedbackGoal?.visionId);
  const goalRecords = (state.goalFeedbackRecords ?? [])
    .filter((record) => record.goalId === feedbackGoal?.id)
    .sort((left, right) => right.createdAt - left.createdAt);
  const selectedFeedbackPrinciple = selectedFeedbackAction?.principleId
    ? principles.find((principle) => principle.id === selectedFeedbackAction.principleId)
    : undefined;
  const feedbackEnded =
    selectedFeedbackAction?.status === 'abandoned' ||
    (selectedFeedbackAction?.status === 'completed' &&
      latestPracticeByAction[selectedFeedbackAction.id]?.completionDestination !== 'long_term') ||
    Boolean(selectedFeedbackAction?.archivedToPast);
  const selectedActionRecords = practiceRecords
    .filter((record) => record.actionId === selectedFeedbackActionId)
    .sort((left, right) => right.createdAt - left.createdAt);

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
      const desiredStatus = (field(data, 'status') ||
        editor.value?.status ||
        'active') as Goal['status'];
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
          ...editor.context,
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
    const goalFeedback =
      feedbackGoal && goalDecision
        ? {
            goalId: feedbackGoal.id,
            expectedGoalRevision: feedbackGoal.revision,
            decision: goalDecision,
            note: field(data, 'goalNote'),
          }
        : undefined;
    if (feedbackEnded && !goalFeedback) return;
    const feedbackStatus = practiceStatus;
    const nextStep =
      feedbackStatus === 'completed' || feedbackStatus === 'cancelled' ? 'end' : practiceNextStep;
    void run(
      () =>
        feedbackEnded && goalFeedback
          ? recordGoalFeedback({ ...goalFeedback, occurredOn: localDate() })
          : recordActionPractice({
              goalFeedback,
              occurredOn: localDate(),
              actionId: selectedFeedbackAction.id,
              expectedActionRevision: selectedFeedbackAction.revision ?? 0,
              status: feedbackStatus,
              completionDestination:
                feedbackStatus === 'completed'
                  ? (field(data, 'completionDestination') as 'long_term' | 'past')
                  : undefined,
              note: field(data, 'note'),
              nextStep,
              nextAction: nextStep === 'adjust' ? field(data, 'nextAction') : undefined,
              principleFeedback:
                selectedFeedbackPrinciple && practicePrincipleOutcome
                  ? { principleId: selectedFeedbackPrinciple.id, outcome: practicePrincipleOutcome }
                  : undefined,
            }),
      false,
    ).then((saved) => {
      if (saved) {
        setSelectedFeedbackActionId(null);
        setPracticePanelOpen(false);
        setNotice(feedbackEnded ? '目标进展已保存' : '行动反馈已保存');
      }
    });
  };

  const closePracticePanel = () => {
    if (busy) return;
    setSelectedFeedbackActionId(null);
    setPracticePanelOpen(false);
    setNotice('');
  };

  const openActionFeedback = (actionId: string) => {
    practiceOpener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNotice('');
    setPracticeStatus('completed');
    setPracticeNextStep('end');
    setPracticePrincipleOutcome('');
    setGoalDecision('');
    setPracticeEditing(false);
    setSelectedFeedbackActionId(actionId);
    setPracticePanelOpen(true);
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
      latestPracticeByAction={latestPracticeByAction}
      onAdd={(kind) => openEditor({ kind })}
      onEditVision={(value) => openEditor({ kind: 'vision', value })}
      onEditGoal={(value) => openEditor({ kind: 'goal', value })}
      onEditAction={(value) => openEditor({ kind: 'action', value })}
    />
  ) : (
    <div className="future-practice-workspace">
      <section className="future-practice-records" aria-labelledby="practice-records-heading">
        <header className="future-section-header future-practice-header">
          <div>
            <h2 id="practice-records-heading">反馈</h2>
          </div>
        </header>
        <ActionFeedbackList
          actions={actions}
          goals={state.goals}
          onOpen={openActionFeedback}
          onDelete={(selected) =>
            run(
              () =>
                deleteFutureActions(
                  selected.map((action) => ({ id: action.id, revision: action.revision })),
                ),
              false,
            )
          }
        />
      </section>

      {practicePanelOpen && selectedFeedbackAction && (
        <dialog
          ref={practicePanel}
          className="future-dialog future-editor-screen future-practice-panel"
          aria-label={selectedFeedbackAction.title}
          onCancel={(event) => {
            event.preventDefault();
            closePracticePanel();
          }}
        >
          <header>
            <button
              type="button"
              aria-label="返回"
              data-practice-autofocus
              disabled={busy}
              onClick={() => {
                if (practiceEditing) {
                  setPracticeEditing(false);
                  setNotice('');
                  setGoalDecision('');
                  setPracticeStatus('completed');
                  setPracticeNextStep('end');
                  setPracticePrincipleOutcome('');
                } else closePracticePanel();
              }}
            >
              <span aria-hidden="true">←</span>
            </button>
          </header>
          {!practiceEditing ? (
            <ActionFeedbackReading
              action={selectedFeedbackAction}
              records={selectedActionRecords}
              goal={feedbackGoal}
              vision={feedbackVision}
              goalRecords={goalRecords}
              canUpdate={
                !feedbackEnded ||
                Boolean(feedbackGoal && ['active', 'paused'].includes(feedbackGoal.status))
              }
              onUpdate={() => setPracticeEditing(true)}
              onDeletePractice={(id) => void run(() => deleteActionPractice(id), false)}
              onDeleteGoalFeedback={(id) => void run(() => deleteGoalFeedback(id), false)}
            />
          ) : (
            <>
              <article className="future-editor-heading">
                <h2>{selectedFeedbackAction.title}</h2>
                {feedbackGoal && (
                  <p className="future-reading-context">目标 · {feedbackGoal.title}</p>
                )}
              </article>
              <FeedbackEditor
                key={selectedFeedbackAction.id}
                busy={busy}
                saveDisabled={feedbackEnded && !goalDecision}
                notice={notice}
                onSubmit={submitFeedback}
                actionFields={
                  feedbackEnded
                    ? undefined
                    : {
                        status: practiceStatus,
                        nextStep: practiceNextStep,
                        setStatus: setPracticeStatus,
                        setNextStep: setPracticeNextStep,
                        principle: selectedFeedbackPrinciple,
                        principleOutcome: practicePrincipleOutcome,
                        setPrincipleOutcome: setPracticePrincipleOutcome,
                      }
                }
              >
                {feedbackGoal && ['active', 'paused'].includes(feedbackGoal.status) && (
                  <section className="future-goal-sync">
                    <label>
                      同步目标完成情况
                      <select
                        name="goalDecision"
                        value={goalDecision}
                        onChange={(event) =>
                          setGoalDecision(event.target.value as GoalFeedbackDecision | '')
                        }
                      >
                        <option value="">暂不更新</option>
                        <option value="continue">继续推进</option>
                        <option value="complete">已完成</option>
                      </select>
                    </label>
                    {goalDecision && (
                      <label>
                        目标进展（可选）
                        <textarea name="goalNote" rows={3} />
                      </label>
                    )}
                  </section>
                )}
              </FeedbackEditor>
            </>
          )}
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
            {value === 'design' ? '设计' : '反馈'}
          </button>
        ))}
      </div>
      {content}
      {!practicePanelOpen && !editor && notice && <p role="status">{notice}</p>}
      {editor && !protectedVault && (
        <FutureEditor
          actions={actions}
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
    </main>
  );
}
