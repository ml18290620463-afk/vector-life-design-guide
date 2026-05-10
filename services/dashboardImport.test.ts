import { describe, expect, it } from 'vitest';
import { buildBackupExport } from './dashboardExport';
import { isBackupParseFailure, isBackupParseSuccess, parseBackupImport } from './dashboardImport';
import type { DiaryEntry } from '../types';

const entry = (overrides: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'e1',
  title: 'Title',
  content: 'Content',
  createdAt: 1,
  tags: [],
  isLocked: false,
  ...overrides,
});

describe('parseBackupImport', () => {
  it('round-trips a backup created by buildBackupExport', () => {
    const exported = buildBackupExport({
      version: 'v9.9.9',
      entries: [entry({ id: 'a' }), entry({ id: 'b' })],
      currentUser: 'tester',
      now: new Date('2026-05-01T00:00:00Z'),
    });

    const parsed = parseBackupImport(exported.content);
    if (!isBackupParseSuccess(parsed)) {
      throw new Error(`expected success, got ${JSON.stringify(parsed)}`);
    }
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.meta.legacy).toBe(false);
    expect(parsed.meta.version).toBe('v9.9.9');
  });

  it('accepts the legacy { version, entries } payload', () => {
    const legacy = JSON.stringify({ version: 'v0.0.0', entries: [entry({ id: 'old' })] });
    const parsed = parseBackupImport(legacy);
    if (!isBackupParseSuccess(parsed)) {
      throw new Error('expected success on legacy payload');
    }
    expect(parsed.meta.legacy).toBe(true);
    expect(parsed.entries).toHaveLength(1);
  });

  it('rejects malformed JSON', () => {
    const parsed = parseBackupImport('{not json');
    if (!isBackupParseFailure(parsed)) throw new Error('expected failure');
    expect(parsed.reason).toBe('invalid-json');
  });

  it('rejects payloads with the wrong type discriminator', () => {
    const parsed = parseBackupImport(
      JSON.stringify({ type: 'someone-elses-app', schemaVersion: 1, entries: [] }),
    );
    if (!isBackupParseFailure(parsed)) throw new Error('expected failure');
    expect(parsed.reason).toBe('wrong-type');
  });

  it('rejects future schema versions to avoid silent partial restores', () => {
    const parsed = parseBackupImport(
      JSON.stringify({
        type: 'vector-vault-backup',
        schemaVersion: 99,
        entries: [],
      }),
    );
    if (!isBackupParseFailure(parsed)) throw new Error('expected failure');
    expect(parsed.reason).toBe('unsupported-version');
  });

  it('rejects payloads where entryCount disagrees with entries.length', () => {
    const parsed = parseBackupImport(
      JSON.stringify({
        type: 'vector-vault-backup',
        schemaVersion: 1,
        entryCount: 7,
        entries: [entry({ id: 'just-one' })],
      }),
    );
    if (!isBackupParseFailure(parsed)) throw new Error('expected failure');
    expect(parsed.reason).toBe('count-mismatch');
  });

  it('rejects entries that are missing required fields', () => {
    const parsed = parseBackupImport(
      JSON.stringify({
        type: 'vector-vault-backup',
        schemaVersion: 1,
        entries: [{ id: 'no-title' }],
      }),
    );
    if (!isBackupParseFailure(parsed)) throw new Error('expected failure');
    expect(parsed.reason).toBe('wrong-shape');
  });

  describe('Phase 4 §5.1.A — schema v2 customPersonas + v1 backwards compat', () => {
    it('reads customPersonas from a v2 backup', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 2,
          version: 'v1.1.0',
          entryCount: 0,
          entries: [],
          customPersonas: [
            {
              id: 'persona-test-1',
              name: '乔布斯',
              description: 'Apple 创始人',
              kind: 'persona',
              systemPrompt: 'You are 乔布斯, ...'.padEnd(200, '.'),
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      );
      if (!isBackupParseSuccess(parsed)) {
        throw new Error('expected success');
      }
      expect(parsed.customPersonas).toHaveLength(1);
      expect(parsed.customPersonas[0].name).toBe('乔布斯');
    });

    it('treats a v1 backup (no customPersonas field) as customPersonas: []', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 1,
          entryCount: 0,
          entries: [],
        }),
      );
      if (!isBackupParseSuccess(parsed)) {
        throw new Error('expected success');
      }
      // Backwards compat: v1 backups never had customPersonas, so the
      // importer surfaces an empty array (not undefined) for callers.
      expect(parsed.customPersonas).toEqual([]);
    });

    it('treats a legacy { version, entries } backup as customPersonas: []', () => {
      const parsed = parseBackupImport(
        JSON.stringify({ version: 'v0.0.0', entries: [entry({ id: 'old' })] }),
      );
      if (!isBackupParseSuccess(parsed)) {
        throw new Error('expected success');
      }
      expect(parsed.customPersonas).toEqual([]);
    });

    it('drops malformed personas from a v2 backup without rejecting the whole file', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 2,
          entryCount: 0,
          entries: [],
          customPersonas: [
            {
              id: 'persona-1',
              name: 'good',
              kind: 'persona',
              systemPrompt: 'p'.repeat(200),
              createdAt: 1,
              updatedAt: 1,
            },
            { id: 'broken-no-name' }, // missing required fields
            null,
          ],
        }),
      );
      if (!isBackupParseSuccess(parsed)) {
        throw new Error('expected success — corrupted personas should not fail import');
      }
      expect(parsed.customPersonas).toHaveLength(1);
      expect(parsed.customPersonas[0].name).toBe('good');
    });
  });

  describe('Phase 4 §5.1.B — schema v3 memories + v1/v2 backwards compat', () => {
    it('reads memories from a v3 backup', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 3,
          entryCount: 0,
          entries: [],
          memories: [
            {
              id: 'memory-1',
              memoirId: 'memoir-1',
              category: 'fact',
              body: '用户上周面试通过了',
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.memories).toHaveLength(1);
      expect(parsed.memories[0].body).toBe('用户上周面试通过了');
    });

    it('treats a v1 / v2 backup (no memories field) as memories: []', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 2,
          entryCount: 0,
          entries: [],
        }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.memories).toEqual([]);
    });

    it('treats a legacy backup as memories: []', () => {
      const parsed = parseBackupImport(
        JSON.stringify({ version: 'v0.0.0', entries: [entry({ id: 'old' })] }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.memories).toEqual([]);
    });

    it('drops malformed memories from a v3 backup without rejecting the whole file', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 3,
          entryCount: 0,
          entries: [],
          memories: [
            {
              id: 'memory-good',
              memoirId: 'memoir-1',
              category: 'fact',
              body: 'kept',
              createdAt: 1,
              updatedAt: 1,
            },
            { id: 'broken' },
            null,
          ],
        }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.memories).toHaveLength(1);
      expect(parsed.memories[0].id).toBe('memory-good');
    });
  });

  /* -------------------------------------------------------------- */
  /*  Phase 4.5 §E — schema v4: letters + credential snapshot        */
  /* -------------------------------------------------------------- */

  describe('Phase 4.5 §E — schema v4 letters + passwordHash/Salt snapshot', () => {
    const v4Letter = {
      id: 'letter-1',
      memoirId: 'memoir-1',
      body: 'sample',
      composedAt: 1,
      deliverAt: 2,
      status: 'pending',
    };

    it('reads the v4 letters array and hydrates it', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 4,
          entryCount: 0,
          entries: [],
          letters: [v4Letter, { id: 'broken' }, null],
        }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.letters).toHaveLength(1);
      expect(parsed.letters[0].id).toBe('letter-1');
    });

    it('reads the v4 credential snapshot when both fields are present', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 4,
          entryCount: 0,
          entries: [],
          passwordHashSnapshot: 'pbkdf2-sha256:v1:600000:abc==',
          passwordSaltSnapshot: 'salt-base64==',
        }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.passwordHashSnapshot).toBe('pbkdf2-sha256:v1:600000:abc==');
      expect(parsed.passwordSaltSnapshot).toBe('salt-base64==');
    });

    it('treats half-set credential snapshot as undefined (defensive)', () => {
      const parsed = parseBackupImport(
        JSON.stringify({
          type: 'vector-vault-backup',
          schemaVersion: 4,
          entryCount: 0,
          entries: [],
          passwordHashSnapshot: '',
        }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.passwordHashSnapshot).toBeUndefined();
      expect(parsed.passwordSaltSnapshot).toBeUndefined();
    });

    it('treats v1 / v2 / v3 backups as letters: [] + no credential snapshot', () => {
      for (const v of [1, 2, 3]) {
        const parsed = parseBackupImport(
          JSON.stringify({
            type: 'vector-vault-backup',
            schemaVersion: v,
            entryCount: 0,
            entries: [],
          }),
        );
        if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
        expect(parsed.letters).toEqual([]);
        expect(parsed.passwordHashSnapshot).toBeUndefined();
        expect(parsed.passwordSaltSnapshot).toBeUndefined();
      }
    });

    it('treats legacy { version, entries } as letters: []', () => {
      const parsed = parseBackupImport(
        JSON.stringify({ version: 'v0.0.0', entries: [entry({ id: 'old' })] }),
      );
      if (!isBackupParseSuccess(parsed)) throw new Error('expected success');
      expect(parsed.letters).toEqual([]);
    });
  });
});
