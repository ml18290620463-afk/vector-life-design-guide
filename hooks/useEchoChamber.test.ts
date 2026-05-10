import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEchoChamber } from './useEchoChamber';
import { ECHO_CHAMBER_LIMITS } from '../lib/echoChamberSchema';

const validQuery = '我现在该不该辞职?这份工作让我焦虑。';
const validPersonas = ['Marcus Aurelius', 'Naval Ravikant', 'Laozi'];

const successResponse = (markdown: string) =>
  new Response(JSON.stringify({ markdown, provider: 'openrouter' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('useEchoChamber', () => {
  it('starts at phase=idle with empty form', () => {
    const { result } = renderHook(() => useEchoChamber({ fetcher: vi.fn() as typeof fetch }));
    expect(result.current.phase).toBe('idle');
    expect(result.current.query).toBe('');
    expect(result.current.selectedPersonas).toEqual([]);
    expect(result.current.isReadyToSubmit).toBe(false);
  });

  it('togglePersona adds + removes names; caps at maxPersonas', () => {
    const { result } = renderHook(() => useEchoChamber({ fetcher: vi.fn() as typeof fetch }));
    for (const name of ['A', 'B', 'C', 'D']) {
      act(() => result.current.togglePersona(name));
    }
    expect(result.current.selectedPersonas).toEqual(['A', 'B', 'C', 'D']);
    act(() => result.current.togglePersona('B'));
    expect(result.current.selectedPersonas).toEqual(['A', 'C', 'D']);
    // Fill to cap.
    const many = Array.from({ length: ECHO_CHAMBER_LIMITS.maxPersonas + 5 }, (_, i) => `p${i}`);
    act(() => result.current.setSelectedPersonas(many));
    expect(result.current.selectedPersonas.length).toBe(ECHO_CHAMBER_LIMITS.maxPersonas);
  });

  it('isReadyToSubmit is false until query + ≥ minPersonas are filled', () => {
    const { result } = renderHook(() => useEchoChamber({ fetcher: vi.fn() as typeof fetch }));
    act(() => result.current.setQuery(validQuery));
    expect(result.current.isReadyToSubmit).toBe(false);
    act(() => result.current.setSelectedPersonas(['A', 'B']));
    expect(result.current.isReadyToSubmit).toBe(false);
    act(() => result.current.setSelectedPersonas(['A', 'B', 'C']));
    expect(result.current.isReadyToSubmit).toBe(true);
  });

  it('refuses to submit with an invalid form (sets phase=error)', async () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useEchoChamber({ fetcher: fetcher as typeof fetch }));
    let returned;
    await act(async () => {
      returned = await result.current.submit();
    });
    expect(returned?.ok).toBe(false);
    expect(result.current.phase).toBe('error');
    expect(result.current.errorReason).toBe('invalid-input');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('submit success transitions phase=submitting → success and stores markdown', async () => {
    const fetcher = vi.fn().mockResolvedValue(successResponse('## ✉️ 来自 Marcus 的回应\n...'));
    const { result } = renderHook(() => useEchoChamber({ fetcher: fetcher as typeof fetch }));
    act(() => {
      result.current.setQuery(validQuery);
      result.current.setSelectedPersonas(validPersonas);
    });
    let returned;
    await act(async () => {
      returned = await result.current.submit();
    });
    expect(returned?.ok).toBe(true);
    expect(result.current.phase).toBe('success');
    expect(result.current.resultMarkdown).toContain('Marcus');
  });

  it('submit failure (ai-unavailable) sets phase=error with the right reason', async () => {
    const fetcher = vi.fn().mockResolvedValue(errorResponse(503));
    const { result } = renderHook(() => useEchoChamber({ fetcher: fetcher as typeof fetch }));
    act(() => {
      result.current.setQuery(validQuery);
      result.current.setSelectedPersonas(validPersonas);
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.errorReason).toBe('ai-unavailable');
  });

  it('cancel aborts an in-flight submit and flips to cancelled', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetcher = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        resolveFetch = resolve;
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          (err as { name: string }).name = 'AbortError';
          reject(err);
        });
      });
    });
    const { result } = renderHook(() => useEchoChamber({ fetcher: fetcher as typeof fetch }));
    act(() => {
      result.current.setQuery(validQuery);
      result.current.setSelectedPersonas(validPersonas);
    });
    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.submit();
    });
    act(() => {
      result.current.cancel();
    });
    await pending!;
    expect(result.current.phase).toBe('cancelled');
    // Late resolve must not crash.
    resolveFetch?.(successResponse('late'));
  });

  it('reset clears form + result + error state', async () => {
    const fetcher = vi.fn().mockResolvedValue(successResponse('## ok'));
    const { result } = renderHook(() => useEchoChamber({ fetcher: fetcher as typeof fetch }));
    act(() => {
      result.current.setQuery(validQuery);
      result.current.setSelectedPersonas(validPersonas);
    });
    await act(async () => {
      await result.current.submit();
    });
    act(() => result.current.reset());
    expect(result.current.query).toBe('');
    expect(result.current.selectedPersonas).toEqual([]);
    expect(result.current.phase).toBe('idle');
    expect(result.current.resultMarkdown).toBeNull();
  });
});
