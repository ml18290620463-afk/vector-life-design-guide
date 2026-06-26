import { CustomPersona, DiaryEntry, Memory, PendingLetter } from '../types';
import { BACKUP_TYPE, BACKUP_SCHEMA_VERSION } from './dashboardExport';
import { hydratePersonas } from './personaService';
import { hydrateMemories } from './memoryService';
import { hydrateLetters } from './letterService';

export type BackupParseFailure =
  | 'invalid-json'
  | 'wrong-shape'
  | 'wrong-type'
  | 'unsupported-version'
  | 'count-mismatch';

export interface BackupParseSuccess {
  ok: true;
  entries: DiaryEntry[];
  /** Phase 4 §5.1.A — user-created custom 启明星 from v2+ backups.
   *  Empty array for v1 / legacy backups (which predate the field).
   *  Always passes through `hydratePersonas` so corrupted entries
   *  inside the payload don't poison the import. */
  customPersonas: CustomPersona[];
  /** Phase 4 §5.1.B — Memoir long-term memories from v3+ backups.
   *  Empty array for v1 / v2 / legacy backups. Always passes
   *  through `hydrateMemories` so corrupted entries are dropped. */
  memories: Memory[];
  /** Phase 4.5 §E — pending Memoir letters from v4+ backups.
   *  Empty array for v1-v3 / legacy backups. Hydrated through
   *  `letterService.hydrateLetters` for shape validation. */
  letters: PendingLetter[];
  /** Phase 4.5 §E — opt-in credential snapshot from v4+ migration
   *  backups. Both fields are present **only** when the source
   *  device used the migration export path; the regular Settings
   *  "Export Star Map" leaves them undefined. */
  passwordHashSnapshot?: string;
  passwordSaltSnapshot?: string;
  /** When the file is from a known schema, expose meta so callers can show it. */
  meta: {
    version?: string;
    exportedAt?: string;
    schemaVersion?: number;
    legacy: boolean;
  };
}

export interface BackupParseFailureResult {
  ok: false;
  reason: BackupParseFailure;
  detail?: string;
}

export type BackupParseResult = BackupParseSuccess | BackupParseFailureResult;

/** Narrow a parse result to its success branch (TS-friendly type guard). */
export const isBackupParseSuccess = (result: BackupParseResult): result is BackupParseSuccess =>
  result.ok === true;

/** Narrow a parse result to its failure branch (TS-friendly type guard). */
export const isBackupParseFailure = (
  result: BackupParseResult,
): result is BackupParseFailureResult => result.ok === false;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const looksLikeEntry = (value: unknown): value is DiaryEntry => {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.title !== 'string') return false;
  if (typeof value.content !== 'string') return false;
  if (typeof value.createdAt !== 'number') return false;
  return true;
};

const ensureEntries = (raw: unknown): DiaryEntry[] | null => {
  if (!Array.isArray(raw)) return null;
  if (!raw.every(looksLikeEntry)) return null;
  return raw;
};

/**
 * Parses a previously exported backup file. Accepts both the current schema
 * (with `type` / `schemaVersion` discriminators) and the legacy
 * `{ version, entries }` payload that pre-dates schema versioning, so users
 * with old backups can still restore.
 */
export const parseBackupImport = (raw: string): BackupParseResult => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid-json',
      detail: error instanceof Error ? error.message : undefined,
    };
  }

  if (!isPlainObject(value)) {
    return { ok: false, reason: 'wrong-shape' };
  }

  const hasType = typeof value.type === 'string';

  if (hasType) {
    if (value.type !== BACKUP_TYPE) {
      return { ok: false, reason: 'wrong-type', detail: String(value.type) };
    }
    const schemaVersion = value.schemaVersion;
    if (typeof schemaVersion !== 'number' || schemaVersion > BACKUP_SCHEMA_VERSION) {
      return {
        ok: false,
        reason: 'unsupported-version',
        detail: schemaVersion != null ? String(schemaVersion) : undefined,
      };
    }

    const entries = ensureEntries(value.entries);
    if (!entries) {
      return { ok: false, reason: 'wrong-shape' };
    }

    if (typeof value.entryCount === 'number' && value.entryCount !== entries.length) {
      return {
        ok: false,
        reason: 'count-mismatch',
        detail: `expected=${value.entryCount} actual=${entries.length}`,
      };
    }

    // Phase 4 §5.1.A — read the optional v2+ `customPersonas` field.
    // Validation lives in `personaService.hydratePersonas` which
    // silently drops malformed personas. v1 backups missing the
    // field land here as `[]`, which is the documented contract.
    const customPersonas = hydratePersonas(value.customPersonas);
    // Phase 4 §5.1.B — read the optional v3+ `memories` field. Same
    // posture as `customPersonas`: pre-v3 backups land as `[]`.
    const memories = hydrateMemories(value.memories);
    // Phase 4.5 §E — read the optional v4+ `letters` field.
    const letters = hydrateLetters(value.letters);
    // Phase 4.5 §E — read the optional v4+ credential snapshot.
    // Defensive: only surface when both fields are non-empty
    // strings (a half-set pair is meaningless to the importer).
    const passwordHashSnapshot =
      typeof value.passwordHashSnapshot === 'string' && value.passwordHashSnapshot.length > 0
        ? value.passwordHashSnapshot
        : undefined;
    const passwordSaltSnapshot =
      typeof value.passwordSaltSnapshot === 'string' && value.passwordSaltSnapshot.length > 0
        ? value.passwordSaltSnapshot
        : undefined;

    return {
      ok: true,
      entries,
      customPersonas,
      memories,
      letters,
      passwordHashSnapshot,
      passwordSaltSnapshot,
      meta: {
        version: typeof value.version === 'string' ? value.version : undefined,
        exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : undefined,
        schemaVersion,
        legacy: false,
      },
    };
  }

  // Legacy payload: { version, entries }
  const entries = ensureEntries(value.entries);
  if (!entries) {
    return { ok: false, reason: 'wrong-shape' };
  }

  return {
    ok: true,
    entries,
    customPersonas: [],
    memories: [],
    letters: [],
    meta: {
      version: typeof value.version === 'string' ? value.version : undefined,
      legacy: true,
    },
  };
};
