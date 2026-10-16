import type { GoalFeedbackDecision } from '../../types/future';

interface GoalFeedbackFieldsProps {
  decision: GoalFeedbackDecision;
  setDecision: (decision: GoalFeedbackDecision) => void;
}

const decisions: Array<{ value: GoalFeedbackDecision; label: string }> = [
  { value: 'continue', label: '继续推进' },
  { value: 'adjust', label: '调整' },
  { value: 'pause', label: '暂停' },
  { value: 'complete', label: '已完成' },
  { value: 'end', label: '结束' },
];

/** A goal review is a direction choice, separate from each action's execution feedback. */
export function GoalFeedbackFields({ decision, setDecision }: GoalFeedbackFieldsProps) {
  return (
    <>
      <div className="future-goal-feedback-decision" aria-label="目标判断">
        {decisions.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            aria-pressed={decision === value}
            onClick={() => setDecision(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <label>
        反馈内容（可选）
        <textarea name="goalNote" maxLength={2000} placeholder="记录这个目标目前的判断" />
      </label>
      <label>
        下一步（可选）
        <input name="goalNextStep" maxLength={500} placeholder="写下接下来要做的事" />
      </label>
    </>
  );
}
