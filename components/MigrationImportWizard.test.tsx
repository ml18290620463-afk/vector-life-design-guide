import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MigrationImportWizard } from './MigrationImportWizard';
import { TRANSLATIONS } from '../constants';
import { buildMigrationPackage } from '../services/migrationPackage';
import {
  __resetDeviceKeypairForTests,
  ensureDeviceKeypair,
  unlockSecretKey,
} from '../services/deviceKeypair';
import { __resetTrustedDevicesForTests } from '../services/trustedDevices';
import type { DiaryEntry } from '../types';

const t = TRANSLATIONS.zh;

const fixedDate = new Date('2026-05-01T10:20:30Z');
const sampleEntry: DiaryEntry = {
  id: 'e1',
  title: 'sample',
  content: 'body',
  createdAt: fixedDate.getTime(),
  tags: [],
  isLocked: false,
};

const buildPackageContent = async (withCreds = false) => {
  const built = await buildMigrationPackage({
    version: 'v1',
    entries: [sampleEntry],
    currentUser: 'pilot',
    customPersonas: [],
    memories: [],
    letters: [],
    passwordHash: withCreds ? 'pbkdf2-sha256:v1:600000:abc==' : null,
    passwordSalt: withCreds ? 'salt-base64==' : null,
    now: fixedDate,
  });
  return built.content;
};

const buildSignedPackageContent = async (pw = 'sig-test-pw') => {
  await __resetDeviceKeypairForTests();
  await __resetTrustedDevicesForTests();
  const identity = await ensureDeviceKeypair(pw);
  const secret = await unlockSecretKey(pw);
  const built = await buildMigrationPackage({
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
  return { content: built.content, fingerprint: identity.fingerprint };
};

describe('MigrationImportWizard', () => {
  beforeEach(async () => {
    await __resetDeviceKeypairForTests();
    await __resetTrustedDevicesForTests();
  });
  afterEach(async () => {
    cleanup();
    await __resetDeviceKeypairForTests();
    await __resetTrustedDevicesForTests();
  });

  it('renders the pick-file phase with a CTA to choose a file', () => {
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={vi.fn()}
      />,
    );
    expect(screen.getByText(t.migrationImportTitle as string)).toBeDefined();
    expect(screen.getByTestId('migration-wizard-file-cta')).toBeDefined();
  });

  it('after selecting a file, advances to preview with the parsed summary', async () => {
    const content = await buildPackageContent();
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={vi.fn().mockResolvedValue({ importedCount: 1 })}
      />,
    );
    const file = new File([content], 'test.vectormigration', { type: 'application/json' });
    const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-summary')).toBeDefined();
    });
  });

  it('apply (no credentials) → done state with outcome counts', async () => {
    const content = await buildPackageContent();
    const onReplaceEntries = vi.fn().mockResolvedValue({ importedCount: 1 });
    const onComplete = vi.fn();
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={onReplaceEntries}
        onComplete={onComplete}
      />,
    );
    const file = new File([content], 'test.vectormigration');
    const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-summary')).toBeDefined();
    });
    // Phase 4 §4.b-3 — buildPackageContent helper produces an
    // unsigned package, so the wizard now requires the
    // "I have verified the short code" checkbox before apply.
    const acceptUnsigned = screen.getByTestId(
      'migration-wizard-accept-unsigned',
    ) as HTMLInputElement;
    fireEvent.click(acceptUnsigned);
    fireEvent.click(screen.getByTestId('migration-wizard-apply'));
    await waitFor(() => {
      expect(screen.getByText(t.migrationImportDone as string)).toBeDefined();
    });
    expect(onReplaceEntries).toHaveBeenCalled();
  });

  it('preview with credentials shows the password input + blocks apply on mismatch', async () => {
    const content = await buildPackageContent(true);
    const verifyMock = vi.fn().mockResolvedValue(false);
    // We can't inject verifyPassword via the component (the hook
    // owns it), so we patch SecurityService for this test.
    const { SecurityService } = await import('../services/securityService');
    const orig = SecurityService.verifyPassword;
    SecurityService.verifyPassword = verifyMock as never;
    try {
      render(
        <MigrationImportWizard
          open
          onClose={vi.fn()}
          theme="dark"
          t={t}
          onReplaceEntries={vi.fn().mockResolvedValue({ importedCount: 1 })}
        />,
      );
      const file = new File([content], 'test.vectormigration');
      const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file] });
      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByTestId('migration-wizard-password')).toBeDefined();
      });
      const pw = screen.getByTestId('migration-wizard-password') as HTMLInputElement;
      fireEvent.change(pw, { target: { value: 'wrong-pw' } });
      fireEvent.click(screen.getByTestId('migration-wizard-apply'));
      await waitFor(() => {
        expect(screen.getByTestId('migration-wizard-error')).toBeDefined();
      });
    } finally {
      SecurityService.verifyPassword = orig;
    }
  });

  /* -------------------------------------------------------------- *
   * Phase 4 §4.b-3 — signature surfaces in the wizard UI            *
   * -------------------------------------------------------------- */

  it('signed package preview shows the green "valid signature" badge', async () => {
    const { content, fingerprint } = await buildSignedPackageContent();
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={vi.fn().mockResolvedValue({ importedCount: 1 })}
      />,
    );
    const file = new File([content], 'signed.vectormigration');
    const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-signature-valid')).toBeDefined();
    });
    expect(screen.getByTestId('migration-wizard-signature-valid').textContent).toContain(
      fingerprint,
    );
  });

  it('unsigned package shows the amber unsigned warning + checkbox', async () => {
    const content = await buildPackageContent();
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={vi.fn().mockResolvedValue({ importedCount: 1 })}
      />,
    );
    const file = new File([content], 'unsigned.vectormigration');
    const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-signature-unsigned')).toBeDefined();
    });
    const checkbox = screen.getByTestId('migration-wizard-accept-unsigned') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('signed + unknown publicKey routes to the verify-trust phase on apply', async () => {
    const { content } = await buildSignedPackageContent();
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={vi.fn().mockResolvedValue({ importedCount: 1 })}
      />,
    );
    const file = new File([content], 'signed.vectormigration');
    const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-summary')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('migration-wizard-apply'));
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-verify-trust')).toBeDefined();
    });
    expect(screen.getByTestId('migration-wizard-trust-accept')).toBeDefined();
    // §4.b-3 K2 — QR renders inside the verify-trust pane so the
    // user can compare it screen-to-screen with the source device.
    const pane = screen.getByTestId('migration-wizard-verify-trust');
    expect(pane.querySelector('[data-testid="fingerprint-qr"]')).not.toBeNull();
  });

  it('tampered signed package surfaces the red "invalid signature" badge', async () => {
    const { content } = await buildSignedPackageContent();
    const tampered = content.replace('"version": "v1"', '"version": "evil"');
    render(
      <MigrationImportWizard
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        onReplaceEntries={vi.fn().mockResolvedValue({ importedCount: 1 })}
      />,
    );
    const file = new File([tampered], 'tampered.vectormigration');
    const input = screen.getByTestId('migration-wizard-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId('migration-wizard-signature-invalid')).toBeDefined();
    });
  });
});
