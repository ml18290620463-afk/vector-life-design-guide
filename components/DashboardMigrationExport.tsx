import React from 'react';
import type { CustomPersona, DiaryEntry, Memory, PendingLetter, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { MigrationExportModal } from './MigrationExportModal';

/**
 * Phase 4.5 §E (Cross-device migration wizard) —
 * `DashboardMigrationExport`
 *
 * Thin presentational wrapper around `MigrationExportModal` extracted
 * from `components/Dashboard.tsx` to keep the Dashboard module under
 * the 600-line LOC budget. Has no extra logic of its own — the
 * modal already handles its own state machine.
 */
interface DashboardMigrationExportProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  version: string;
  entries: readonly DiaryEntry[];
  customPersonas: readonly CustomPersona[];
  memories: readonly Memory[];
  letters: readonly PendingLetter[];
  currentUser: string | null;
  passwordHash: string | null;
  passwordSalt: string | null;
  /** Phase 4 §4.b-3 — passed straight to the modal's signing
   *  material lookup. Optional. */
  onUnlockSigningKey?: () => Promise<{ secretKey: Uint8Array; publicKey: string } | null>;
}

export const DashboardMigrationExport: React.FC<DashboardMigrationExportProps> = (props) => (
  <MigrationExportModal {...props} />
);
