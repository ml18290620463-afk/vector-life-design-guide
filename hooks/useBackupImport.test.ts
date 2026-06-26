import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useBackupImport } from './useBackupImport';
import type { TranslationDictionary } from '../i18n/translations';

const t = {
  importInvalidJson: 'invalid-json',
  importWrongShape: 'wrong-shape',
  importWrongType: 'wrong-type',
  importUnsupportedVersion: 'unsupported-version',
  importCountMismatch: 'count-mismatch',
  importConfirm: 'confirm-{count}',
  importSuccess: 'ok-{count}-{total}',
  importUnknown: 'unknown',
} as unknown as TranslationDictionary;

const buildEvent = (text: string) =>
  ({
    target: { files: [new File([text], 'backup.json', { type: 'application/json' })] },
  }) as unknown as React.ChangeEvent<HTMLInputElement>;

describe('useBackupImport', () => {
  it('reports a parse failure status without calling onImportBackup', async () => {
    const onImportBackup = vi.fn();
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t, confirm: () => true }),
    );

    await act(async () => {
      await result.current.handleChange(buildEvent('{not json'));
    });

    expect(onImportBackup).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'error', message: 'invalid-json' });
  });

  it('passes parsed entries through to onImportBackup on confirm', async () => {
    const onImportBackup = vi
      .fn()
      .mockResolvedValue({ importedCount: 2, totalAfter: 5, mode: 'merge' });
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t, confirm: () => true }),
    );

    const payload = JSON.stringify({
      type: 'vector-vault-backup',
      schemaVersion: 1,
      entries: [
        {
          id: 'a',
          title: 'A',
          content: 'aa',
          createdAt: 1,
          tags: [],
          isLocked: false,
        },
        {
          id: 'b',
          title: 'B',
          content: 'bb',
          createdAt: 2,
          tags: [],
          isLocked: false,
        },
      ],
    });

    await act(async () => {
      await result.current.handleChange(buildEvent(payload));
    });

    expect(onImportBackup).toHaveBeenCalledOnce();
    expect(result.current.status).toEqual({ kind: 'success', message: 'ok-2-5' });
  });

  it('awaits async confirm callbacks (modal-style)', async () => {
    const onImportBackup = vi
      .fn()
      .mockResolvedValue({ importedCount: 1, totalAfter: 1, mode: 'merge' });
    const confirm = vi.fn(async () => true);

    const { result } = renderHook(() => useBackupImport({ onImportBackup, t, confirm }));

    const payload = JSON.stringify({
      type: 'vector-vault-backup',
      schemaVersion: 1,
      entries: [
        {
          id: 'a',
          title: 'A',
          content: 'aa',
          createdAt: 1,
          tags: [],
          isLocked: false,
        },
      ],
    });

    await act(async () => {
      await result.current.handleChange(buildEvent(payload));
    });

    expect(confirm).toHaveBeenCalledOnce();
    expect(onImportBackup).toHaveBeenCalledOnce();
    expect(result.current.status?.kind).toBe('success');
  });

  it('does nothing when the file input is empty', async () => {
    const onImportBackup = vi.fn();
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t, confirm: () => true }),
    );
    const emptyEvent = {
      target: { files: null },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleChange(emptyEvent);
    });
    expect(onImportBackup).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
  });

  it('does nothing when onImportBackup is omitted (feature-flag off)', async () => {
    const { result } = renderHook(() => useBackupImport({ t, confirm: () => true }));
    await act(async () => {
      await result.current.handleChange(buildEvent('{}'));
    });
    expect(result.current.status).toBeNull();
  });

  it('catches a thrown onImportBackup, sets the error status and routes through reportError', async () => {
    const onImportBackup = vi.fn(async () => {
      throw new Error('upstream merge failed');
    });
    const reportError = vi.fn();
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t, confirm: () => true, reportError }),
    );
    const payload = JSON.stringify({
      type: 'vector-vault-backup',
      schemaVersion: 1,
      entries: [{ id: 'x', title: 'X', content: 'x', createdAt: 1, tags: [], isLocked: false }],
    });
    await act(async () => {
      await result.current.handleChange(buildEvent(payload));
    });
    expect(result.current.status).toEqual({ kind: 'error', message: 'unknown' });
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('falls back to default English copy when the translation dictionary lacks the key', async () => {
    const onImportBackup = vi.fn();
    const sparseT = {} as unknown as TranslationDictionary;
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t: sparseT, confirm: () => true }),
    );
    await act(async () => {
      await result.current.handleChange(buildEvent('{not json'));
    });
    expect(result.current.status).toEqual({
      kind: 'error',
      message: 'Backup file is not valid JSON.',
    });
  });

  it('exposes setStatus so callers can manually clear the banner', async () => {
    const onImportBackup = vi.fn();
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t, confirm: () => true }),
    );
    await act(async () => {
      await result.current.handleChange(buildEvent('{not json'));
    });
    expect(result.current.status).not.toBeNull();
    act(() => result.current.setStatus(null));
    expect(result.current.status).toBeNull();
  });

  it('aborts when the user declines the confirm dialog', async () => {
    const onImportBackup = vi.fn();
    const { result } = renderHook(() =>
      useBackupImport({ onImportBackup, t, confirm: () => false }),
    );

    const payload = JSON.stringify({
      type: 'vector-vault-backup',
      schemaVersion: 1,
      entries: [{ id: 'a', title: 'A', content: 'aa', createdAt: 1, tags: [], isLocked: false }],
    });

    await act(async () => {
      await result.current.handleChange(buildEvent(payload));
    });

    expect(onImportBackup).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
  });
});
