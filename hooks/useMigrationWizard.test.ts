import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMigrationWizard } from './useMigrationWizard';
import { buildMigrationPackage } from '../services/migrationPackage';
import {
  __resetDeviceKeypairForTests,
  ensureDeviceKeypair,
  unlockSecretKey,
} from '../services/deviceKeypair';
import { __resetTrustedDevicesForTests, trustPublicKey } from '../services/trustedDevices';
import type { DiaryEntry } from '../types';

const fixedDate = new Date('2026-05-01T10:20:30Z');
const TEST_PW = 'pw-for-tests';

const sampleEntry: DiaryEntry = {
  id: 'e1',
  title: 'sample',
  content: 'body',
  createdAt: fixedDate.getTime(),
  tags: [],
  isLocked: false,
};

/**
 * Build a real package + return its serialised content for tests.
 * Phase 4 §4.b-3 — by default we **sign** the package and pre-trust
 * the signing key so the wizard's verify-trust gate is auto-passed.
 * Tests that want to drive the verify-trust phase explicitly pass
 * `signed: false` (unsigned + acceptedUnsigned needed) or
 * `preTrust: false` (signed but not yet trusted → verify-trust
 * phase is hit on confirmAndApply).
 */
const buildPackage = async (
  opts: { withCredentials?: boolean; signed?: boolean; preTrust?: boolean } = {},
) => {
  const signed = opts.signed !== false;
  const preTrust = opts.preTrust !== false;
  let signingSecretKey: Uint8Array | null = null;
  let signingPublicKey: string | null = null;
  if (signed) {
    await __resetDeviceKeypairForTests();
    const identity = await ensureDeviceKeypair(TEST_PW);
    signingSecretKey = await unlockSecretKey(TEST_PW);
    signingPublicKey = identity.publicKey;
    if (preTrust) {
      await __resetTrustedDevicesForTests();
      await trustPublicKey(identity.publicKey, 'test-source');
    } else {
      await __resetTrustedDevicesForTests();
    }
  }
  const built = await buildMigrationPackage({
    version: 'v1',
    entries: [sampleEntry],
    currentUser: 'pilot',
    customPersonas: [],
    memories: [],
    letters: [],
    passwordHash: opts.withCredentials ? 'pbkdf2-sha256:v1:600000:abc==' : null,
    passwordSalt: opts.withCredentials ? 'salt-base64==' : null,
    signingSecretKey,
    signingPublicKey,
    now: fixedDate,
  });
  return built.content;
};

