import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoirMemoryHarvest } from './useMemoirMemoryHarvest';
import { mintPersona } from '../services/personaService';
import type { CustomPersona } from '../types';

const memoirGrandma = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const memoirMentor = mintPersona({
  name: '导师',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const personaJobs = mintPersona({
  name: '乔布斯',
  systemPrompt: 'x'.repeat(200),
  kind: 'persona',
});

const SAMPLE_MD = `### ✉️ 来自 奶奶 的回信

孩子,记得我跟你说过 — 不要紧。慢慢来。

---

### ✉️ 来自 乔布斯 的回信

Stay hungry, stay foolish.

---

### 💡 共同的思考留白

明天?
`;

const okFetcher = (memories: Array<{ category: string; body: string }>) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ memories }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const setup = (opts: {
  customPersonas: CustomPersona[];
  fetcher?: typeof fetch;
  addMemoryImpl?: (input: {
    memoirId: string;
    category: string;
    body: string;
  }) => Promise<{ ok: boolean }>;
}) => {
  const addMemory = vi.fn(opts.addMemoryImpl ?? (async () => ({ ok: true })));
  const { result } = renderHook(() =>
    useMemoirMemoryHarvest({
      customPersonas: opts.customPersonas,
      addMemory: addMemory as never,
      fetcher: opts.fetcher,
    }),
  );
  return { result, addMemory };
};

describe('useMemoirMemoryHarvest', () => {
  it('returns 0 and skips fetch when no memoir participated', async () => {
    const fetcher = okFetcher([]);
    const { result, addMemory } = setup({
      customPersonas: [memoirGrandma],
      fetcher: fetcher as typeof fetch,
    });
    let written: number | undefined;
    await act(async () => {
      written = await result.current.triggerHarvest({
        reflection: '今天很好',
        responseMarkdown: SAMPLE_MD,
        // 奶奶 was NOT in the participating list — only 乔布斯 was.
        participatingPersonas: ['乔布斯'],
      });
    });
    expect(written).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(addMemory).not.toHaveBeenCalled();
  });

  it('returns 0 when reflection is blank', async () => {
    const fetcher = okFetcher([{ category: 'fact', body: 'x' }]);
    const { result } = setup({
      customPersonas: [memoirGrandma],
      fetcher: fetcher as typeof fetch,
    });
    let written: number | undefined;
    await act(async () => {
      written = await result.current.triggerHarvest({
        reflection: '   ',
        responseMarkdown: SAMPLE_MD,
        participatingPersonas: ['奶奶'],
      });
    });
    expect(written).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('writes every successful memory candidate scoped to the right memoirId', async () => {
    const fetcher = okFetcher([
      { category: 'fact', body: '用户上周面试通过了' },
      { category: 'emotion', body: '用户感到惊喜' },
    ]);
    const { result, addMemory } = setup({
      customPersonas: [memoirGrandma, personaJobs],
      fetcher: fetcher as typeof fetch,
    });
    let written: number | undefined;
    await act(async () => {
      written = await result.current.triggerHarvest({
        reflection: '今天面试很顺利',
        responseMarkdown: SAMPLE_MD,
        participatingPersonas: ['奶奶', '乔布斯'],
        sourceRef: 'entry-test',
      });
    });
    expect(written).toBe(2);
    expect(addMemory).toHaveBeenCalledTimes(2);
    expect(addMemory).toHaveBeenCalledWith({
      memoirId: memoirGrandma.id,
      category: 'fact',
      body: '用户上周面试通过了',
      sourceRef: 'entry-test',
    });
  });

  it('does NOT call addMemory for non-memoir personas (regular Persona Builder)', async () => {
    const fetcher = okFetcher([{ category: 'fact', body: 'x' }]);
    const { addMemory, result } = setup({
      customPersonas: [personaJobs], // no memoir at all
      fetcher: fetcher as typeof fetch,
    });
    let written: number | undefined;
    await act(async () => {
      written = await result.current.triggerHarvest({
        reflection: 'hi',
        responseMarkdown: SAMPLE_MD,
        participatingPersonas: ['乔布斯'],
      });
    });
    expect(written).toBe(0);
    expect(addMemory).not.toHaveBeenCalled();
  });

  it('runs each Memoir independently — one bad LLM round should not poison others', async () => {
    // Memoir mentor has no section in SAMPLE_MD, so its harvest path
    // should silently no-op while grandma's still writes.
    const fetcher = okFetcher([{ category: 'fact', body: '记忆 A' }]);
    const { result, addMemory } = setup({
      customPersonas: [memoirGrandma, memoirMentor],
      fetcher: fetcher as typeof fetch,
    });
    let written: number | undefined;
    await act(async () => {
      written = await result.current.triggerHarvest({
        reflection: 'hi',
        responseMarkdown: SAMPLE_MD,
        participatingPersonas: ['奶奶', '导师'],
      });
    });
    expect(written).toBe(1);
    expect(addMemory).toHaveBeenCalledTimes(1);
    // fetcher only called once (奶奶 — mentor was skipped pre-network)
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('counts only memories that addMemory accepts (PII rejections do NOT count)', async () => {
    const fetcher = okFetcher([
      { category: 'fact', body: 'safe one' },
      { category: 'fact', body: 'unsafe one' },
    ]);
    const { result, addMemory } = setup({
      customPersonas: [memoirGrandma],
      fetcher: fetcher as typeof fetch,
      addMemoryImpl: async (input) => ({ ok: !input.body.startsWith('unsafe') }),
    });
    let written: number | undefined;
    await act(async () => {
      written = await result.current.triggerHarvest({
        reflection: 'hi',
        responseMarkdown: SAMPLE_MD,
        participatingPersonas: ['奶奶'],
      });
    });
    expect(written).toBe(1);
    expect(addMemory).toHaveBeenCalledTimes(2);
  });

  it('cancelInFlight aborts a running harvest', async () => {
    let resolveFetch: (() => void) | undefined;
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve, reject) => {
          resolveFetch = () => resolve(new Response('{}', { status: 200 }));
          // Reject when the AbortSignal fires.
          const signal = (fetcher.mock.calls.at(-1)?.[1] as RequestInit)?.signal;
          signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            (err as { name: string }).name = 'AbortError';
            reject(err);
          });
        }),
    );
    const { result, addMemory } = setup({
      customPersonas: [memoirGrandma],
      fetcher: fetcher as typeof fetch,
    });
    let writtenPromise: Promise<number>;
    act(() => {
      writtenPromise = result.current.triggerHarvest({
        reflection: 'hi',
        responseMarkdown: SAMPLE_MD,
        participatingPersonas: ['奶奶'],
      });
    });
    act(() => {
      result.current.cancelInFlight();
    });
    const written = await writtenPromise!;
    expect(written).toBe(0);
    expect(addMemory).not.toHaveBeenCalled();
    // Late-resolving fetch must not crash anything.
    resolveFetch?.();
  });
});
