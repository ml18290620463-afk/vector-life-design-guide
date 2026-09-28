import type { ActionItem } from '../../types';

export function FutureActionCard({
  action,
  goalTitle,
  busy,
  mode = 'design',
  onEdit,
  onComplete,
  onReopen,
  onCancel,
  onGoal,
  onEntry,
}: {
  action: ActionItem;
  goalTitle?: string;
  busy: boolean;
  mode?: 'design' | 'feedback';
  onEdit: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onCancel: () => void;
  onGoal?: () => void;
  onEntry?: () => void;
}) {
  const ended = action.status === 'completed' || action.status === 'abandoned';
  return (
    <article className="future-result-row future-action-card">
      <button
        className="future-result-main"
        disabled={busy && mode === 'feedback'}
        onClick={mode === 'feedback' ? onComplete : onEdit}
      >
        <span className="future-result-copy">
          <strong>{action.title}</strong>
          <small>
            {action.scheduledOn || '待安排'}
            {goalTitle ? ` · ${goalTitle}` : ''}
            {ended ? ` · ${action.status === 'completed' ? '已完成' : '不再继续'}` : ''}
          </small>
        </span>
        <span className="future-result-entry">{mode === 'feedback' ? '记录' : '编辑'}</span>
      </button>
      <details className="future-row-more">
        <summary aria-label={`${action.title}的更多操作`}>•••</summary>
        <div className="future-row-more-menu">
          {mode === 'feedback' && <button onClick={onEdit}>编辑行动</button>}
          {mode === 'design' && (
            <button disabled={busy} onClick={ended ? onReopen : onComplete}>
              {ended ? '重新安排' : '完成'}
            </button>
          )}
          {!ended && (
            <button disabled={busy} onClick={onCancel}>
              取消行动
            </button>
          )}
          {onGoal && (
            <button data-goal-link={action.goalId} onClick={onGoal}>
              查看进展
            </button>
          )}
          {onEntry && <button onClick={onEntry}>查看记录</button>}
        </div>
      </details>
    </article>
  );
}
