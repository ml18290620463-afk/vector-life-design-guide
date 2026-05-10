import React from 'react';
import type {
  CustomPersona,
  DiaryEntry,
  Memory,
  MemoryCategory,
  PendingLetter,
  Theme,
} from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { MemoryManagementPanel } from './MemoryManagementPanel';
import { LetterHistoryPanel } from './LetterHistoryPanel';

/**
 * Phase 4.5 §E follow-up (L1) — `AppMemoirPanels`
 *
 * Thin presentational wrapper that mounts the Memory Management
 * panel and the Letter History panel for a chosen Memoir. Lifted
 * out of `App.tsx` so the App module stays under the 600-LOC
 * ceiling — `useMigrationWizard` / signed-backup wiring already
 * pushed App close to its budget.
 *
 * The wrapper has no state of its own; the parent owns the
 * `memoirForMemories` / `memoirForLetters` selection and clears it
 * when the panel closes.
 */
interface AppMemoirPanelsProps {
  theme: Theme;
  t: TranslationDictionary;
  memoirForMemories: CustomPersona | null;
  memoirForLetters: CustomPersona | null;
  memories: readonly Memory[];
  recycleBinFor: (memoirId: string) => Memory[];
  pendingLetters: readonly PendingLetter[];
  entries: readonly DiaryEntry[];
  onClearMemoryFor: (memoirId: string) => Promise<void> | void;
  onCascadeDeleteMemoir: (memoirId: string) => Promise<void> | void;
  onCloseMemories: () => void;
  onCloseLetters: () => void;
  onUpdateMemory: (
    id: string,
    patch: { body?: string; category?: MemoryCategory },
  ) => Promise<void> | void;
  onSoftDeleteMemory: (id: string) => Promise<void> | void;
  onHardDeleteMemory: (id: string) => Promise<void> | void;
  onRestoreMemory: (id: string) => Promise<void> | void;
  onCancelLetter: (id: string) => Promise<void> | void;
  onOpenLetterReply: (entry: DiaryEntry) => void;
}

export const AppMemoirPanels: React.FC<AppMemoirPanelsProps> = ({
  theme,
  t,
  memoirForMemories,
  memoirForLetters,
  memories,
  recycleBinFor,
  pendingLetters,
  entries,
  onClearMemoryFor,
  onCascadeDeleteMemoir,
  onCloseMemories,
  onCloseLetters,
  onUpdateMemory,
  onSoftDeleteMemory,
  onHardDeleteMemory,
  onRestoreMemory,
  onCancelLetter,
  onOpenLetterReply,
}) => (
  <>
    {memoirForMemories && (
      <MemoryManagementPanel
        open
        onClose={onCloseMemories}
        theme={theme}
        t={t}
        memoir={memoirForMemories}
        memories={memories.filter((m) => m.memoirId === memoirForMemories.id && !m.deletedAt)}
        recycleBin={recycleBinFor(memoirForMemories.id)}
        onUpdateMemory={onUpdateMemory}
        onDeleteMemory={onSoftDeleteMemory}
        onHardDeleteMemory={onHardDeleteMemory}
        onRestoreMemory={onRestoreMemory}
        onClearAll={() => onClearMemoryFor(memoirForMemories.id)}
        onCascadeDeleteMemoir={() => onCascadeDeleteMemoir(memoirForMemories.id)}
      />
    )}
    {memoirForLetters && (
      <LetterHistoryPanel
        open
        onClose={onCloseLetters}
        theme={theme}
        t={t}
        memoir={memoirForLetters}
        letters={pendingLetters}
        onCancelLetter={onCancelLetter}
        onOpenReply={(letter) => {
          if (!letter.replyEntryId) return;
          const target = entries.find((e) => e.id === letter.replyEntryId);
          if (target) onOpenLetterReply(target);
        }}
      />
    )}
  </>
);
