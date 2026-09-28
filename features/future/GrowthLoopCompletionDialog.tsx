import { useEffect, useRef } from 'react';
import type { ActionItem } from '../../types';
import type { ActionFeedback, PracticeReflectionContext } from '../../types/future';
import type { MobileMainTab } from '../mobile/types';

const feedbackStatusLabel: Record<ActionFeedback['status'], string> = {
  completed: '已完成',
  partial: '有进展',
  not_completed: '尚未完成',
  cancelled: '不再继续',
};

const nextStepLabel: Record<ActionFeedback['nextStep'], string> = {
  continue: '继续完成',
  adjust: '调整后再做',
  pause: '暂不安排',
  end: '结束行动',
};

interface GrowthLoopCompletionDialogProps {
  action: ActionItem;
  feedback: ActionFeedback;
  opener: HTMLElement | null;
  onClose: () => void;
  onNavigateModule?: (tab: MobileMainTab) => void;
  onReflectInPast?: (context: PracticeReflectionContext) => void;
}

export function GrowthLoopCompletionDialog({
  action,
  feedback,
  opener,
  onClose,
  onNavigateModule,
  onReflectInPast,
}: GrowthLoopCompletionDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const actionCompleted = feedback.status === 'completed' && feedback.nextStep === 'end';

  useEffect(() => {
    const node = dialog.current;
    const surface = node?.closest('.future-page');
    const fitToPage = () => {
      if (!node || !surface) return;
      const bounds = surface.getBoundingClientRect();
      node.style.setProperty('--future-editor-width', `${Math.max(0, bounds.width - 32)}px`);
    };
    fitToPage();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitToPage);
    if (surface) observer?.observe(surface);
    window.addEventListener('resize', fitToPage);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (node && !node.open) node.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      observer?.disconnect();
      window.removeEventListener('resize', fitToPage);
      node?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <dialog
      className="future-dialog growth-loop-completion"
      aria-label={actionCompleted ? '行动已完成' : '本次践行已记录'}
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{actionCompleted ? '行动已完成' : '本次践行已记录'}</h2>
        <button type="button" onClick={onClose} aria-label="关闭完成结果">
          关闭
        </button>
      </header>
      <div className="growth-loop-completion__content">
        <section className="growth-loop-completion__summary" aria-label="本次行动">
          <small>本次行动</small>
          <strong>{action.title}</strong>
          <span>{feedbackStatusLabel[feedback.status]}</span>
        </section>
        <section className="growth-loop-completion__summary" aria-label="留下的结果">
          <small>留下的结果</small>
          <p>{feedback.note}</p>
        </section>
        <section className="growth-loop-completion__summary" aria-label="下一步">
          <small>下一步</small>
          <p>{nextStepLabel[feedback.nextStep]}</p>
        </section>
        {actionCompleted ? (
          <>
            <div className="growth-loop-completion__actions">
              <button
                type="button"
                className="future-primary"
                onClick={() => {
                  const context = {
                    actionTitle: action.title,
                    result: feedback.note,
                    nextStep: feedback.nextStep,
                  };
                  if (onReflectInPast) onReflectInPast(context);
                  else onNavigateModule?.('past');
                }}
              >
                去沉淀这次行动
              </button>
              <button type="button" onClick={onClose}>
                返回践行
              </button>
            </div>
          </>
        ) : (
          <div className="growth-loop-completion__actions">
            <button type="button" className="future-primary" onClick={onClose}>
              返回践行
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
