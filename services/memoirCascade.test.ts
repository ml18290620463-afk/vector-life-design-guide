import { describe, expect, it, vi } from 'vitest';
import { cascadeDeleteMemoir } from './memoirCascade';

describe('services/memoirCascade', () => {
  it('clean run — all three callbacks succeed, outcome flags all true', async () => {
    const clearMemories = vi.fn().mockResolvedValue(undefined);
    const clearLetters = vi.fn().mockResolvedValue(undefined);
    const deletePersona = vi.fn().mockResolvedValue(undefined);

    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories,
      clearLetters,
      deletePersona,
    });

    expect(out.memoriesCleared).toBe(true);
    expect(out.lettersCleared).toBe(true);
    expect(out.personaDeleted).toBe(true);
    expect(out.errors).toEqual([]);
    expect(clearMemories).toHaveBeenCalledWith('m-1');
    expect(clearLetters).toHaveBeenCalledWith('m-1');
    expect(deletePersona).toHaveBeenCalledWith('m-1');
  });

  it('runs in memories → letters → persona order', async () => {
    const order: string[] = [];
    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories: async () => {
        order.push('memories');
      },
      clearLetters: async () => {
        order.push('letters');
      },
      deletePersona: async () => {
        order.push('persona');
      },
    });
    expect(order).toEqual(['memories', 'letters', 'persona']);
    expect(out.errors).toEqual([]);
  });

  it('memories failure does not block letters + persona', async () => {
    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories: vi.fn().mockRejectedValue(new Error('idb-busy')),
      clearLetters: vi.fn().mockResolvedValue(undefined),
      deletePersona: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.memoriesCleared).toBe(false);
    expect(out.lettersCleared).toBe(true);
    expect(out.personaDeleted).toBe(true);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].step).toBe('memories');
    expect(out.errors[0].message).toBe('idb-busy');
  });

  it('letters failure does not block persona', async () => {
    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories: vi.fn().mockResolvedValue(undefined),
      clearLetters: vi.fn().mockRejectedValue(new Error('quota-exceeded')),
      deletePersona: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.memoriesCleared).toBe(true);
    expect(out.lettersCleared).toBe(false);
    expect(out.personaDeleted).toBe(true);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].step).toBe('letters');
  });

  it('persona failure leaves the persona in place for retry', async () => {
    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories: vi.fn().mockResolvedValue(undefined),
      clearLetters: vi.fn().mockResolvedValue(undefined),
      deletePersona: vi.fn().mockRejectedValue(new Error('persistence-failed')),
    });
    expect(out.memoriesCleared).toBe(true);
    expect(out.lettersCleared).toBe(true);
    expect(out.personaDeleted).toBe(false);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].step).toBe('persona');
  });

  it('total failure surfaces all three error rows', async () => {
    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories: vi.fn().mockRejectedValue(new Error('a')),
      clearLetters: vi.fn().mockRejectedValue(new Error('b')),
      deletePersona: vi.fn().mockRejectedValue(new Error('c')),
    });
    expect(out.errors.map((e) => e.step)).toEqual(['memories', 'letters', 'persona']);
  });

  it('non-Error throws still surface a string message', async () => {
    const out = await cascadeDeleteMemoir({
      memoirId: 'm-1',
      clearMemories: vi.fn().mockResolvedValue(undefined),
      clearLetters: vi.fn().mockResolvedValue(undefined),
      deletePersona: vi.fn().mockRejectedValue('plain-string'),
    });
    expect(out.errors[0].message).toBe('plain-string');
  });
});