describe('useMigrationWizard', () => {
  beforeEach(async () => {
    await __resetDeviceKeypairForTests();
    await __resetTrustedDevicesForTests();
  });
  afterEach(async () => {
    await __resetDeviceKeypairForTests();
    await __resetTrustedDevicesForTests();
  });

  it('starts at phase=pick-file with empty state', () => {
    const { result } = renderHook(() =>
      useMigrationWizard({
        onReplaceEntries: vi.fn(),
      }),
    );
    expect(result.current.phase).toBe('pick-file');
    expect(result.current.summary).toBeNull();
    expect(result.current.outcome).toBeNull();
    expect(result.current.password).toBe('');
    expect(result.current.mode).toBe('replace');
  });

  it('loadFromText transitions pick-file → preview with the parsed summary', async () => {
    const content = await buildPackage();
    const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
    await act(async () => {
      await result.current.loadFromText(content);
    });
    expect(result.current.phase).toBe('preview');
    expect(result.current.summary?.entriesCount).toBe(1);
  });

  it('loadFromText flips to error phase on malformed input', async () => {
    const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
    await act(async () => {
      await result.current.loadFromText('not json at all');
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('confirmAndApply (no credentials) goes preview → applying → done', async () => {
    const content = await buildPackage();
    const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
    const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries }));
    await act(async () => {
      await result.current.loadFromText(content);
    });
    await act(async () => {
      await result.current.confirmAndApply();
    });
    expect(result.current.phase).toBe('done');
    expect(result.current.outcome?.entriesApplied).toBe(1);
    expect(result.current.errors).toEqual([]);
    expect(onReplaceEntries).toHaveBeenCalledWith([sampleEntry], 'replace');
  });

  it('confirmAndApply (credentials present, password mismatch) stays at preview with PASSWORD_MISMATCH', async () => {
    const content = await buildPackage({ withCredentials: true });
    const verifyPassword = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMigrationWizard({
        onReplaceEntries: vi.fn(),
        verifyPassword,
      }),
    );
    await act(async () => {
      await result.current.loadFromText(content);
    });
    act(() => result.current.setPassword('wrong-pw'));
    await act(async () => {
      await result.current.confirmAndApply();
    });
    expect(result.current.phase).toBe('preview');
    expect(result.current.errorMessage).toBe('PASSWORD_MISMATCH');
  });

  it('confirmAndApply (credentials present, no password typed) errors PASSWORD_REQUIRED', async () => {
    const content = await buildPackage({ withCredentials: true });
    const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
    await act(async () => {
      await result.current.loadFromText(content);
    });
    await act(async () => {
      await result.current.confirmAndApply();
    });
    expect(result.current.errorMessage).toBe('PASSWORD_REQUIRED');
    expect(result.current.phase).toBe('preview');
  });

  it('confirmAndApply (credentials present, correct password) verifies + applies + invokes credential hook', async () => {
    const content = await buildPackage({ withCredentials: true });
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const onApplyCredentialSnapshot = vi.fn().mockResolvedValue(undefined);
    const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
    const { result } = renderHook(() =>
      useMigrationWizard({
        onReplaceEntries,
        onApplyCredentialSnapshot,
        verifyPassword,
      }),
    );
    await act(async () => {
      await result.current.loadFromText(content);
    });
    act(() => result.current.setPassword('correct-pw'));
    await act(async () => {
      await result.current.confirmAndApply();
    });
    expect(verifyPassword).toHaveBeenCalledWith(
      'correct-pw',
      'salt-base64==',
      'pbkdf2-sha256:v1:600000:abc==',
    );
    expect(onApplyCredentialSnapshot).toHaveBeenCalledWith(
      'pbkdf2-sha256:v1:600000:abc==',
      'salt-base64==',
    );
    expect(result.current.phase).toBe('done');
    expect(result.current.outcome?.credentialApplied).toBe(true);
  });

  it('mode toggle threads through to onReplaceEntries', async () => {
    const content = await buildPackage();
    const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
    const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries }));
    await act(async () => {
      await result.current.loadFromText(content);
    });
    act(() => result.current.setMode('merge'));
    await act(async () => {
      await result.current.confirmAndApply();
    });
    expect(onReplaceEntries).toHaveBeenCalledWith([sampleEntry], 'merge');
  });

  it('reset returns to pick-file with empty state', async () => {
    const content = await buildPackage();
    const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
    await act(async () => {
      await result.current.loadFromText(content);
    });
    act(() => result.current.setPassword('foo'));
    act(() => result.current.reset());
    expect(result.current.phase).toBe('pick-file');
    expect(result.current.summary).toBeNull();
    expect(result.current.password).toBe('');
  });

  /* -------------------------------------------------------------- *
   * Phase 4 §4.b-3 — Ed25519 signature gate                         *
   * -------------------------------------------------------------- */

  describe('Phase 4 §4.b-3 — signature gate', () => {
    it('unsigned package blocks confirmAndApply with UNSIGNED_NOT_ACCEPTED', async () => {
      const content = await buildPackage({ signed: false });
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      expect(result.current.summary?.signature.kind).toBe('unsigned');
      await act(async () => {
        await result.current.confirmAndApply();
      });
      expect(result.current.errorMessage).toBe('UNSIGNED_NOT_ACCEPTED');
      expect(result.current.phase).toBe('preview');
    });

    it('unsigned package proceeds when acceptedUnsigned is set', async () => {
      const content = await buildPackage({ signed: false });
      const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      act(() => result.current.setAcceptedUnsigned(true));
      await act(async () => {
        await result.current.confirmAndApply();
      });
      expect(result.current.phase).toBe('done');
    });

    it('signed + unknown publicKey routes to verify-trust phase', async () => {
      const content = await buildPackage({ signed: true, preTrust: false });
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      expect(result.current.summary?.signature.kind).toBe('valid');
      await act(async () => {
        await result.current.confirmAndApply();
      });
      expect(result.current.phase).toBe('verify-trust');
    });

    it('acceptTrust persists trust + returns to preview', async () => {
      const content = await buildPackage({ signed: true, preTrust: false });
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      await act(async () => {
        await result.current.confirmAndApply();
      });
      expect(result.current.phase).toBe('verify-trust');
      await act(async () => {
        await result.current.acceptTrust('My old phone');
      });
      expect(result.current.phase).toBe('preview');
      expect(result.current.errorMessage).toBeNull();
    });

    it('rejectTrust returns to preview with TRUST_REJECTED banner', async () => {
      const content = await buildPackage({ signed: true, preTrust: false });
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      await act(async () => {
        await result.current.confirmAndApply();
      });
      act(() => result.current.rejectTrust());
      expect(result.current.phase).toBe('preview');
      expect(result.current.errorMessage).toBe('TRUST_REJECTED');
    });

    it('signed + already-trusted package skips verify-trust + applies', async () => {
      const content = await buildPackage({ signed: true, preTrust: true });
      const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      await act(async () => {
        await result.current.confirmAndApply();
      });
      expect(result.current.phase).toBe('done');
      expect(onReplaceEntries).toHaveBeenCalled();
    });

    it('tampered signed package surfaces signature.kind = invalid + blocks apply', async () => {
      const original = await buildPackage({ signed: true, preTrust: true });
      // Tamper with the body — change the version field after signing.
      const content = original.replace('"version": "v1"', '"version": "tamper"');
      const { result } = renderHook(() => useMigrationWizard({ onReplaceEntries: vi.fn() }));
      await act(async () => {
        await result.current.loadFromText(content);
      });
      expect(result.current.summary?.signature.kind).toBe('invalid');
      await act(async () => {
        await result.current.confirmAndApply();
      });
      expect(result.current.errorMessage).toBe('SIGNATURE_INVALID');
      expect(result.current.phase).toBe('preview');
    });
  });
});
