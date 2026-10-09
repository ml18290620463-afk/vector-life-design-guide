import type { ActionFeedbackNextStep, ActionFeedbackStatus } from '../../types/future';
import { actionExecutionStatusHint } from '../../services/actionPracticeSemantics';

interface Props {
  status: ActionFeedbackStatus;
  nextStep: ActionFeedbackNextStep;
  setStatus: (status: ActionFeedbackStatus) => void;
  setNextStep: (step: ActionFeedbackNextStep) => void;
}
export function PracticeFeedbackFields({ status, nextStep, setStatus, setNextStep }: Props) {
  return (
    <>
      <label>
        本次执行状态
        <select
          name="feedbackStatus"
          value={status}
          autoFocus
          onChange={(event) => {
            const status = event.target.value as ActionFeedbackStatus;
            setStatus(status);
            if (status === 'completed' || status === 'cancelled') setNextStep('end');
            else setNextStep('continue');
          }}
        >
          <option value="completed">已完成</option>
          <option value="partial">部分完成</option>
          <option value="not_completed">尚未完成</option>
          <option value="cancelled">停止这项行动</option>
        </select>
      </label>
      <p className="future-feedback-status-hint">{actionExecutionStatusHint[status]}</p>
      <label>
        实际发生了什么（可选）
        <textarea name="note" />
      </label>
      {(status === 'partial' || status === 'not_completed') && (
        <details>
          <summary>下一步（默认继续完成）</summary>
          <label>
            下一步
            <select
              name="nextStep"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value as ActionFeedbackNextStep)}
            >
              <option value="continue">继续完成</option>
              <option value="adjust">调整后再做</option>
              <option value="pause">暂不安排</option>
              <option value="end">结束行动</option>
            </select>
          </label>
          {nextStep === 'adjust' && (
            <label>
              调整后的行动
              <input
                name="nextAction"
                required
                maxLength={500}
                placeholder="把下一步改小、改具体，例如：明天先核对一份材料"
              />
            </label>
          )}
        </details>
      )}
    </>
  );
}
