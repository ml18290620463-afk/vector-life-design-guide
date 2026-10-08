import React, { useEffect, useId, useRef } from 'react';

/** Native modal: Escape cancels, focus returns to the opening control. */
export function PastActionDialog({
  title,
  children,
  onCancel,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    ref.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    return () => {
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="past-action-dialog"
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
