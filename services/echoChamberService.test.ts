import { describe, expect, it, vi } from 'vitest';
import { runEchoChamber } from './echoChamberService';

const validQuery = '我现在该不该辞职?这份工作让我焦虑。';
const validPersonas = ['Marcus', 'Naval', 'Laozi'];

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('services/echoChamberService', () => {
  it('rejects empty personaNames inline', async () => {
    const fetcher = vi.fn();
    const out = await runEchoChamber({
      query: validQuery,
      personaNames: [],
      fetcher: fetcher as typeof fetch,
    });
    expect(out.ok).toBe(false);
    if (out.ok === true) return;
    expect(out.reason).toBe('invalid-input');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects empty query inline', async () => {
    const fetcher = vi.fn();
    const out = await runEchoChamber({
      query: '   ',
      personaNames: validPersonas,
      fetcher: fetcher as typeof fetch,
    });
    expect(out.ok).toBe(false);
    if (out.ok === true) return;
    expect(out.reason).toBe('invalid-input');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards body shape via POST', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(okResponse({ markdown: '## Reply', provider: 'openrouter' }));
    await runEchoChamber({
      query: validQuery,
      personaNames: validPersonas,
      customPersonaPrompts: { Marcus: 'You are Marcus.' },
      memoirRecallByPersona: { Marcus: [{ body: 'I remember' }] },
      fetcher: fetcher as typeof fetch,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/echo-chamber',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string);
    expect(body.query).toBe(validQuery);
    expect(body.personaNames).toEqual(validPersonas);
    expect(body.customPersonaPrompts).toEqual({ Marcus: 'You are Marcus.' });
    expect(body.memoirRecallByPersona).toEqual({ Marcus: [{ body: 'I remember' }] });
  });

  it('omits empty optional maps from the request body', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse({ markdown: '## R' }));
    await runEchoChamber({
      query: validQuery,
      personaNames: validPersonas,
      fetcher: fetcher as typeof fetch,
    });
    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string);
    expect(body.customPersonaPrompts).toBeUndefined();
    expect(body.memoirRecallByPersona).toBeUndefined();
  });

  it('returns ok with markdown on 200', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        okResponse({ markdown: '### ✉️ 来自 Marcus 的回应\n...\n', provider: 'openrouter' }),
      );
    const out = await runEchoChamber({
      query: validQuery,
      personaNames: validPersonas,
      fetcher: fetcher as typeof fetch,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.markdown).toContain('Marcus');
    expect(out.provider).toBe('openrouter');
  });

  it.each([
    [400, 'INJECTION', 'rejected-by-injection-guard'],
    [400, undefined, 'invalid-input'],
    [429, undefined, 'rate-limited'],
    [502, 'EMPTY', 'empty-response'],
    [503, undefined, 'ai-unavailable'],
  ])('maps server status %i / code %s → reason %s', async (status, code, expected) => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'oops', code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const out = await runEchoChamber({
      query: validQuery,
      personaNames: validPersonas,
      fetcher: fetcher as typeof fetch,
    });
    expect(out.ok).toBe(false);
    if (out.ok === true) return;
    expect(out.reason).toBe(expected);
  });

  it('returns reason=aborted on AbortSignal', async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      (err as { name: string }).name = 'AbortError';
      throw err;
    });
    const out = await runEchoChamber({
      query: validQuery,
      personaNames: validPersonas,
      fetcher: fetcher as typeof fetch,
    });
    expect(out.ok).toBe(false);
    if (out.ok === true) return;
    expect(out.reason).toBe('aborted');
  });

  it('returns empty-response when markdown is whitespace', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse({ markdown: '   ' }));
    const out = await runEchoChamber({
      query: validQuery,
      personaNames: validPersonas,
      fetcher: fetcher as typeof fetch,
    });
    expect(out.ok).toBe(false);
    if (out.ok === true) return;
    expect(out.reason).toBe('empty-response');
  });
});
