import { useCallback, useState } from 'react';

interface PendingImportConfirm {
  message: string;
  resolve: (ok: boolean) => void;
}

export interface DashboardImportConfirmState {
  /** Pending confirmation popup, or null when nothing is awaiting. */
  pending: PendingImportConfirm | null;
  /**
   * `confirm()` adapter you can pass to `useBackupImport({ confirm })`.
   * Returns a Promise<boolean> that resolves once the modal is
   * acknowledged.
   */
  confirm: (message: string) => Promise<boolean>;
  /**
   * Modal click handler. Settles the pending Promise with `ok` and
   * clears the pending state.
   */
  resolveConfirm: (ok: boolean) => void;
}

/**
 * Bridges the imperative `useBackupImport({ confirm })` callback (which
 * expects a Promise<boolean>) to a declarative React state slot that the
 * Dashboard renders as a `BackupImportConfirmModal`.
 *
 * Pulled out as part of Phase 2 §2.h tail so Dashboard.tsx can stay
 * close to the 350-LOC ROADMAP target.
 */
export const useDashboardImportConfirm = (): DashboardImportConfirmState => {
  const [pending, setPending] = useState<PendingImportConfirm | null>(null);

  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        setPending({ message, resolve });
      }),
    [],
  );

  const resolveConfirm = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  return { pending, confirm, resolveConfirm };
};
