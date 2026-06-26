import { describe, expect, it } from 'vitest';
import {
  PERSONA_LIMITS,
  deletePersona,
  findCustomPersonaByName,
  getBuiltInStarSet,
  hydratePersonas,
  isBuiltInStar,
  looksLikePersona,
  mintPersona,
  sanitizePersona,
  updatePersona,
} from './personaService';

const validInput = {
  name: '乔布斯',
  description: 'Apple 创始人 / 极客哲学家',
  systemPrompt: 'You are 乔布斯, ...'.padEnd(200, '.'),
  builderAnswers: { era: '20-21 世纪', style: '极简' },
};

describe('services/personaService', () => {
  describe('mintPersona', () => {
    it('returns a fully-formed persona with id / timestamps / kind=persona by default', () => {
      const before = Date.now();
      const persona = mintPersona(validInput);
      const after = Date.now();

      expect(persona.id).toMatch(/^persona-/);
      expect(persona.kind).toBe('persona');
      expect(persona.name).toBe('乔布斯');
      expect(persona.createdAt).toBeGreaterThanOrEqual(before);
      expect(persona.createdAt).toBeLessThanOrEqual(after);
      expect(persona.updatedAt).toBe(persona.createdAt);
      expect(persona.systemPrompt.startsWith('You are 乔布斯')).toBe(true);
      expect(persona.builderAnswers).toEqual({ era: '20-21 世纪', style: '极简' });
    });

    it('mints a memoir persona with id prefix `memoir-` when kind=memoir', () => {
      const persona = mintPersona({ ...validInput, kind: 'memoir' });
      expect(persona.id).toMatch(/^memoir-/);
      expect(persona.kind).toBe('memoir');
    });

    it('caps the name at PERSONA_LIMITS.name characters', () => {
      const longName = 'X'.repeat(PERSONA_LIMITS.name + 50);
      const persona = mintPersona({ ...validInput, name: longName });
      expect(persona.name.length).toBe(PERSONA_LIMITS.name);
    });

    it('caps the system prompt at PERSONA_LIMITS.systemPrompt characters', () => {
      const longPrompt = 'P'.repeat(PERSONA_LIMITS.systemPrompt + 500);
      const persona = mintPersona({ ...validInput, systemPrompt: longPrompt });
      expect(persona.systemPrompt.length).toBe(PERSONA_LIMITS.systemPrompt);
    });

    it('falls back to "Untitled" when name is empty/whitespace', () => {
      const persona = mintPersona({ ...validInput, name: '   ' });
      expect(persona.name).toBe('Untitled');
    });

    it('drops empty descriptions', () => {
      const persona = mintPersona({ ...validInput, description: '   ' });
      expect(persona.description).toBeUndefined();
    });
  });

  describe('looksLikePersona / sanitizePersona', () => {
    it('accepts a freshly minted persona', () => {
      const p = mintPersona(validInput);
      expect(looksLikePersona(p)).toBe(true);
      expect(sanitizePersona(p)).not.toBeNull();
    });

    it('rejects null / non-object / array inputs', () => {
      expect(looksLikePersona(null)).toBe(false);
      expect(looksLikePersona(undefined)).toBe(false);
      expect(looksLikePersona('string')).toBe(false);
      expect(looksLikePersona([])).toBe(false);
    });

    it('rejects objects missing required fields', () => {
      const partial: Record<string, unknown> = { id: 'persona-1', name: '乔布斯' };
      expect(looksLikePersona(partial)).toBe(false);
    });

    it('rejects unknown kind values', () => {
      const p = mintPersona(validInput);
      expect(looksLikePersona({ ...p, kind: 'fictional-character' })).toBe(false);
    });

    it('rejects builderAnswers with non-string values', () => {
      const p = mintPersona(validInput);
      expect(looksLikePersona({ ...p, builderAnswers: { foo: 42 } })).toBe(false);
    });
  });

  describe('hydratePersonas', () => {
    it('returns [] for non-array input', () => {
      expect(hydratePersonas(null)).toEqual([]);
      expect(hydratePersonas('not-an-array')).toEqual([]);
      expect(hydratePersonas({})).toEqual([]);
    });

    it('drops malformed entries silently', () => {
      const good = mintPersona(validInput);
      const result = hydratePersonas([
        good,
        { id: 'bad' }, // missing required fields
        null,
        'string',
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(good.id);
    });
  });

  describe('updatePersona', () => {
    it('patches name + bumps updatedAt', async () => {
      const p = mintPersona(validInput);
      const list = [p];
      // Wait at least 1ms so the updatedAt change is observable.
      await new Promise((r) => setTimeout(r, 2));
      const next = updatePersona(list, p.id, { name: '新名字' });

      expect(next).not.toBe(list);
      expect(next[0].id).toBe(p.id);
      expect(next[0].name).toBe('新名字');
      expect(next[0].updatedAt).toBeGreaterThan(p.updatedAt);
      expect(next[0].createdAt).toBe(p.createdAt);
    });

    it('returns the same array reference when no persona matches', () => {
      const p = mintPersona(validInput);
      const list = [p];
      const next = updatePersona(list, 'nonexistent-id', { name: 'X' });
      expect(next).toBe(list);
    });
  });

  describe('deletePersona', () => {
    it('removes by id', () => {
      const a = mintPersona(validInput);
      const b = mintPersona({ ...validInput, name: '其他' });
      const next = deletePersona([a, b], a.id);
      expect(next).toHaveLength(1);
      expect(next[0].id).toBe(b.id);
    });

    it('returns equivalent array when id not found', () => {
      const a = mintPersona(validInput);
      const next = deletePersona([a], 'nonexistent-id');
      expect(next).toHaveLength(1);
    });
  });

  describe('built-in star classification', () => {
    it('lists the built-in 7 stars + the localised defaults for the active language', () => {
      const set = getBuiltInStarSet('zh');
      expect(set.has('马斯克')).toBe(true);
      expect(set.has('老子')).toBe(true);
      // The English canonical names are also in the set (Morning Star
      // prompts use them as keys regardless of locale).
      expect(set.has('Elon Musk')).toBe(true);
      expect(set.has('Laozi')).toBe(true);
    });

    it('isBuiltInStar returns true for 7-sage names, false for user-added', () => {
      expect(isBuiltInStar('马斯克', 'zh')).toBe(true);
      expect(isBuiltInStar('Elon Musk', 'zh')).toBe(true);
      expect(isBuiltInStar('我心中的爷爷', 'zh')).toBe(false);
    });

    it('findCustomPersonaByName returns the matching persona', () => {
      const a = mintPersona({ ...validInput, name: '王阳明' });
      const b = mintPersona({ ...validInput, name: '村上春树' });
      expect(findCustomPersonaByName([a, b], '村上春树')?.id).toBe(b.id);
      expect(findCustomPersonaByName([a, b], '不存在')).toBeUndefined();
    });
  });
});
