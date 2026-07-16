import { useCallback, useRef, useState } from 'react';
import {
  isBackupParseFailure,
  parseBackupImport,
  type BackupParseFailure,
} from '../services/dashboardImport';
import type { DiaryEntry } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

export type BackupImportMode = 'merge' | 'replace';

export interface BackupImportSummary {
  importedCount: number;
  totalAfter: number;
  mode: BackupImportMode;
}

export interface BackupImportStatus {
  kind: 'success' | 'error';
  message: string;
}

export interface UseBackupImportArgs {
  /** Hook into useDiaryData.importBackup. When undefined the import flow
   *  is treated as disabled. */
  onImportBackup?: (entries: DiaryEntry[], mode: BackupImportMode) => Promise<BackupImportSummary>;
  t: TranslationDictionary;
  /** Optional confirmation prompt; defaults to window.confirm. The hook
   *  awaits the result so callers can drive a Promise-based modal flow. */
  confirm?: (message: string) => boolean | Promise<boolean>;
  /** Pluggable error reporter so callers can wire Sentry / lib/error. */
  reportError?: (error: unknown) => void;
}

const REASON_LABEL_KEYS: Record<BackupParseFailure, string> = {
  'invalid-json': 'importInvalidJson',
  'wrong-shape': 'importWrongShape',
  'wrong-type': 'importWrongType',
  'unsupported-version': 'importUnsupportedVersion',
  'count-mismatch': 'importCountMismatch',
};

const REASON_LABEL_FALLBACKS: Record<BackupParseFailure, string> = {
  'invalid-json': 'Backup file is not valid JSON.',
  'wrong-shape': 'Backup payload structure is unexpected.',
  'wrong-type': 'File is not a VECTOR backup.',
  'unsupported-version': 'Backup was produced by a newer version.',
  'count-mismatch': 'Backup entry count does not match payload.',
};

/**
 * Encapsulates the entire "user picks a JSON file → parse → confirm → merge"
 * flow that previously lived inline in Dashboard. Returns a ref for the
 * file `<input>`, the change handler to attach to it, the latest status
 * message (success or failure), and a setter to clear it.
 */
export const useBackupImport = ({
  onImportBackup,
  t,
  confirm = (message) =>
    typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(message)
      : true,
  reportError,
}: UseBackupImportArgs) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<BackupImportStatus | null>(null);

  const resetInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !onImportBackup) {
        resetInput();
        return;
      }

      try {
        const text = await file.text();
        const parsed = parseBackupImport(text);
        if (isBackupParseFailure(parsed)) {
          const i18nKey = REASON_LABEL_KEYS[parsed.reason];
          const fallback = REASON_LABEL_FALLBACKS[parsed.reason];
          setStatus({
            kind: 'error',
            message: t[i18nKey] ?? fallback,
          });
          resetInput();
          return;
        }

        const confirmTemplate = t.importConfirm ?? 'Import {count} entries (merged with existing)?';
        const confirmed = await Promise.resolve(
          confirm(confirmTemplate.replace('{count}', String(parsed.entries.length))),
        );
        if (!confirmed) {
          resetInput();
          return;
        }

        const summary = await onImportBackup(parsed.entries, 'merge');
        const successTemplate = t.importSuccess ?? 'Imported {count} entries (now {total} total).';
        setStatus({
          kind: 'success',
          message: successTemplate
            .replace('{count}', String(summary.importedCount))
            .replace('{total}', String(summary.totalAfter)),
        });
      } catch (error) {
        setStatus({
          kind: 'error',
          message: t.importUnknown ?? 'Backup import failed unexpectedly.',
        });
        reportError?.(error);
      } finally {
        resetInput();
      }
    },
    [onImportBackup, t, confirm, reportError, resetInput],
  );

  return {
    inputRef,
    handleChange,
    status,
    setStatus,
  };
};
