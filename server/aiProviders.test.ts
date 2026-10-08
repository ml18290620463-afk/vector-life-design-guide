import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chooseProvider,
  resolveProviderModel,
  callOpenRouter,
  fetchOpenRouterFreeModels,
  streamOpenRouter,
  type ProviderConfig,
} from './aiProviders';

const baseCfg = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  forcedProvider: '',
  openrouterKey: '',
  openrouterModel: 'google/gemma-3-12b-it:free',
  openrouterReferer: 'http://localhost:3000',
  openrouterTitle: 'VECTOR test',
  openrouterJsonMode: false,
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  ...overrides,
});

describe('chooseProvider', () => {
  it('returns null when neither key is set', () => {
    expect(chooseProvider(baseCfg())).toBeNull();
  });

  it('prefers OpenRouter when both keys are present and no override', () => {
    expect(chooseProvider(baseCfg({ openrouterKey: 'sk-or-1', geminiKey: 'gem-1' }))).toBe(
      'openrouter',
    );
  });

  it('honours forcedProvider when its key is present', () => {
    expect(
      chooseProvider(
        baseCfg({ forcedProvider: 'gemini', openrouterKey: 'sk-or-1', geminiKey: 'gem-1' }),
      ),
    ).toBe('gemini');
  });

  it('falls back when forcedProvider lacks a key', () => {
    expect(chooseProvider(baseCfg({ forcedProvider: 'gemini', openrouterKey: 'sk-or-1' }))).toBe(
      'openrouter',
    );
  });

  it('returns gemini when only Gemini key is set', () => {
    expect(chooseProvider(baseCfg({ geminiKey: 'gem-1' }))).toBe('gemini');
  });
});

describe('resolveProviderModel', () => {
  it('returns the OpenRouter model id for openrouter provider', () => {
    expect(resolveProviderModel(baseCfg({ openrouterModel: 'foo:free' }), 'openrouter')).toBe(
      'foo:free',
    );
  });

  it('returns the Gemini model id for gemini provider', () => {
    expect(resolveProviderModel(baseCfg({ geminiModel: 'gemini-2.5-pro' }), 'gemini')).toBe(
      'gemini-2.5-pro',
    );
  });
});

describe('callOpenRouter', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when upstream returns non-2xx', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('rate limit hit', { status: 429 }),
    );
    await expect(callOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }))).rejects.toThrow(
      /OpenRouter 429/,
    );
  });

  it('throws when content is missing', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(callOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }))).rejects.toThrow(
      /Empty OpenRouter/,
    );
  });

  it('returns the assistant content on success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'hello world' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(callOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }))).resolves.toBe(
      'hello world',
    );
  });

  it('sets HTTP-Referer + X-Title + Authorization headers', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await callOpenRouter(
      'hi',
      baseCfg({
        openrouterKey: 'sk-or-1',
        openrouterReferer: 'https://example.test',
        openrouterTitle: 'Test',
      }),
    );
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer sk-or-1');
    expect(headers['HTTP-Referer']).toBe('https://example.test');
    expect(headers['X-Title']).toBe('Test');
  });

  it('attaches response_format when openrouterJsonMode is true', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await callOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1', openrouterJsonMode: true }));
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const body = JSON.parse((init as { body: string }).body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});

describe('fetchOpenRouterFreeModels', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when upstream returns non-2xx', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('upstream down', { status: 503 }),
    );
    await expect(fetchOpenRouterFreeModels(baseCfg())).rejects.toThrow(/Upstream 503/);
  });

  it('returns only :free or zero-priced entries, sorted by id', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'paid-model',
              name: 'Paid',
              context_length: 4096,
              pricing: { prompt: '0.001', completion: '0.001' },
            },
            {
              id: 'b/free-model:free',
              name: 'Free B',
              context_length: 8192,
              pricing: { prompt: '0', completion: '0' },
            },
            {
              id: 'a/free-zero-priced',
              name: 'Free A (zero-priced no suffix)',
              context_length: null,
              pricing: { prompt: 0, completion: 0 },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await fetchOpenRouterFreeModels(baseCfg());
    expect(result.map((m) => m.id)).toEqual(['a/free-zero-priced', 'b/free-model:free']);
    expect(result[0]!.context_length).toBeNull();
    expect(result[1]!.context_length).toBe(8192);
  });

  it('includes Authorization header when key is present', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await fetchOpenRouterFreeModels(baseCfg({ openrouterKey: 'sk-or-1' }));
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer sk-or-1');
  });

  it('omits Authorization when key is empty', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await fetchOpenRouterFreeModels(baseCfg());
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

/**
 * Helper that builds a streamed Response from a list of SSE-framed
 * data chunks, mimicking what OpenRouter's SSE endpoint emits.
 */
const sseResponse = (chunks: string[]): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
};

describe('streamOpenRouter', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws on non-2xx upstream', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response('overload', { status: 503 }));
    await expect(
      streamOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }), () => {}),
    ).rejects.toThrow(/OpenRouter 503/);
  });

  it('emits onChunk for each delta and returns the concatenated text', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const chunks: string[] = [];
    const result = await streamOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }), (delta) =>
      chunks.push(delta),
    );
    expect(chunks).toEqual(['Hello', ' ', 'world']);
    expect(result).toBe('Hello world');
  });

  it('tolerates SSE keep-alive / non-JSON lines without blowing up', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      sseResponse([
        ': openrouter heartbeat\n\n',
        'data: garbage that is not json\n\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const result = await streamOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }), () => {});
    expect(result).toBe('ok');
  });

  it('reassembles deltas split across chunks (split mid-event)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"alpha"}}]}\ndata: {"choices":[{"delta":{"content":"beta"}',
        '}]}\n\ndata: [DONE]\n\n',
      ]),
    );
    const chunks: string[] = [];
    const result = await streamOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }), (delta) =>
      chunks.push(delta),
    );
    expect(chunks).toEqual(['alpha', 'beta']);
    expect(result).toBe('alphabeta');
  });

  it('throws when the stream produces no content at all', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(sseResponse(['data: [DONE]\n\n']));
    await expect(
      streamOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }), () => {}),
    ).rejects.toThrow(/Empty OpenRouter stream/);
  });

  it('sends stream:true and HTTP-Referer/X-Title headers', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      sseResponse(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n']),
    );
    await streamOpenRouter(
      'hi',
      baseCfg({
        openrouterKey: 'sk-or-1',
        openrouterReferer: 'https://example.test',
        openrouterTitle: 'Test',
      }),
      () => {},
    );
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const body = JSON.parse((init as { body: string }).body);
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(body.stream).toBe(true);
    expect(headers['Authorization']).toBe('Bearer sk-or-1');
    expect(headers['HTTP-Referer']).toBe('https://example.test');
    expect(headers['X-Title']).toBe('Test');
    expect(headers['Accept']).toBe('text/event-stream');
  });

  it('honours an aborted signal between reads', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      sseResponse(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'data: [DONE]\n\n']),
    );
    await expect(
      streamOpenRouter('hi', baseCfg({ openrouterKey: 'sk-or-1' }), () => {}, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
