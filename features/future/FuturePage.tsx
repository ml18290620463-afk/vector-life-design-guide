import { FutureSectionTabs } from './FutureSectionTabs';
import { GoalFeedbackFields, GoalFeedbackHeading } from './GoalFeedbackFields';
import { useAIVisibilityChoice } from '../../components/AIVisibilityDialog';
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
type FutureSection = 'design' | 'practice' | 'history';
type PendingVision = Pick<Vision, 'text' | 'status'> &
  Partial<Pick<Vision, 'id' | 'revision' | 'aiVisibility'>>;

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
  onReflectInPast,
  initialActionContext,
  entries,
  principles = [],
  onSelectEntry,
  archiveMode: _archiveMode,
  initialGoalId,
}: FuturePageProps) {
  const { state, actions: allActions, ready, error, refresh, protectedVault } = useFuture();
  const visibility = useAIVisibilityChoice('zh', true);
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
  const practiceScrollY = useRef(0);
  const sectionScrollY = useRef<Record<FutureSection, number>>({
    design: 0,
    practice: 0,
    history: 0,
  });
  const [historyQuery, setHistoryQuery] = useState('');
  const openedGoal = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !initialGoalId || openedGoal.current === initialGoalId) return;
    const value = state.goals.find((goal) => goal.id === initialGoalId);
    if (value) {
      openedGoal.current = initialGoalId;
      editorOpener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setNotice('');
      setDuplicateVision(null);
      setPendingVision(null);
      setEditor({ kind: 'goal', value });
    }
  }, [ready, initialGoalId, state.goals]);
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
      window.scrollTo(0, practiceScrollY.current);
      if (opener?.isConnected) opener.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [practicePanelOpen]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, sectionScrollY.current[section]);
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);
  const switchSection = (next: FutureSection) => {
    if (next === section) return;
    sectionScrollY.current[section] = window.scrollY;
    setSection(next);
  };
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
  const selectedFeedbackAction = allActions.find(
    (action) => action.id === selectedFeedbackActionId,
  );
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

  const savePendingVision = async () => {
    if (!pendingVision) return;
    const aiVisibility = await visibility.request();
    if (aiVisibility) return run(() => saveVision({ ...pendingVision, aiVisibility }), false);
  };

  const submit = async (data: FormData) => {
    if (!editor) return;
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
      const aiVisibility = await visibility.request();
      if (!aiVisibility) return;
      return run(() => saveVision({ ...nextVision, aiVisibility }), false);
    }

    const aiVisibility = await visibility.request();
    if (!aiVisibility) return;

    if (editor.kind === 'goal') {
      const desiredStatus = (field(data, 'status') ||
        editor.value?.status ||
        'active') as Goal['status'];
      return run(async () => {
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
          aiVisibility,
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
      }, false);
    }

    if (editor.kind === 'action') {
      const goalId = field(data, 'goalId') || undefined;
      return run(
        () =>
          saveFutureAction({
            ...editor.context,
            ...editor.value,
            principleId: field(data, 'principleId') || undefined,
            sourceEntryId: field(data, 'sourceEntryId') || undefined,
            evidenceEntryIds: JSON.parse(field(data, 'evidenceEntryIds') || '[]'),
            rationale: field(data, 'rationale') || undefined,
            aiVisibility,
            title: field(data, 'title'),
            status: editor.value?.status ?? 'pending',
            scheduledOn: field(data, 'scheduledOn') || undefined,
            goalId,
            resultIntent: goalId ? 'outcome' : 'preparation',
          }),
        false,
      );
    }
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
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
    const aiVisibility = await visibility.request();
    if (!aiVisibility) return;
    if (goalFeedback) Object.assign(goalFeedback, { aiVisibility });
    const feedbackStatus = practiceStatus;
    const nextStep =
      feedbackStatus === 'completed' || feedbackStatus === 'cancelled' ? 'end' : practiceNextStep;
    void run(
      () =>
        feedbackEnded && goalFeedback
          ? recordGoalFeedback({ ...goalFeedback, occurredOn: localDate() })
          : recordActionPractice({
              aiVisibility,
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
    practiceScrollY.current = window.scrollY;
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
  ) : section === 'history' ? (
    <section className="future-history" aria-label="规划历史">
      <h2>规划历史</h2>
      <p>已完成、已结束的目标与归档愿景。打开后可查看进展或编辑状态重新开启。</p>
      <label>
        搜索历史
        <input
          type="search"
          value={historyQuery}
          onChange={(event) => setHistoryQuery(event.target.value)}
        />
      </label>
      <FutureDesignResults
        visions={newestFirst(
          state.visions.filter(
            (v) => v.status === 'archived' && v.text.includes(historyQuery.trim()),
          ),
        )}
        goals={newestFirst(
          state.goals.filter(
            (g) =>
              ['completed', 'ended'].includes(g.status) && g.title.includes(historyQuery.trim()),
          ),
        )}
        actions={allActions.filter(
          (a) =>
            (a.archivedToPast || ['completed', 'abandoned'].includes(a.status)) &&
            a.title.includes(historyQuery.trim()),
        )}
        onAdd={(kind) => openEditor({ kind })}
        onEditVision={(value) => openEditor({ kind: 'vision', value })}
        onEditGoal={(value) => openEditor({ kind: 'goal', value })}
        onEditAction={(value) => openActionFeedback(value.id)}
      />
    </section>
  ) : section === 'design' ? (
    <FutureDesignResults
      visions={activeVisions}
      goals={activeGoals}
      actions={plannedActions}
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
          latestRecordsByAction={latestPracticeByAction}
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
    </div>
  );

  return (
    <main className="future-page">
      {visibility.dialog}
      <FutureSectionTabs section={section} onChange={switchSection} />
      {content}
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
              onReflect={
                onReflectInPast
                  ? (record) => {
                      closePracticePanel();
                      onReflectInPast({
                        actionId: record.actionId,
                        practiceRecordId: record.id,
                        occurredOn: record.occurredOn,
                        actionTitle: record.actionTitle || selectedFeedbackAction.title,
                        result: record.note,
                        nextStep: record.nextStep,
                      });
                    }
                  : undefined
              }
              onDeletePractice={(id) => void run(() => deleteActionPractice(id), false)}
              onDeleteGoalFeedback={(id) => void run(() => deleteGoalFeedback(id), false)}
            />
          ) : (
            <>
              <GoalFeedbackHeading title={selectedFeedbackAction.title} goal={feedbackGoal} />
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
                <GoalFeedbackFields
                  goal={feedbackGoal}
                  decision={goalDecision}
                  onChange={setGoalDecision}
                />
              </FeedbackEditor>
            </>
          )}
        </dialog>
      )}
      {!practicePanelOpen && !editor && notice && <p role="status">{notice}</p>}
      {editor && !protectedVault && (
        <FutureEditor
          actions={allActions}
          entries={entries}
          principles={principles}
          onSelectEntry={(entry) => {
            closeEditor();
            onSelectEntry(entry);
          }}
          onArchive={() => {
            if (editor.kind === 'vision' && editor.value)
              void run(() => saveVision({ ...editor.value!, status: 'archived' }));
            if (editor.kind === 'goal' && editor.value)
              void run(() => setGoalStatus(editor.value!.id, 'ended', editor.value!.revision));
          }}
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
              void run(() =>
                deleteVision(editor.value!.id, editor.value!.revision, state.revision),
              );
            else if (editor.kind === 'goal')
              void run(() => deleteGoal(editor.value!.id, editor.value!.revision, state.revision));
            else void run(() => deleteFutureAction(editor.value!.id, editor.value!.revision ?? 0));
          }}
        />
      )}
    </main>
  );
}
