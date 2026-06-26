import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as idb from 'idb-keyval';
import { useCustomPersonas } from './useCustomPersonas';
import { mintPersona } from '../services/personaService';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

const samplePersona = (name = 'p') => mintPersona({ name, systemPrompt: 'x'.repeat(200) });

describe('useCustomPersonas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(idb.get).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading=true and resolves to an empty list when nothing is stored', async () => {
    const { result } = renderHook(() => useCustomPersonas());
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.customPersonas).toEqual([]);
  });

  it('hydrates from IDB on mount', async () => {
    const persona = samplePersona('乔布斯');
    vi.mocked(idb.get).mockResolvedValue([persona]);

    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.customPersonas).toHaveLength(1);
    expect(result.current.customPersonas[0].name).toBe('乔布斯');
  });

  it('drops malformed payloads silently (hydratePersonas safety net)', async () => {
    vi.mocked(idb.get).mockResolvedValue([
      samplePersona('good'),
      { id: 'bad-no-required-fields' },
      null,
    ]);

    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.customPersonas).toHaveLength(1);
    expect(result.current.customPersonas[0].name).toBe('good');
  });

  it('falls back to localStorage mirror when IDB is empty', async () => {
    vi.mocked(idb.get).mockResolvedValue(undefined);
    const persona = samplePersona('mirror-source');
    localStorage.setItem('vector_master_vault_custom_personas', JSON.stringify([persona]));

    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.customPersonas).toHaveLength(1);
    expect(result.current.customPersonas[0].name).toBe('mirror-source');
  });

  it('addPersona appends + persists to IDB', async () => {
    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const persona = samplePersona('新启明星');
    await act(async () => {
      await result.current.addPersona(persona);
    });

    expect(result.current.customPersonas).toHaveLength(1);
    expect(result.current.customPersonas[0].id).toBe(persona.id);
    expect(idb.set).toHaveBeenCalledWith(
      'vector_master_vault_custom_personas',
      expect.arrayContaining([persona]),
    );
  });

  it('updatePersona patches by id + bumps updatedAt', async () => {
    const persona = samplePersona('原名');
    vi.mocked(idb.get).mockResolvedValue([persona]);

    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      // updatePersona's `patch` shape uses Partial<CustomPersona>
      // but personaService.updatePersona only honours name/description/
      // systemPrompt/builderAnswers. Other fields silently no-op.
      await result.current.updatePersona(persona.id, { name: '新名字' });
    });

    expect(result.current.customPersonas[0].name).toBe('新名字');
    expect(result.current.customPersonas[0].id).toBe(persona.id);
  });

  it('deletePersona removes by id', async () => {
    const a = samplePersona('a');
    const b = samplePersona('b');
    vi.mocked(idb.get).mockResolvedValue([a, b]);

    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.deletePersona(a.id);
    });

    expect(result.current.customPersonas).toHaveLength(1);
    expect(result.current.customPersonas[0].id).toBe(b.id);
  });

  it('replacePersonas bulk-overwrites (used by backup restore)', async () => {
    vi.mocked(idb.get).mockResolvedValue([samplePersona('old')]);
    const { result } = renderHook(() => useCustomPersonas());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const fresh = [samplePersona('imported-1'), samplePersona('imported-2')];
    await act(async () => {
      await result.current.replacePersonas(fresh);
    });

    expect(result.current.customPersonas).toHaveLength(2);
    expect(result.current.customPersonas.map((p) => p.name)).toEqual(['imported-1', 'imported-2']);
  });
});
