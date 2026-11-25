import type { ComponentProps, FormEventHandler, ReactNode } from 'react';
import { PracticeFeedbackFields } from './PracticeFeedbackFields';
import { SilkButton } from '../../components/silk/SilkButton';

export function FeedbackEditor({
  busy,
  notice,
  onSubmit,
  actionFields,
  children,
  saveDisabled = false,
}: {
  busy: boolean;
  notice: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  actionFields?: ComponentProps<typeof PracticeFeedbackFields>;
  children?: ReactNode;
  saveDisabled?: boolean;
}) {
  return (
    <form className="future-feedback-editor future-editor-form" onSubmit={onSubmit}>
      <fieldset disabled={busy}>
        {actionFields && <PracticeFeedbackFields {...actionFields} />}
        {children}
        {notice && <p role="alert">{notice}</p>}
        <div className="future-feedback-submit">
          <SilkButton type="submit" variant="primary" disabled={saveDisabled}>
            {busy ? '保存中…' : '保存'}
          </SilkButton>
        </div>
      </fieldset>
    </form>
  );
}
