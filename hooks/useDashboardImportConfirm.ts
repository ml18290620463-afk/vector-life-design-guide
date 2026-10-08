import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationDictionary } from '../i18n/translations';

interface PendingImportConfirm {
  message: string;
  password?: boolean;
}
export interface DashboardImportConfirmState {
  pending: PendingImportConfirm | null;
  confirm: (message: string) => Promise<boolean>;
  requestPassword: () => Promise<string | null>;
  resolveConfirm: (ok: boolean, password?: string) => void;
}
/** Each dialog settles on replacement, cancel, or unmount; no orphaned import promises. */
export const useDashboardImportConfirm = (
  t?: TranslationDictionary,
): DashboardImportConfirmState => {
  const [pending, setPending] = useState<PendingImportConfirm | null>(null);
  const settle = useRef<((ok: boolean, password?: string) => void) | null>(null);
  useEffect(
    () => () => {
      settle.current?.(false);
      settle.current = null;
    },
    [],
  );
  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        settle.current?.(false);
        settle.current = (ok) => resolve(ok);
        setPending({ message });
      }),
    [],
  );
  const requestPassword = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        settle.current?.(false);
        settle.current = (ok, password) => resolve(ok ? password || null : null);
        setPending({
          password: true,
          message:
            t?.backupPasswordPrompt ??
            'Enter the password used to export this backup. An existing vault keeps its local password.',
        });
      }),
    [t],
  );
  const resolveConfirm = useCallback((ok: boolean, password?: string) => {
    const resolve = settle.current;
    settle.current = null;
    setPending(null);
    resolve?.(ok, password);
  }, []);
  return { pending, confirm, requestPassword, resolveConfirm };
};
