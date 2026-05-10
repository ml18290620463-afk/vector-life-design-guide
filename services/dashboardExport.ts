import { CustomPersona, DiaryEntry, Memory, PendingLetter } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { asLegacyEntry, getEntryTimestamp, getEntryTitle } from './entryCompat';

export type NotesExportMode = 'all' | 'filtered' | string;

/**
 * Backup file shape contract. The `type` and `schemaVersion` discriminators
 * let downstream importers (dashboardImport.ts) reject foreign or future
 * payloads instead of half-importing them. Bump `BACKUP_SCHEMA_VERSION` and
 * the importer when the on-disk format changes.
 *
 * **v2 (Phase 4 §5.1.A)** — adds the optional `customPersonas` array
 * for user-created custom 启明星. Backwards-compatible.
 *
 * **v3 (Phase 4 §5.1.B)** — adds the optional `memories` array for
 * **心象 (Memoir)** long-term memories. Backwards-compatible the same
 * way `customPersonas` was: v1 / v2 importers reading a v3 file
 * silently ignore the new field; v3 importers reading a v1 / v2 file
 * treat `memories` as `[]`. The version bump is needed only because
 * the on-disk shape grew.
 *
 * **v4 (Phase 4.5 §E)** — adds three optional fields, all in
 * service of the cross-device migration wizard:
 *   - `letters`: pending Memoir letters from §A so the wizard
 *     carries the unsent / delivered queue across the move.
 *   - `passwordHashSnapshot` / `passwordSaltSnapshot`: opt-in
 *     credential carry so the user can unlock the migrated vault
 *     on the new device with the same master password — without
 *     these fields the user would have to re-bootstrap the
 *     password and lose access to encrypted entries. **Only the
 *     migration export path emits these**; the regular Settings
 *     "Export Star Map" path leaves them out (defence in depth:
 *     the credential snapshot doesn't end up in casual backups).
 * Backwards-compatible: v1-v3 importers ignore the new fields,
 * and a v4-aware importer reading a v1-v3 file treats them as
 * undefined.
 *
 * **v5 (Phase 4 §4.b-3)** — adds two optional fields for Ed25519
 * backup integrity:
 *   - `signature`: 64-byte Ed25519 signature, base64. Covers the
 *     canonical body (this same JSON, with `signature` and
 *     `publicKey` stripped before re-stringify-ing).
 *   - `publicKey`: 32-byte raw Ed25519 public key, base64. The
 *     verifier consults this against the local TOFU trust store
 *     (see `services/trustedDevices.ts`) to decide auto-pass vs
 *     show-fingerprint-confirmation.
 * Both fields are optional; an unsigned v5 file is still valid
 * (it just falls back to the v4 short-code-only verification
 * posture). Sign / verify implementation lives in
 * `services/backupSignature.ts`.
 *
 * Why bundle memories into the backup at all (vs. asking the user to
 * regenerate from scratch on a new device): the whole VECTOR value
 * proposition is "the memoir remembers" — losing the memory bank on
 * restore would erase that. The backup is the only path through
 * which a Memoir's history can leave the device, by design.
 */
export const BACKUP_TYPE = 'vector-vault-backup' as const;
export const BACKUP_SCHEMA_VERSION = 5 as const;

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
  /** Phase 4 §5.1.A — user-created custom 启明星. Optional so v1
   *  imports continue to work and consumers without any custom
   *  personas don't bloat the file. */
  customPersonas?: CustomPersona[];
  /** Phase 4 §5.1.B — Memoir long-term memories. Optional;
   *  consumers without any Memoirs don't bloat the file. The
   *  importer pipes these through `memoryService.hydrateMemories`
   *  before persisting so a hostile or corrupted backup cannot
   *  poison the runtime list. */
  memories?: Memory[];
  /** Phase 4.5 §E — pending Memoir letters (from §A "Letter Mode").
   *  Optional, only present in v4+ payloads. */
  letters?: PendingLetter[];
  /** Phase 4.5 §E — opt-in credential carry for the cross-device
   *  migration wizard. The hash is the SAME format
   *  `SecurityService.hashPassword` produces (PBKDF2 or Argon2id —
   *  both verifiable on the new device). The salt is the legacy
   *  PBKDF2 salt; Argon2id self-describing hashes ignore it but
   *  it's still carried so a downgrade verification path works.
   *  Only emitted by the migration export path; the regular
   *  `Settings → Export Star Map` flow OMITS these fields so
   *  casual backups never carry credential material. */
  passwordHashSnapshot?: string;
  passwordSaltSnapshot?: string;
}

interface BuildBackupExportArgs {
  version: string;
  entries: DiaryEntry[];
  currentUser: string | null;
  now?: Date;
  /** Phase 4 §5.1.A — bundle the user's custom 启明星 into the
   *  backup so a restore on a new device carries them across. */
  customPersonas?: CustomPersona[];
  /** Phase 4 §5.1.B — bundle Memoir memories into the backup so
   *  Memoirs keep "remembering" past conversations after restore. */
  memories?: Memory[];
  /** Phase 4.5 §E — bundle pending Memoir letters into the backup. */
  letters?: PendingLetter[];
  /** Phase 4.5 §E — opt-in credential carry. Only the migration
   *  wizard sets these; regular Settings "Export Star Map" leaves
   *  them undefined. */
  passwordHashSnapshot?: string;
  passwordSaltSnapshot?: string;
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
  customPersonas,
  memories,
  letters,
  passwordHashSnapshot,
  passwordSaltSnapshot,
}: BuildBackupExportArgs) => {
  const exportedAt = (now ?? new Date()).toISOString();
  const payload: BackupPayload = {
    type: BACKUP_TYPE,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    version,
    exportedAt,
    entryCount: entries.length,
    entries,
    // Only emit when there's something to ship; keeps exports compact
    // for the common case (a fresh user with zero custom personas /
    // zero Memoirs / zero letters).
    ...(customPersonas && customPersonas.length > 0 ? { customPersonas } : {}),
    ...(memories && memories.length > 0 ? { memories } : {}),
    ...(letters && letters.length > 0 ? { letters } : {}),
    // Phase 4.5 §E — credential snapshot is opt-in per call (never
    // emitted by the regular Settings export path). The migration
    // export path passes both fields when it has them.
    ...(passwordHashSnapshot ? { passwordHashSnapshot } : {}),
    ...(passwordSaltSnapshot ? { passwordSaltSnapshot } : {}),
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
