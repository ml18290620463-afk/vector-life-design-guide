import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MigrationExportModal } from './MigrationExportModal';
import { TRANSLATIONS } from '../constants';
import {
  __resetDeviceKeypairForTests,
  ensureDeviceKeypair,
  unlockSecretKey,
} from '../services/deviceKeypair';
import type { DiaryEntry } from '../types';

const t = TRANSLATIONS.zh;

const sampleEntry: DiaryEntry = {
  id: 'e1',
  title: 'sample',
  content: 'body',
  createdAt: 1_700_000_000_000,
  tags: [],
  isLocked: false,
};

describe('MigrationExportModal', () => {
  beforeEach(async () => {
    await __resetDeviceKeypairForTests();
  });
  afterEach(async () => {
    cleanup();
    await __resetDeviceKeypairForTests();
  });

  it('renders the title + the credentials checkbox enabled when password is set', () => {
    render(
      <MigrationExportModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        version="v1"
        entries={[sampleEntry]}
        customPersonas={[]}
        memories={[]}
        letters={[]}
        currentUser="pilot"
        passwordHash="pbkdf2-sha256:v1:600000:abc=="
        passwordSalt="salt-base64=="
      />,
    );
    expect(screen.getByText(t.migrationExportTitle as string)).toBeDefined();
    const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb).toBeDefined();
    expect(cb.disabled).toBe(false);
    expect(cb.checked).toBe(true);
  });

  it('greys the credential checkbox when no password is set', () => {
    render(
      <MigrationExportModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        version="v1"
        entries={[sampleEntry]}
        customPersonas={[]}
        memories={[]}
        letters={[]}
        currentUser="guest"
        passwordHash={null}
        passwordSalt={null}
      />,
    );
    const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb.disabled).toBe(true);
    expect(cb.checked).toBe(false);
  });

  it('clicking generate produces a summary with shortCode + download CTA', async () => {
    render(
      <MigrationExportModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        version="v1"
        entries={[sampleEntry]}
        customPersonas={[]}
        memories={[]}
        letters={[]}
        currentUser="pilot"
        passwordHash="pbkdf2-sha256:v1:600000:abc=="
        passwordSalt="salt-base64=="
      />,
    );
    fireEvent.click(screen.getByLabelText(t.migrationExportGenerate as string));
    await waitFor(() => {
      expect(screen.getByTestId('migration-export-summary')).toBeDefined();
    });
    const code = screen.getByTestId('migration-export-summary').querySelector('.text-2xl');
    expect(code?.textContent?.length).toBe(6);
  });

  /* -------------------------------------------------------------- *
   * §4.b-3 follow-up K2 — fingerprint QR                           *
   * -------------------------------------------------------------- */

  it('signed export shows the fingerprint card + QR after Generate', async () => {
    await __resetDeviceKeypairForTests();
    const identity = await ensureDeviceKeypair('pw');
    const secret = await unlockSecretKey('pw');
    const onUnlockSigningKey = vi
      .fn()
      .mockResolvedValue({ secretKey: secret!, publicKey: identity.publicKey });

    render(
      <MigrationExportModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        version="v1"
        entries={[sampleEntry]}
        customPersonas={[]}
        memories={[]}
        letters={[]}
        currentUser="pilot"
        passwordHash="pbkdf2-sha256:v1:600000:abc=="
        passwordSalt="salt-base64=="
        onUnlockSigningKey={onUnlockSigningKey}
      />,
    );
    fireEvent.click(screen.getByLabelText(t.migrationExportGenerate as string));
    await waitFor(() => {
      expect(screen.getByTestId('migration-export-fingerprint')).toBeDefined();
    });
    // K2: a `<FingerprintQr>` should render inside the fingerprint card.
    const card = screen.getByTestId('migration-export-fingerprint');
    expect(card.querySelector('[data-testid="fingerprint-qr"]')).not.toBeNull();
  });
});
