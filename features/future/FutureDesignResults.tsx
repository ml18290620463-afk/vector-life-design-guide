import { useState } from 'react';
import type { ActionItem } from '../../types';
import type { ActionPracticeRecord, Goal, Vision } from '../../types/future';
import { actionExecutionStatusLabel } from '../../services/actionPracticeSemantics';

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
const goalSummary = (goal: Goal): Summary => ({
  primary: goal.title,
  accessibilityText: goal.title,
});
const actionStateLabel: Record<ActionItem['status'], string> = {
  pending: '待开始',
  active: '进行中',
  completed: '已完成',
  abandoned: '已结束',
};
const actionSummary = (action: ActionItem, goals: Goal[], latestPractice?: ActionPracticeRecord): Summary => {
  const goal = goals.find((candidate) => candidate.id === action.goalId);
  const practice = latestPractice
    ? `${actionExecutionStatusLabel[latestPractice.status]} · ${latestPractice.occurredOn.replaceAll('-', '.')}`
    : '';
  return {
    primary: action.title,
    context: [
      goal?.title,
      `${actionStateLabel[action.status]}${practice ? ` · 最近反馈 ${practice}` : ''}`,
    ]
      .filter(Boolean)
      .join(' · '),
    accessibilityText: `行动「${action.title}」，${goal ? `所属目标「${goal.title}」` : '独立行动'}，当前${actionStateLabel[action.status]}${practice ? `，最近反馈${practice}` : ''}`,
  };
};

function DesignSummary<T>({
  title,
  items,
  summary,
  onEdit,
  onAdd,
}: {
  title: string;
  items: T[];
  summary: (item: T) => Summary;
  onEdit: (item: T) => void;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 3);
  return (
    <section
      className={`future-design-summary-list${items.length ? '' : ' future-design-summary-list--empty'}`}
      aria-labelledby={`future-${title}`}
    >
      <header className="future-design-summary-header">
        <div>
          <h2 id={`future-${title}`}>{title}</h2>
        </div>
        <button
          type="button"
          className="future-summary-add"
          aria-label={`添加${title}`}
          onClick={onAdd}
        >
          <span aria-hidden="true">＋</span>
        </button>
      </header>
      {items.length > 0 &&
        visibleItems.map((item, index) => (
          <button
            key={index}
            type="button"
            className="future-summary-result"
            onClick={() => onEdit(item)}
            aria-label={`查看${title}：${summary(item).accessibilityText}`}
          >
            <span className="future-summary-result__content">
              <p className="future-summary-result__primary">{summary(item).primary}</p>
              {summary(item).context && (
                <span className="future-summary-result__context">{summary(item).context}</span>
              )}
            </span>
            <span className="future-summary-result__chevron" aria-hidden="true">›</span>
          </button>
        ))}
      {items.length > 3 && (
        <button
          type="button"
          className="future-summary-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起' : `展开更多（${items.length - 3}）`}
        </button>
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
  onAdd,
  latestPracticeByAction,
}: {
  visions: Vision[];
  goals: Goal[];
  actions: ActionItem[];
  onEditVision: (value: Vision) => void;
  onEditGoal: (value: Goal) => void;
  onEditAction: (value: ActionItem) => void;
  onAdd: (kind: 'vision' | 'goal' | 'action') => void;
  latestPracticeByAction: Record<string, ActionPracticeRecord | undefined>;
}) {
  return (
    <div className="future-design-content future-planning-stack">
      <DesignSummary
        title="愿景"
        items={visions}
        summary={visionSummary}
        onEdit={onEditVision}
        onAdd={() => onAdd('vision')}
      />
      <DesignSummary
        title="目标"
        items={goals}
        summary={goalSummary}
        onEdit={onEditGoal}
        onAdd={() => onAdd('goal')}
      />
      <DesignSummary
        title="行动"
        items={actions}
        summary={(action) => actionSummary(action, goals, latestPracticeByAction[action.id])}
        onEdit={onEditAction}
        onAdd={() => onAdd('action')}
      />
    </div>
  );
}
