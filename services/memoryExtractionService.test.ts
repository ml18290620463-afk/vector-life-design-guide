import { describe, expect, it, vi } from 'vitest';
import { extractMemoirMemories } from './memoryExtractionService';

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const sampleTranscript = [
  { role: 'user' as const, content: '今天面试很顺利' },
  { role: 'memoir' as const, content: '记得我跟你说过 — 紧张是好事' },
];

describe('services/memoryExtractionService', () => {
  it('returns null when transcript is empty', async () => {
    const fetcher = vi.fn();
    const result = await extractMemoirMemories({
      transcript: [],
      fetcher: fetcher as typeof fetch,
    });
    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards transcript via POST and parses memories', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      okResponse({
        memories: [
          { category: 'fact', body: '用户上周面试通过了' },
          { category: 'emotion', body: '用户感到惊喜' },
        ],
      }),
    );
    const result = await extractMemoirMemories({
      transcript: sampleTranscript,
      fetcher: fetcher as typeof fetch,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/memoir-extract',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string);
    expect(body.transcript).toEqual(sampleTranscript);
    expect(result).toHaveLength(2);
  });

  it('returns null on non-2xx (silent failure)', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('boom', { status: 502 }));
    const result = await extractMemoirMemories({
      transcript: sampleTranscript,
      fetcher: fetcher as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('returns null on network rejection (silent failure)', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await extractMemoirMemories({
      transcript: sampleTranscript,
      fetcher: fetcher as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('returns null when response body is not the expected shape', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse({ memories: 'oops' }));
    const result = await extractMemoirMemories({
      transcript: sampleTranscript,
      fetcher: fetcher as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('returns empty array when memories is empty (success path)', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse({ memories: [] }));
    const result = await extractMemoirMemories({
      transcript: sampleTranscript,
      fetcher: fetcher as typeof fetch,
    });
    expect(result).toEqual([]);
  });

  it('returns null when AbortSignal fires before fetch settles', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(() => {
      const error = new Error('aborted');
      (error as { name: string }).name = 'AbortError';
      throw error;
    });
    controller.abort();
    const result = await extractMemoirMemories({
      transcript: sampleTranscript,
      fetcher: fetcher as typeof fetch,
      signal: controller.signal,
    });
    expect(result).toBeNull();
  });
});
