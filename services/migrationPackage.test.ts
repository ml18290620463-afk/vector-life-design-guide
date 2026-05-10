import { describe, expect, it, vi } from 'vitest';
import {
  applyMigrationPackage,
  buildMigrationPackage,
  computeShortCode,
  parseMigrationPackage,
} from './migrationPackage';
import type { CustomPersona, DiaryEntry, Memory, PendingLetter } from '../types';

const fixedDate = new Date('2026-05-01T10:20:30Z');

const sampleEntry: DiaryEntry = {
  id: 'e1',
  title: 'sample',
  content: 'body',
  createdAt: fixedDate.getTime(),
  tags: [],
  isLocked: false,
};

const samplePersona: CustomPersona = {
  id: 'persona-1',
  name: '乔布斯',
  kind: 'persona',
  systemPrompt: 'x'.repeat(200),
  createdAt: 1,
  updatedAt: 1,
};

const sampleMemoir: CustomPersona = {
  id: 'memoir-1',
  name: '奶奶',
  kind: 'memoir',
  systemPrompt: 'x'.repeat(200),
  createdAt: 1,
  updatedAt: 1,
};

const sampleMemory: Memory = {
  id: 'memory-1',
  memoirId: 'memoir-1',
  category: 'fact',
  body: '用户上周面试通过了',
  createdAt: 1,
  updatedAt: 1,
};

const sampleLetter: PendingLetter = {
  id: 'letter-1',
  memoirId: 'memoir-1',
  body: '想跟你说一件事',
  composedAt: 1,
  deliverAt: 2,
  status: 'pending',
};

