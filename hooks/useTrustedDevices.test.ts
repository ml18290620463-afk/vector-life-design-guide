import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTrustedDevices } from './useTrustedDevices';
import { __resetTrustedDevicesForTests, trustPublicKey } from '../services/trustedDevices';

const KEY_A = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const KEY_B = 'IiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QA==';

describe('useTrustedDevices', () => {
  beforeEach(async () => {
    await __resetTrustedDevicesForTests();
  });
  afterEach(async () => {
    await __resetTrustedDevicesForTests();
  });

  it('starts with loading=true and an empty list', () => {
    const { result } = renderHook(() => useTrustedDevices());
    expect(result.current.loading).toBe(true);
    expect(result.current.trusted).toEqual([]);
  });

  it('hydrates from IDB after mount', async () => {
    await trustPublicKey(KEY_A, 'Old phone');
    const { result } = renderHook(() => useTrustedDevices());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.trusted).toHaveLength(1);
    expect(result.current.trusted[0].publicKey).toBe(KEY_A);
  });

  it('reload picks up entries added by another caller', async () => {
    const { result } = renderHook(() => useTrustedDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trusted).toHaveLength(0);
    // Another caller (e.g. migration wizard) trusts a key.
    await trustPublicKey(KEY_A, 'wizard-added');
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.trusted).toHaveLength(1);
    expect(result.current.trusted[0].publicKey).toBe(KEY_A);
  });

  it('revoke removes the key both locally and from IDB', async () => {
    await trustPublicKey(KEY_A, 'A');
    await trustPublicKey(KEY_B, 'B');
    const { result } = renderHook(() => useTrustedDevices());
    await waitFor(() => expect(result.current.trusted).toHaveLength(2));
    await act(async () => {
      await result.current.revoke(KEY_A);
    });
    expect(result.current.trusted.map((t) => t.publicKey)).toEqual([KEY_B]);
    // Re-mount → the persistence really happened.
    const { result: r2 } = renderHook(() => useTrustedDevices());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.trusted.map((t) => t.publicKey)).toEqual([KEY_B]);
  });

  it('relabel updates label optimistically + persists', async () => {
    await trustPublicKey(KEY_A, 'old');
    const { result } = renderHook(() => useTrustedDevices());
    await waitFor(() => expect(result.current.trusted).toHaveLength(1));
    await act(async () => {
      await result.current.relabel(KEY_A, 'new');
    });
    expect(result.current.trusted[0].label).toBe('new');
    const { result: r2 } = renderHook(() => useTrustedDevices());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.trusted[0].label).toBe('new');
  });

  it('relabel truncates labels longer than 80 chars', async () => {
    await trustPublicKey(KEY_A, 'short');
    const { result } = renderHook(() => useTrustedDevices());
    await waitFor(() => expect(result.current.trusted).toHaveLength(1));
    await act(async () => {
      await result.current.relabel(KEY_A, 'x'.repeat(200));
    });
    expect(result.current.trusted[0].label.length).toBe(80);
  });
});
