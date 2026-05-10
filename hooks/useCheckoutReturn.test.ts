import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCheckoutReturn } from './useCheckoutReturn';
import * as checkoutSvc from '../services/checkoutService';

const setSearch = (search: string) => {
  // happy-dom honours direct assignment on history.
  window.history.replaceState({}, '', `/${search}`);
};

describe('useCheckoutReturn', () => {
  beforeEach(() => {
    setSearch('');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setSearch('');
  });

  it('phase=idle when no relevant query params are present', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useCheckoutReturn({ onActivate }));
    expect(result.current.phase).toBe('idle');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('phase=cancelled when ?activate_cancelled=1 is present + cleans the query', async () => {
    setSearch('?activate_cancelled=1');
    const { result } = renderHook(() => useCheckoutReturn({ onActivate: vi.fn() }));
    await waitFor(() => expect(result.current.phase).toBe('cancelled'));
    expect(window.location.search).toBe('');
  });

  it('successful claim → onActivate called with the token + phase=activated + query cleaned', async () => {
    setSearch('?activate_session_id=cs_AAA');
    vi.spyOn(checkoutSvc, 'claimToken').mockResolvedValue({
      ok: true,
      token: 'vector-license-v1.AAA.BBB',
    });
    const onActivate = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useCheckoutReturn({ onActivate }));
    await waitFor(() => expect(result.current.phase).toBe('activated'));
    expect(onActivate).toHaveBeenCalledWith('vector-license-v1.AAA.BBB');
    expect(window.location.search).toBe('');
  });

  it('claim failure (non-retryable) sets phase=failed with the reason', async () => {
    setSearch('?activate_session_id=cs_AAA');
    vi.spyOn(checkoutSvc, 'claimToken').mockResolvedValue({
      ok: false,
      reason: 'invalid-input',
    });
    const { result } = renderHook(() => useCheckoutReturn({ onActivate: vi.fn() }));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.failureDetail).toBe('invalid-input');
  });

  it('not-ready retries until token is available', async () => {
    setSearch('?activate_session_id=cs_RETRY');
    let attempts = 0;
    vi.spyOn(checkoutSvc, 'claimToken').mockImplementation(async () => {
      attempts += 1;
      if (attempts < 2) return { ok: false, reason: 'not-ready' };
      return { ok: true, token: 'tok-RETRY' };
    });
    const onActivate = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useCheckoutReturn({ onActivate }));
    await waitFor(
      () => {
        expect(result.current.phase).toBe('activated');
      },
      { timeout: 5000 },
    );
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(onActivate).toHaveBeenCalledWith('tok-RETRY');
  });

  it('reset() returns the hook to idle', async () => {
    setSearch('?activate_cancelled=1');
    const { result } = renderHook(() => useCheckoutReturn({ onActivate: vi.fn() }));
    await waitFor(() => expect(result.current.phase).toBe('cancelled'));
    result.current.reset();
    await waitFor(() => expect(result.current.phase).toBe('idle'));
  });
});
