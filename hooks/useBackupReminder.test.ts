import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBackupReminder } from './useBackupReminder';
import { AppStorageKeys, BACKUP_REMINDER_MS } from '../services/appSettings';
import { removeStoredValue, setStoredString, getStoredString } from '../services/browserStorage';

beforeEach(() => {
  removeStoredValue(AppStorageKeys.lastBackupAt);
});

afterEach(() => {
  removeStoredValue(AppStorageKeys.lastBackupAt);
});

describe('useBackupReminder', () => {
  it('does not nag when the user has zero entries', () => {
    const { result } = renderHook(() => useBackupReminder(0));
    expect(result.current.lastBackupAt).toBeNull();
    expect(result.current.backupReminderActive).toBe(false);
  });

  it('flags overdue when the user has entries but has never exported', () => {
    const { result } = renderHook(() => useBackupReminder(3));
    expect(result.current.lastBackupAt).toBeNull();
    expect(result.current.backupReminderActive).toBe(true);
    expect(result.current.daysSinceBackup).toBeNull();
  });

  it('does not flag overdue when the last export is recent', () => {
    setStoredString(AppStorageKeys.lastBackupAt, String(Date.now() - 1_000));
    const { result } = renderHook(() => useBackupReminder(3));
    expect(result.current.backupReminderActive).toBe(false);
  });

  it('flags overdue when the last export is older than BACKUP_REMINDER_MS', () => {
    setStoredString(AppStorageKeys.lastBackupAt, String(Date.now() - BACKUP_REMINDER_MS - 1_000));
    const { result } = renderHook(() => useBackupReminder(3));
    expect(result.current.backupReminderActive).toBe(true);
    expect(result.current.daysSinceBackup).not.toBeNull();
    expect(result.current.daysSinceBackup as number).toBeGreaterThan(0);
  });

  it('recordBackup() persists the new timestamp and clears the overdue state immediately', () => {
    setStoredString(AppStorageKeys.lastBackupAt, String(Date.now() - BACKUP_REMINDER_MS - 1_000));
    const { result } = renderHook(() => useBackupReminder(3));
    expect(result.current.backupReminderActive).toBe(true);
    act(() => result.current.recordBackup());
    expect(result.current.backupReminderActive).toBe(false);
    const written = getStoredString(AppStorageKeys.lastBackupAt);
    expect(written).not.toBeNull();
    expect(Number(written)).toBeCloseTo(result.current.lastBackupAt as number, -2);
  });

  it('ignores corrupt persisted values (NaN, negative)', () => {
    setStoredString(AppStorageKeys.lastBackupAt, 'not-a-number');
    const { result } = renderHook(() => useBackupReminder(3));
    // Corrupt value → treated as never exported → still overdue.
    expect(result.current.lastBackupAt).toBeNull();
    expect(result.current.backupReminderActive).toBe(true);
  });
});
