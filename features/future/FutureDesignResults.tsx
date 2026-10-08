import type { ActionItem } from '../../types';
import type { Goal, Vision } from '../../types/future';

const readableDate = (value?: string) => (value ? value.replaceAll('-', '.') : '未设日期');

type Summary = {
  primary: string;
  context?: string;
  /** Kept as the accessible sentence for people navigating by controls. */
  accessibilityText: string;
};

const visionSummary = (vision: Vision): Summary => ({
  primary: vision.text,
  accessibilityText: vision.text,
});
const goalSummary = (goal: Goal, visions: Vision[]): Summary => {
  const vision = visions.find((candidate) => candidate.id === goal.visionId);
  const time = goal.dueDate ? `${readableDate(goal.dueDate)}前，` : '';
  return {
    primary: goal.title,
    context: [
      goal.dueDate ? `${readableDate(goal.dueDate)} 前完成` : '',
      vision ? `关联愿景 · ${vision.text}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    accessibilityText: `${time}达成「${goal.title}」${vision ? `，为了「${vision.text}」` : ''}`,
  };
};
const actionSummary = (action: ActionItem, goals: Goal[]): Summary => {
  const goal = goals.find((candidate) => candidate.id === action.goalId);
  const time = action.scheduledOn ? `${readableDate(action.scheduledOn)}，` : '';
  return {
    primary: action.title,
    context: [
      action.scheduledOn ? `${readableDate(action.scheduledOn)} 计划` : '',
      goal ? `推进目标 · ${goal.title}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    accessibilityText: `${time}计划「${action.title}」${goal ? `，推进「${goal.title}」` : ''}`,
  };
};

function DesignSummary<T>({
  title,
  items,
  summary,
  onEdit,
}: {
  title: string;
  items: T[];
  summary: (item: T) => Summary;
  onEdit: (item: T) => void;
}) {
  const [first, ...rest] = items;
  return (
    <section
      className={`future-design-summary-card${first ? '' : ' future-design-summary-card--empty'}`}
      aria-labelledby={`future-${title}`}
    >
      <header className="future-design-summary-header">
        <div>
          <h2 id={`future-${title}`}>{title}</h2>
          <small>{items.length} 条记录</small>
        </div>
      </header>
      {first ? (
        <button
          type="button"
          className="future-summary-result"
          onClick={() => onEdit(first)}
          aria-label={`编辑${title}：${summary(first).accessibilityText}`}
        >
          <p className="future-summary-result__primary">{summary(first).primary}</p>
          {summary(first).context && (
            <p className="future-summary-result__context">{summary(first).context}</p>
          )}
        </button>
      ) : (
        <p className="future-design-summary-empty">暂未记录</p>
      )}
      {rest.length > 0 && (
        <details className="future-design-more-results">
          <summary>查看其余 {rest.length} 条</summary>
          {rest.map((item, index) => (
            <button type="button" key={index} onClick={() => onEdit(item)}>
              <span>{summary(item).primary}</span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </details>
      )}
    </section>
  );
}

export function FutureDesignResults({
  visions,
  goals,
  actions,
  onEditVision,
  onEditGoal,
  onEditAction,
  onOpenEditor,
}: {
  visions: Vision[];
  goals: Goal[];
  actions: ActionItem[];
  onEditVision: (value: Vision) => void;
  onEditGoal: (value: Goal) => void;
  onEditAction: (value: ActionItem) => void;
  onOpenEditor: () => void;
}) {
  const hasPlanning = visions.length + goals.length + actions.length > 0;
  return (
    <div className={`future-design-content${hasPlanning ? '' : ' future-design-content--empty'}`}>
      {hasPlanning ? (
        <button type="button" className="future-design-entry" onClick={onOpenEditor}>
          编辑未来规划
        </button>
      ) : (
        <div className="future-design-empty-intro">
          <p>先写下想去的方向</p>
          <button type="button" className="future-design-entry" onClick={onOpenEditor}>
            从愿景开始
          </button>
        </div>
      )}
      <DesignSummary title="愿景" items={visions} summary={visionSummary} onEdit={onEditVision} />
      <DesignSummary
        title="目标"
        items={goals}
        summary={(goal) => goalSummary(goal, visions)}
        onEdit={onEditGoal}
      />
      <DesignSummary
        title="行动规划"
        items={actions}
        summary={(action) => actionSummary(action, goals)}
        onEdit={onEditAction}
      />
    </div>
  );
}
