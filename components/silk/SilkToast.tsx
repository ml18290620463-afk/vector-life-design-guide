import { useEffect, type FC } from 'react';
import './silk.css';
export interface SilkToastProps { message: string | null; onDismiss?: () => void }
export const SilkToast: FC<SilkToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (!message || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, 2000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  return message ? <div className="silk-toast" role="status">{message}</div> : null;
};
