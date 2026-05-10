import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMorningStarAnalysis, streamMorningStarAnalysis } from './geminiService';

describe('geminiService — buffered getMorningStarAnalysis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns backend response text when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: '{"content":"ok","metrics":{"resilience":1}}' }),
      }),
    );

    await expect(
      getMorningStarAnalysis('entry', 'reflection', ['Marcus Aurelius']),
    ).resolves.toContain('"content":"ok"');
  });

  it('falls back to a public message when backend fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'internal details' }),
      }),
    );

    const result = await getMorningStarAnalysis('entry', 'reflection', ['Marcus Aurelius']);
    expect(result).toContain('星光暂时失联，请稍后重试。');
    expect(result).not.toContain('internal details');
  });
});

const sseStreamResponse = (frames: string[]): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
};

describe('geminiService — streaming streamMorningStarAnalysis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits onChunk for each delta and returns the final fullText from the done frame', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          sseStreamResponse([
            'event: chunk\ndata: {"text":"Hel"}\n\n',
            'event: chunk\ndata: {"text":"lo"}\n\n',
            'event: done\ndata: {"fullText":"Hello (canonical)","provider":"openrouter","requestId":"r1"}\n\n',
          ]),
        ),
    );

    const deltas: Array<{ delta: string; acc: string }> = [];
    const result = await streamMorningStarAnalysis(
      'entry',
      'reflection',
      ['Marcus Aurelius'],
      (delta, accumulated) => deltas.push({ delta, acc: accumulated }),
    );

    expect(deltas.map((d) => d.delta)).toEqual(['Hel', 'lo']);
    expect(deltas[deltas.length - 1]!.acc).toBe('Hello');
    // Done frame's fullText is canonical (server already concatenated).
    expect(result).toBe('Hello (canonical)');
  });

  it('falls back to accumulated text when the stream closes without a done frame', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          sseStreamResponse([
            'event: chunk\ndata: {"text":"partial "}\n\n',
            'event: chunk\ndata: {"text":"text"}\n\n',
          ]),
        ),
    );

    const result = await streamMorningStarAnalysis(
      'entry',
      'reflection',
      ['Marcus Aurelius'],
      () => {},
    );
    expect(result).toBe('partial text');
  });

  it('falls back to the buffered endpoint when the streaming fetch fails', async () => {
    const fetchMock = vi
      .fn()
      // First call: streaming endpoint returns a 502.
      .mockResolvedValueOnce(new Response('boom', { status: 502 }))
      // Second call: buffered endpoint returns success.
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: '{"content":"buffered fallback","metrics":{}}' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamMorningStarAnalysis(
      'entry',
      'reflection',
      ['Marcus Aurelius'],
      () => {},
    );
    expect(result).toContain('buffered fallback');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/morning-star/stream');
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/morning-star');
  });

  it('returns the public failure JSON when both streaming AND buffered fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('boom', { status: 502 }))
        .mockResolvedValueOnce({ ok: false, json: async () => ({}) }),
    );
    const result = await streamMorningStarAnalysis(
      'entry',
      'reflection',
      ['Marcus Aurelius'],
      () => {},
    );
    expect(result).toContain('星光暂时失联');
  });

  it('reports an explicit error frame as a fallback path (not as an exception)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseStreamResponse([
          'event: chunk\ndata: {"text":"a"}\n\n',
          'event: error\ndata: {"error":"upstream rejected","requestId":"r1"}\n\n',
        ]),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: '{"content":"buffered","metrics":{}}' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamMorningStarAnalysis(
      'entry',
      'reflection',
      ['Marcus Aurelius'],
      () => {},
    );
    expect(result).toContain('buffered');
  });

  it('rethrows when the caller aborts the request', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: { signal?: AbortSignal }) => {
        controller.abort();
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }),
    );
    await expect(
      streamMorningStarAnalysis(
        'entry',
        'reflection',
        ['Marcus Aurelius'],
        () => {},
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
