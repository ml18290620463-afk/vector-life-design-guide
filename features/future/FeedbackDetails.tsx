import type { ActionItem } from '../../types';
import type { ActionPracticeRecord, GoalFeedbackRecord } from '../../types/future';
import { GoalExecutionResults } from './GoalExecutionResults';
import { GoalReview } from './GoalReview';

export function FeedbackHeading({
  editing,
  hasGoal,
  title,
  onEdit,
}: {
  editing: 'action' | 'goal' | null;
  hasGoal: boolean;
  title?: string;
  onEdit: () => void;
}) {
  return (
    <article className="future-reading-view future-feedback-reading">
      <h2>
        {editing === 'goal' ? '目标判断' : editing ? '补充反馈' : hasGoal ? '目标反馈' : '行动反馈'}
      </h2>
      <p>{title}</p>
      {!hasGoal && !editing && (
        <button type="button" className="future-reading-edit" onClick={onEdit}>
          补充反馈
        </button>
      )}
    </article>
  );
}

export function FeedbackDetails({
  hasGoal,
  records,
  actions,
  currentActions,
  goalRecords,
  onActionEdit,
  onGoalEdit,
}: {
  hasGoal: boolean;
  records: ActionPracticeRecord[];
  actions: ActionItem[];
  currentActions: ActionItem[];
  goalRecords: GoalFeedbackRecord[];
  onActionEdit: (id: string) => void;
  onGoalEdit: () => void;
}) {
  return (
    <>
      <GoalExecutionResults records={records} actions={actions} />
      {hasGoal && (
        <>
          <section className="future-goal-feedback-actions" aria-labelledby="goal-actions-heading">
            <h3 id="goal-actions-heading">当前行动</h3>
            {currentActions.length ? (
              currentActions.map((action) => (
                <div className="future-goal-feedback-action-row" key={action.id}>
                  <div className="future-goal-feedback-action-copy">
                    <strong>{action.title}</strong>
                    <small>{action.status === 'active' ? '进行中' : '待处理'}</small>
                  </div>
                  <button type="button" onClick={() => onActionEdit(action.id)}>
                    补充
                  </button>
                </div>
              ))
            ) : (
              <p className="future-empty">这个目标暂时没有待反馈的行动。</p>
            )}
          </section>
          <GoalReview records={goalRecords} onEdit={onGoalEdit} />
        </>
      )}
    </>
  );
}
