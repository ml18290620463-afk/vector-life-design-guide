import React, { useEffect, useRef } from 'react';
import { SilkModal } from './silk/SilkModal';

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
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLButtonElement>('.past-action-dialog [data-cancel]')?.focus();
    return () => {
      opener.current?.focus();
    };
  }, []);
  return (
    <SilkModal open title={title} className={`past-action-dialog ${className}`.trim()} onClose={() => { if (!busy) onCancel(); }}>
      {children}
    </SilkModal>
  );
}
