import type { ActionFeedback, ActionFeedbackNextStep, ActionFeedbackStatus } from '../types/future';

/** Execution feedback records what happened; it is never a judgment about a person's value. */
export const actionExecutionStatusLabel: Record<ActionFeedbackStatus, string> = {
  completed: '已完成',
  partial: '部分完成',
  not_completed: '尚未完成',
  cancelled: '停止这项行动',
};

export const actionNextStepLabel: Record<ActionFeedbackNextStep, string> = {
  continue: '继续完成',
  adjust: '调整后再做',
  pause: '暂不安排',
  end: '结束行动',
};

export const actionExecutionStatusHint: Record<ActionFeedbackStatus, string> = {
  completed: '这次行动已完成；是否有效仍以你记录的实际情况为准。',
  partial: '只记录已做到的部分；未完成的部分不等于失败。',
  not_completed: '这次尚未完成；可以保留、调整或暂停行动。',
  cancelled: '这项行动到此停止；这不表示它此前没有价值。',
};

/** A stable, self-explanatory sentence for sources consumed by the avatar. */
export const describeActionPractice = (
  feedback: ActionFeedback & { actionTitle?: string; nextAction?: string },
) =>
  [
    ...(feedback.actionTitle ? [`当时行动：${feedback.actionTitle}`] : []),
    `执行状态：${actionExecutionStatusLabel[feedback.status]}`,
    feedback.note.trim() ? `实际记录：${feedback.note.trim()}` : '未填写实际记录',
    `后续选择：${actionNextStepLabel[feedback.nextStep]}`,
    ...(feedback.nextAction ? [`调整后的行动：${feedback.nextAction}`] : []),
  ].join('；');
