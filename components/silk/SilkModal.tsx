import type { FC, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import './silk.css';
export interface SilkModalProps { open: boolean; title: string; children: ReactNode; onClose: () => void; className?: string }
export const SilkModal: FC<SilkModalProps> = ({ open, title, children, onClose, className = '' }) => {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    (focusable()[0] ?? dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="silk-modal-backdrop">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`silk-modal ${className}`.trim()}>
      <h2>{title}</h2>{children}
    </section>
  </div>;
};
