import { DiaryEntry } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { asLegacyEntry, getEntryTimestamp, getEntryTitle } from './entryCompat';

export type NotesExportMode = 'all' | 'filtered' | string;

/**
 * Backup file shape contract. The `type` and `schemaVersion` discriminators
 * let downstream importers (dashboardImport.ts) reject foreign or future
 * payloads instead of half-importing them. Bump `BACKUP_SCHEMA_VERSION` and
 * the importer when the on-disk format changes.
 *
 * B4 keeps this as the lightweight, ordinary backup path for entries.
 * Retired advanced payloads were intentionally removed from this schema so
 * casual users get a smaller, easier-to-trust export.
 */
export const BACKUP_TYPE = 'vector-vault-backup' as const;
export const BACKUP_SCHEMA_VERSION = 1 as const;

export interface BackupPayload {
  type: typeof BACKUP_TYPE;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  /** Human readable build version captured at export time. */
  version: string;
  /** ISO timestamp for when the backup was produced. */
  exportedAt: string;
  /** Length of `entries`; importers cross-check this. */
  entryCount: number;
  entries: DiaryEntry[];
}

interface BuildBackupExportArgs {
  version: string;
  entries: DiaryEntry[];
  currentUser: string | null;
  now?: Date;
}

interface BuildNotesExportArgs {
  mode?: NotesExportMode;
  entries: DiaryEntry[];
  filteredEntries: DiaryEntry[];
  labels: TranslationDictionary;
  currentUser: string | null;
  now?: Date;
}

const imageDataMarkdownPattern = /!\[.*?\]\(data:image\/.*?;base64,.*?\)/g;

const exportTimestamp = (now = new Date()) => now.toISOString().replace(/[:.]/g, '-');

const exportUser = (currentUser: string | null) =>
  (currentUser || 'GUEST').toUpperCase().replace('@', '_');

const exportTitle = (entry: DiaryEntry) =>
  getEntryTitle(asLegacyEntry(entry), 'UNTITLED').toUpperCase().replace(/\s+/g, '_');

export const buildBackupExport = ({
  version,
  entries,
  currentUser,
  now,
}: BuildBackupExportArgs) => {
  const exportedAt = (now ?? new Date()).toISOString();
  const payload: BackupPayload = {
    type: BACKUP_TYPE,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    version,
    exportedAt,
    entryCount: entries.length,
    entries,
  };
  const content = JSON.stringify(payload, null, 2);
  const filename = `VECTOR_${exportUser(currentUser)}_BACKUP_${exportTimestamp(now)}.json`;

  return { content, filename };
};

export const buildNotesExport = ({
  mode = 'all',
  entries,
  filteredEntries,
  labels,
  currentUser,
  now,
}: BuildNotesExportArgs) => {
  const targetEntries =
    mode === 'all'
      ? entries.filter((entry) => !entry.isArchived)
      : mode === 'filtered'
        ? filteredEntries
        : entries.filter((entry) => entry.id === mode);

  if (targetEntries.length === 0) return null;

  const content = [...targetEntries]
    .sort((a, b) => getEntryTimestamp(asLegacyEntry(b)) - getEntryTimestamp(asLegacyEntry(a)))
    .map((entry) => {
      const timestamp = getEntryTimestamp(asLegacyEntry(entry));
      const date = new Date(timestamp).toLocaleString();
      const tags = entry.tags.join(', ');
      const cleanContent = entry.content.replace(imageDataMarkdownPattern, '[IMAGE_DATA]');

      return `==================================================
【 ${getEntryTitle(asLegacyEntry(entry))} 】
${labels.engravingTime}: ${date}
${labels.tags}: ${tags}
--------------------------------------------------
${cleanContent}
==================================================\n\n`;
    })
    .join('\n');

  const timestamp = exportTimestamp(now);
  const user = exportUser(currentUser);
  const filename =
    mode === 'all'
      ? `VECTOR_ALL_NOTES_${user}_${timestamp}.txt`
      : mode === 'filtered'
        ? `VECTOR_FILTERED_NOTES_${user}_${timestamp}.txt`
        : `VECTOR_NOTE_${exportTitle(targetEntries[0])}_${timestamp}.txt`;

  return { content, filename };
};
