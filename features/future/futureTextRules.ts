export const normalizeVisionText = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '');

const bigrams = (text: string) => {
  if (text.length < 2) return new Set([text]);
  return new Set(
    Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)),
  );
};

/** A display-only duplicate signal; it never blocks saving a user's vision. */
export const visionSimilarity = (left: string, right: string) => {
  const a = normalizeVisionText(left);
  const b = normalizeVisionText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 6 && longer.includes(shorter) && shorter.length / longer.length >= 0.65)
    return 0.9;
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const overlap = [...aPairs].filter((pair) => bPairs.has(pair)).length;
  return (2 * overlap) / (aPairs.size + bPairs.size);
};

export const readableDate = (value?: string) => (value ? value.replaceAll('-', '.') : '未设日期');

const updatedAt = (value: { updatedAt?: number; createdAt: number }) =>
  value.updatedAt ?? value.createdAt;
export const newestFirst = <T extends { updatedAt?: number; createdAt: number }>(values: T[]) =>
  [...values].sort((left, right) => updatedAt(right) - updatedAt(left));

export const latestPracticesByAction = (records: ActionPracticeRecord[]) =>
  records.reduce<Record<string, ActionPracticeRecord>>((latest, record) => {
    if (!latest[record.actionId] || latest[record.actionId].createdAt < record.createdAt)
      latest[record.actionId] = record;
    return latest;
  }, {});

type ActionPriorityInput = {
  action: ActionItem;
  goal?: Goal;
  latestPractice?: ActionPracticeRecord;
};

const dateOffset = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

/**
 * The first action is the clearest next decision, not a productivity score.
 * The order is deliberately short and stable so a person can predict why an
 * action moved to the top: due now, waiting for a follow-up, a near goal
 * deadline, then the action they most recently changed.
 */
export const prioritizeActions = (values: ActionPriorityInput[], today: string) => {
  const nearDeadline = dateOffset(today, 7);
  const rank = ({ action, goal, latestPractice }: ActionPriorityInput) => {
    if (action.scheduledOn && action.scheduledOn <= today) return 0;
    if (latestPractice?.nextStep === 'continue' || latestPractice?.nextStep === 'adjust') return 1;
    if (goal?.dueDate && goal.dueDate <= nearDeadline) return 2;
    return 3;
  };
  const recent = (value: ActionPriorityInput) => value.action.updatedAt ?? value.action.createdAt;

  return [...values].sort((left, right) => {
    const rankDifference = rank(left) - rank(right);
    if (rankDifference) return rankDifference;
    const leftDate =
      rank(left) === 0
        ? left.action.scheduledOn
        : rank(left) === 2
          ? left.goal?.dueDate
          : undefined;
    const rightDate =
      rank(right) === 0
        ? right.action.scheduledOn
        : rank(right) === 2
          ? right.goal?.dueDate
          : undefined;
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    const recentDifference = recent(right) - recent(left);
    if (recentDifference) return recentDifference;
    const titleDifference = left.action.title.localeCompare(right.action.title, 'zh-CN');
    return titleDifference || left.action.id.localeCompare(right.action.id);
  });
};

export const prioritizedActionItems = (
  actions: ActionItem[],
  goals: Goal[],
  latestPracticeByAction: Record<string, ActionPracticeRecord | undefined>,
  today: string,
) =>
  prioritizeActions(
    actions.map((action) => ({
      action,
      goal: goals.find((goal) => goal.id === action.goalId),
      latestPractice: latestPracticeByAction[action.id],
    })),
    today,
  ).map(({ action }) => action);
import type { ActionItem } from '../../types';
import type { ActionPracticeRecord, Goal } from '../../types/future';
