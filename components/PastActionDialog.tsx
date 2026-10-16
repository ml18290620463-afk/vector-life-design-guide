import React, { useEffect, useId, useRef } from 'react';

/** Native modal: Escape cancels, focus returns to the opening control. */
export function PastActionDialog({
  title,
  children,
  onCancel,
  busy = false,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`past-action-dialog ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
