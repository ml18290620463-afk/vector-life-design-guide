import { useCallback, useEffect, useState } from 'react';

export const useToast = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const showToast = useCallback((next: string) => setMessage(next), []);

  return { toastMessage: message, showToast };
};