describe('services/migrationPackage', () => {
  describe('computeShortCode', () => {
    it('returns a stable 6-char base32-ish code for a given input', async () => {
      const code = await computeShortCode('hello world');
      expect(code).toHaveLength(6);
      const code2 = await computeShortCode('hello world');
      expect(code2).toBe(code);
    });

    it('returns different codes for different inputs', async () => {
      const a = await computeShortCode('foo');
      const b = await computeShortCode('bar');
      expect(a).not.toBe(b);
    });
  });

  describe('buildMigrationPackage', () => {
    it('serialises a v4 backup with letters + credential snapshot when both fields are supplied', async () => {
      const pkg = await buildMigrationPackage({
        version: 'v1.2.3',
        entries: [sampleEntry],
        currentUser: 'pilot@example.com',
        customPersonas: [samplePersona, sampleMemoir],
        memories: [sampleMemory],
        letters: [sampleLetter],
        passwordHash: 'pbkdf2-sha256:v1:600000:abc==',
        passwordSalt: 'salt-base64==',
        now: fixedDate,
      });
      expect(pkg.filename).toMatch(/\.vectormigration$/);
      expect(pkg.shortCode).toHaveLength(6);
      expect(pkg.hasCredentials).toBe(true);
      const body = JSON.parse(pkg.content);
      expect(body.schemaVersion).toBe(5);
      expect(body.entries).toHaveLength(1);
      expect(body.customPersonas).toHaveLength(2);
      expect(body.memories).toHaveLength(1);
      expect(body.letters).toHaveLength(1);
      expect(body.passwordHashSnapshot).toBe('pbkdf2-sha256:v1:600000:abc==');
      expect(body.passwordSaltSnapshot).toBe('salt-base64==');
    });

    it('omits the credential snapshot when source has no password set', async () => {
      const pkg = await buildMigrationPackage({
        version: 'v1.2.3',
        entries: [sampleEntry],
        currentUser: 'guest',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        now: fixedDate,
      });
      expect(pkg.hasCredentials).toBe(false);
      const body = JSON.parse(pkg.content);
      expect(body.passwordHashSnapshot).toBeUndefined();
      expect(body.passwordSaltSnapshot).toBeUndefined();
      // Letters / customPersonas / memories empty → omitted too.
      expect(body.letters).toBeUndefined();
      expect(body.customPersonas).toBeUndefined();
      expect(body.memories).toBeUndefined();
    });
  });

  describe('parseMigrationPackage', () => {
    it('round-trips a freshly built package back into a summary', async () => {
      const built = await buildMigrationPackage({
        version: 'v9.9.9',
        entries: [sampleEntry, { ...sampleEntry, id: 'e2' }],
        currentUser: 'pilot@example.com',
        customPersonas: [samplePersona, sampleMemoir],
        memories: [sampleMemory],
        letters: [sampleLetter],
        passwordHash: 'pbkdf2-sha256:v1:600000:abc==',
        passwordSalt: 'salt-base64==',
        now: fixedDate,
      });
      const parsed = await parseMigrationPackage(built.content);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.summary.schemaVersion).toBe(5);
      expect(parsed.summary.entriesCount).toBe(2);
      expect(parsed.summary.customPersonasCount).toBe(1);
      expect(parsed.summary.memoirsCount).toBe(1);
      expect(parsed.summary.memoriesCount).toBe(1);
      expect(parsed.summary.lettersCount).toBe(1);
      expect(parsed.summary.hasCredentials).toBe(true);
      expect(parsed.summary.shortCode).toBe(built.shortCode);
    });

    it('surfaces the failure branch on malformed input', async () => {
      const parsed = await parseMigrationPackage('not json at all');
      if (parsed.ok !== false) throw new Error('expected failure');
      expect(parsed.reason).toBe('invalid-json');
    });

    it('rejects backups whose type field is foreign', async () => {
      const parsed = await parseMigrationPackage(
        JSON.stringify({ type: 'someone-elses-app', schemaVersion: 1, entries: [] }),
      );
      if (parsed.ok !== false) throw new Error('expected failure');
      expect(parsed.reason).toBe('wrong-type');
    });

    it('handles a package without the credential snapshot (hasCredentials=false)', async () => {
      const built = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'guest',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        now: fixedDate,
      });
      const parsed = await parseMigrationPackage(built.content);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.summary.hasCredentials).toBe(false);
    });
  });

  describe('applyMigrationPackage', () => {
    it('calls every wired callback and reports counts', async () => {
      const built = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'pilot',
        customPersonas: [samplePersona],
        memories: [sampleMemory],
        letters: [sampleLetter],
        passwordHash: 'pbkdf2-sha256:v1:600000:abc==',
        passwordSalt: 'salt-base64==',
        now: fixedDate,
      });
      const parsed = await parseMigrationPackage(built.content);
      if (!parsed.ok) throw new Error('parse failed');
      const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
      const onReplaceCustomPersonas = vi.fn().mockResolvedValue(undefined);
      const onReplaceMemories = vi.fn().mockResolvedValue(undefined);
      const onReplaceLetters = vi.fn().mockResolvedValue(undefined);
      const onApplyCredentialSnapshot = vi.fn().mockResolvedValue(undefined);
      const result = await applyMigrationPackage({
        parsed: parsed.parsed,
        mode: 'replace',
        onReplaceEntries,
        onReplaceCustomPersonas,
        onReplaceMemories,
        onReplaceLetters,
        onApplyCredentialSnapshot,
      });
      expect(result.errors).toEqual([]);
      expect(result.outcome.entriesApplied).toBe(1);
      expect(result.outcome.customPersonasApplied).toBe(1);
      expect(result.outcome.memoriesApplied).toBe(1);
      expect(result.outcome.lettersApplied).toBe(1);
      expect(result.outcome.credentialApplied).toBe(true);
      expect(onReplaceEntries).toHaveBeenCalledWith([sampleEntry], 'replace');
      expect(onApplyCredentialSnapshot).toHaveBeenCalledWith(
        'pbkdf2-sha256:v1:600000:abc==',
        'salt-base64==',
      );
    });

    it('captures partial-failure in the errors array without throwing', async () => {
      const built = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'pilot',
        customPersonas: [samplePersona],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        now: fixedDate,
      });
      const parsed = await parseMigrationPackage(built.content);
      if (!parsed.ok) throw new Error('parse failed');
      const result = await applyMigrationPackage({
        parsed: parsed.parsed,
        mode: 'merge',
        onReplaceEntries: vi.fn().mockResolvedValue({ importedCount: 1 }),
        onReplaceCustomPersonas: vi.fn().mockRejectedValue(new Error('IDB busy')),
      });
      expect(result.outcome.entriesApplied).toBe(1);
      expect(result.outcome.customPersonasApplied).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/customPersonas/);
    });

    it('skips credential apply when the package has no snapshot', async () => {
      const built = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'guest',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        now: fixedDate,
      });
      const parsed = await parseMigrationPackage(built.content);
      if (!parsed.ok) throw new Error('parse failed');
      const onApplyCredentialSnapshot = vi.fn();
      const result = await applyMigrationPackage({
        parsed: parsed.parsed,
        mode: 'replace',
        onReplaceEntries: vi.fn().mockResolvedValue({ importedCount: 1 }),
        onApplyCredentialSnapshot,
      });
      expect(result.outcome.credentialApplied).toBe(false);
      expect(onApplyCredentialSnapshot).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------- *
   * Phase 4 §4.b-3 — Ed25519 signed migration package roundtrip   *
   * -------------------------------------------------------------- */

  describe('Phase 4 §4.b-3 — Ed25519 signed migration', () => {
    it('an unsigned package summary surfaces signature.kind = "unsigned"', async () => {
      const pkg = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'guest',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        now: fixedDate,
      });
      expect(pkg.isSigned).toBe(false);
      expect(pkg.fingerprint).toBeNull();
      const parsed = await parseMigrationPackage(pkg.content);
      if (!parsed.ok) throw new Error('parse failed');
      expect(parsed.summary.signature.kind).toBe('unsigned');
    });

    it('a signed package roundtrips with signature.kind = "valid"', async () => {
      const { __resetDeviceKeypairForTests, ensureDeviceKeypair, unlockSecretKey } =
        await import('./deviceKeypair');
      await __resetDeviceKeypairForTests();
      const identity = await ensureDeviceKeypair('pw');
      const secret = await unlockSecretKey('pw');
      if (!secret) throw new Error('expected secret');
      const pkg = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'pilot',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        signingSecretKey: secret,
        signingPublicKey: identity.publicKey,
        now: fixedDate,
      });
      expect(pkg.isSigned).toBe(true);
      expect(pkg.fingerprint).toBe(identity.fingerprint);
      const parsed = await parseMigrationPackage(pkg.content);
      if (!parsed.ok) throw new Error('parse failed');
      expect(parsed.summary.signature.kind).toBe('valid');
      if (parsed.summary.signature.kind === 'valid') {
        expect(parsed.summary.signature.publicKey).toBe(identity.publicKey);
        expect(parsed.summary.signature.fingerprint).toBe(identity.fingerprint);
      }
      await __resetDeviceKeypairForTests();
    });

    it('a tampered signed package surfaces signature.kind = "invalid"', async () => {
      const { __resetDeviceKeypairForTests, ensureDeviceKeypair, unlockSecretKey } =
        await import('./deviceKeypair');
      await __resetDeviceKeypairForTests();
      const identity = await ensureDeviceKeypair('pw');
      const secret = await unlockSecretKey('pw');
      if (!secret) throw new Error('expected secret');
      const pkg = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'pilot',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        signingSecretKey: secret,
        signingPublicKey: identity.publicKey,
        now: fixedDate,
      });
      // Tamper with the body — change the version field after signing.
      const tampered = pkg.content.replace('"version": "v1"', '"version": "evil"');
      const parsed = await parseMigrationPackage(tampered);
      if (!parsed.ok) throw new Error('parse failed');
      expect(parsed.summary.signature.kind).toBe('invalid');
      if (parsed.summary.signature.kind === 'invalid') {
        expect(parsed.summary.signature.reason).toBe('signature-invalid');
      }
      await __resetDeviceKeypairForTests();
    });

    it('falls back to unsigned when signing material is missing', async () => {
      const pkg = await buildMigrationPackage({
        version: 'v1',
        entries: [sampleEntry],
        currentUser: 'pilot',
        customPersonas: [],
        memories: [],
        letters: [],
        passwordHash: null,
        passwordSalt: null,
        // No signingSecretKey / signingPublicKey provided.
        now: fixedDate,
      });
      expect(pkg.isSigned).toBe(false);
      expect(pkg.fingerprint).toBeNull();
    });
  });
});
