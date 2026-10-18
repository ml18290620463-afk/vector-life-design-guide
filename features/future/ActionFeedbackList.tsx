import { useEffect, useState } from 'react';
import type { ActionItem } from '../../types';
import type { ActionPracticeRecord, Goal } from '../../types/future';

const statuses = ['全部', '待推进', '已结束'] as const;
const ACTION_FEEDBACK_VIEW_KEY = 'vector.future.action-feedback.view.v1';
type FeedbackStatus = (typeof statuses)[number];

type SavedFeedbackView = { query: string; status: FeedbackStatus };

const readSavedView = (): SavedFeedbackView => {
  if (typeof window === 'undefined') return { query: '', status: '全部' };
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(ACTION_FEEDBACK_VIEW_KEY) ?? '{}',
    );
    if (!value || typeof value !== 'object') return { query: '', status: '全部' };
    const saved = value as { query?: unknown; status?: unknown };
    const migratedStatus =
      saved.status === '未开始' || saved.status === '进行中' ? '待推进' : saved.status;
    return {
      query: typeof saved.query === 'string' ? saved.query : '',
      status: statuses.includes(migratedStatus as FeedbackStatus)
        ? (migratedStatus as FeedbackStatus)
        : '全部',
    };
  } catch {
    return { query: '', status: '全部' };
  }
};

export function feedbackActionStatus(action: ActionItem): FeedbackStatus {
  if (action.status === 'completed' || action.status === 'abandoned') return '已结束';
  return '待推进';
}

export function actionProgressSummary(
  action: ActionItem,
  latestRecord?: ActionPracticeRecord,
): string {
  const note = latestRecord?.note.trim();
  return (
    note ||
    { pending: '未开始', active: '进行中', completed: '已完成', abandoned: '已结束' }[action.status]
  );
}

export function ActionFeedbackList({
  actions,
  goals = [],
  latestRecordsByAction = {},
  onOpen,
  onDelete,
}: {
  actions: ActionItem[];
  goals?: Goal[];
  latestRecordsByAction?: Record<string, ActionPracticeRecord | undefined>;
  onOpen: (id: string) => void;
  onDelete: (actions: ActionItem[]) => Promise<boolean>;
}) {
  const [savedView] = useState(readSavedView);
  const [query, setQuery] = useState(savedView.query);
  const [status, setStatus] = useState<FeedbackStatus>(savedView.status);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    try {
      window.sessionStorage.setItem(ACTION_FEEDBACK_VIEW_KEY, JSON.stringify({ query, status }));
    } catch {
      // The view still works when browser storage is unavailable.
    }
  }, [query, status]);

  const visible = actions.filter(
    (action) =>
      [action.title, goals.find((goal) => goal.id === action.goalId)?.title ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (status === '全部' || feedbackActionStatus(action) === status),
  );
  const allVisibleSelected =
    visible.length > 0 && visible.every((action) => selectedIds.has(action.id));
  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((action) => next.delete(action.id));
      else visible.forEach((action) => next.add(action.id));
      return next;
    });
  };
  const exitSelection = () => {
    if (deleting) return;
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirming(false);
    setDeleteError('');
  };
  const deleteSelected = async () => {
    const selected = actions.filter((action) => selectedIds.has(action.id));
    if (deleting || !selected.length) return;
    setDeleting(true);
    setDeleteError('');
    try {
      if (await onDelete(selected)) {
        setSelecting(false);
        setSelectedIds(new Set());
        setConfirming(false);
      } else {
        setDeleteError('删除未完成，请重试。');
      }
    } catch {
      setDeleteError('删除未完成，请重试。');
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="future-action-feedback">
      <div className="future-action-feedback-search">
        <input
          type="search"
          aria-label="搜索行动"
          placeholder="搜索行动或目标"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {!selecting ? (
          <button type="button" className="future-action-select" onClick={() => setSelecting(true)}>
            选择
          </button>
        ) : (
          <button
            type="button"
            className="future-action-select"
            disabled={deleting}
            onClick={exitSelection}
          >
            取消
          </button>
        )}
      </div>
      <div className="future-action-statuses" role="group" aria-label="行动状态">
        {statuses.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {selecting && (
        <div className="future-action-selection-bar">
          <span aria-live="polite">已选 {selectedIds.size} 项</span>
          <button type="button" disabled={!visible.length || deleting} onClick={toggleAll}>
            {allVisibleSelected ? '取消全选' : '全选'}
          </button>
        </div>
      )}
      <ul className="future-action-feedback-list" aria-label="行动列表">
        {visible.map((action) => (
          <li key={action.id}>
            {selecting ? (
              <label className="future-action-selection-row">
                <input
                  type="checkbox"
                  aria-label={`选择行动：${action.title}`}
                  checked={selectedIds.has(action.id)}
                  disabled={deleting}
                  onChange={() =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(action.id)) next.delete(action.id);
                      else next.add(action.id);
                      return next;
                    })
                  }
                />
                <strong>{action.title}</strong>
              </label>
            ) : (
              <button
                type="button"
                className="future-feedback-row"
                aria-label={action.title}
                onClick={() => onOpen(action.id)}
              >
                <span>
                  <strong>{action.title}</strong>
                  <small>{actionProgressSummary(action, latestRecordsByAction[action.id])}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="future-empty">{actions.length ? '没有匹配的行动。' : '暂无行动。'}</p>
      )}
      {selecting && selectedIds.size > 0 && (
        <div className="future-action-bulk-footer">
          <button type="button" disabled={deleting} onClick={() => setConfirming(true)}>
            删除 {selectedIds.size} 项
          </button>
        </div>
      )}
      {confirming && (
        <div
          className="future-action-delete-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="确认删除行动"
        >
          <div>
            <h3>删除 {selectedIds.size} 项行动？</h3>
            <p>删除后无法恢复。相关的行动反馈与成果记录也会一并删除。</p>
            {deleteError && <p role="alert">{deleteError}</p>}
            <div>
              <button type="button" disabled={deleting} onClick={() => setConfirming(false)}>
                取消
              </button>
              <button type="button" disabled={deleting} onClick={() => void deleteSelected()}>
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
