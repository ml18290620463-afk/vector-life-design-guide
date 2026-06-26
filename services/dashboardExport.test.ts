import { describe, expect, it } from 'vitest';
import { DiaryEntry } from '../types';
import { TRANSLATIONS } from '../constants';
import { buildBackupExport, buildNotesExport } from './dashboardExport';

const entry = (overrides: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'entry-1',
  title: 'Entry One',
  content: 'content',
  createdAt: 1000,
  tags: [],
  isLocked: false,
  ...overrides,
});

const now = new Date('2026-05-01T10:20:30.000Z');

describe('dashboardExport', () => {
  it('builds a stable backup filename and schema-tagged JSON payload (v2 — Phase 4 §5.1.A)', () => {
    const result = buildBackupExport({
      version: 'v1.2.3',
      entries: [entry({ id: 'backup-entry' })],
      currentUser: 'pilot@example.com',
      now,
    });

    expect(result.filename).toBe('VECTOR_PILOT_EXAMPLE.COM_BACKUP_2026-05-01T10-20-30-000Z.json');
    // schemaVersion = 5 since Phase 4 §4.b-3 (Ed25519 signature +
    // publicKey fields added to the schema; signature itself is
    // injected by `signBackup` later in the pipeline, not by
    // buildBackupExport, so a "regular" Settings export is still
    // unsigned at the buildBackupExport stage).
    expect(JSON.parse(result.content)).toEqual({
      type: 'vector-vault-backup',
      schemaVersion: 5,
      version: 'v1.2.3',
      exportedAt: '2026-05-01T10:20:30.000Z',
      entryCount: 1,
      entries: [
        {
          id: 'backup-entry',
          title: 'Entry One',
          content: 'content',
          createdAt: 1000,
          tags: [],
          isLocked: false,
        },
      ],
    });
  });

  it('exports only non-archived notes for all mode and redacts embedded image data', () => {
    const result = buildNotesExport({
      mode: 'all',
      entries: [
        entry({
          id: 'visible',
          title: 'Visible',
          content: 'hello ![x](data:image/png;base64,abc)',
        }),
        entry({ id: 'archived', title: 'Archived', isArchived: true }),
      ],
      filteredEntries: [],
      labels: TRANSLATIONS.zh,
      currentUser: null,
      now,
    });

    expect(result?.filename).toBe('VECTOR_ALL_NOTES_GUEST_2026-05-01T10-20-30-000Z.txt');
    expect(result?.content).toContain('【 Visible 】');
    expect(result?.content).toContain('[IMAGE_DATA]');
    expect(result?.content).not.toContain('Archived');
  });

  it('returns null when a requested single note does not exist', () => {
    const result = buildNotesExport({
      mode: 'missing',
      entries: [entry({ id: 'present' })],
      filteredEntries: [],
      labels: TRANSLATIONS.zh,
      currentUser: 'pilot@example.com',
      now,
    });

    expect(result).toBeNull();
  });
});
