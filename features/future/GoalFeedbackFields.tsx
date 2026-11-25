import type { Goal, GoalFeedbackDecision } from '../../types/future';

/** Shared form fields stay inside FeedbackEditor so FormData retains goal progress. */
export function GoalFeedbackFields({
  goal,
  decision,
  onChange,
}: {
  goal?: Goal;
  decision: GoalFeedbackDecision | '';
  onChange: (value: GoalFeedbackDecision | '') => void;
}) {
  if (!goal || !['active', 'paused'].includes(goal.status)) return null;
  return (
    <section className="future-goal-sync">
      <label>
        同步目标完成情况
        <select
          name="goalDecision"
          value={decision}
          onChange={(event) => onChange(event.target.value as GoalFeedbackDecision | '')}
        >
          <option value="">暂不更新</option>
          <option value="continue">继续推进</option>
          <option value="complete">已完成</option>
        </select>
      </label>
      {decision && (
        <label>
          目标进展（可选）
          <textarea name="goalNote" rows={3} />
        </label>
      )}
    </section>
  );
}

export function GoalFeedbackHeading({ title, goal }: { title: string; goal?: Goal }) {
  return (
    <article className="future-editor-heading">
      <h2>{title}</h2>
      {goal && <p className="future-reading-context">目标 · {goal.title}</p>}
    </article>
  );
}
