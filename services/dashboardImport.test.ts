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
  it('round-trips a lightweight backup created by buildBackupExport', () => {
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
});
