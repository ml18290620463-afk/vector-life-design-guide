import type { ActionItem } from '../../types';
import type { Goal, ActionPracticeRecord } from '../../types/future';
import { executionTitle, executionStatusLabel } from './GoalExecutionResults';

export function GoalFeedbackList({
  goals,
  actions,
  onOpen,
}: {
  goals: { goal: Goal; records: ActionPracticeRecord[]; pendingCount: number }[];
  actions: ActionItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      {goals.map(({ goal, records, pendingCount }) => (
        <button
          type="button"
          className="future-goal-feedback-row"
          key={goal.id}
          onClick={() => onOpen(goal.id)}
        >
          <span className="future-goal-feedback-summary">
            <strong>{goal.title}</strong>
            {records[0]?.note && (
              <span className="future-feedback-key-result">{records[0].note}</span>
            )}
            <small>
              {records[0]
                ? `${executionTitle(records[0], actions)} · ${executionStatusLabel[records[0].status]}`
                : pendingCount
                  ? `${pendingCount} 项待反馈`
                  : '查看目标反馈'}
              {goal.status === 'completed'
                ? ' · 目标已完成'
                : goal.status === 'ended'
                  ? ' · 目标已结束'
                  : ''}
            </small>
          </span>
          <span className="future-result-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      ))}
    </>
  );
}
