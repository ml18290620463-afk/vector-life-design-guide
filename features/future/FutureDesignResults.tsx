import type { ActionItem } from '../../types';
import type { ActionPracticeRecord, Goal, Vision } from '../../types/future';
import {
  actionExecutionStatusLabel,
  actionNextStepLabel,
} from '../../services/actionPracticeSemantics';

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
const actionStateLabel: Record<ActionItem['status'], string> = {
  pending: '待开始',
  active: '进行中',
  completed: '已完成',
  abandoned: '已结束',
};
const actionSummary = (
  action: ActionItem,
  goals: Goal[],
  latestPractice?: ActionPracticeRecord,
): Summary => {
  const goal = goals.find((candidate) => candidate.id === action.goalId);
  const practice = latestPractice
    ? `${actionExecutionStatusLabel[latestPractice.status]} · 后续${actionNextStepLabel[latestPractice.nextStep]}`
    : '';
  return {
    primary: action.title,
    context: [
      goal ? `所属目标 · ${goal.title}` : '独立行动',
      `状态 · ${actionStateLabel[action.status]}`,
      practice,
      action.scheduledOn ? `${readableDate(action.scheduledOn)} 计划` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    accessibilityText: `行动「${action.title}」，${goal ? `所属目标「${goal.title}」` : '独立行动'}，当前${actionStateLabel[action.status]}${practice ? `，最近践行${practice}` : ''}${action.scheduledOn ? `，计划于${readableDate(action.scheduledOn)}` : ''}`,
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
  latestPracticeByAction,
}: {
  visions: Vision[];
  goals: Goal[];
  actions: ActionItem[];
  onEditVision: (value: Vision) => void;
  onEditGoal: (value: Goal) => void;
  onEditAction: (value: ActionItem) => void;
  onOpenEditor: () => void;
  latestPracticeByAction: Record<string, ActionPracticeRecord | undefined>;
}) {
  const hasPlanning = visions.length + goals.length + actions.length > 0;
  const nextAction = actions[0];
  return (
    <div className={`future-design-content${hasPlanning ? '' : ' future-design-content--empty'}`}>
      {nextAction && (
        <section className="future-next-action" aria-labelledby="future-next-action-heading">
          <header>
            <div>
              <h2 id="future-next-action-heading">现在推进</h2>
              <small>按计划日期、待继续的记录和目标期限排序</small>
            </div>
          </header>
          <button
            type="button"
            className="future-next-action__entry"
            onClick={() => onEditAction(nextAction)}
            aria-label={`记录行动：${actionSummary(nextAction, goals, latestPracticeByAction[nextAction.id]).accessibilityText}`}
          >
            <span>
              <strong>{nextAction.title}</strong>
              <small>
                {actionSummary(nextAction, goals, latestPracticeByAction[nextAction.id]).context}
              </small>
            </span>
            <span aria-hidden="true">记录</span>
          </button>
        </section>
      )}
      {hasPlanning ? (
        <button type="button" className="future-design-entry" onClick={onOpenEditor}>
          编辑未来规划
        </button>
      ) : (
        <div className="future-design-empty-intro">
          <p>写下接下来想做的事</p>
          <small>可以从一段经历或当前理解出发，设计下一次可验证的尝试。</small>
          <button type="button" className="future-design-entry" onClick={onOpenEditor}>
            添加行动
          </button>
        </div>
      )}
      <DesignSummary
        title="行动规划"
        items={actions}
        summary={(action) => actionSummary(action, goals, latestPracticeByAction[action.id])}
        onEdit={onEditAction}
      />
      <DesignSummary
        title="目标"
        items={goals}
        summary={(goal) => goalSummary(goal, visions)}
        onEdit={onEditGoal}
      />
      <DesignSummary title="愿景" items={visions} summary={visionSummary} onEdit={onEditVision} />
    </div>
  );
}
