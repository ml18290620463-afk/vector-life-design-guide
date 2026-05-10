import { describe, expect, it } from 'vitest';
import { ECHO_CHAMBER_LIMITS, validateEchoChamberInput } from './echoChamberSchema';

const validQuery = '我现在该不该辞职?这份工作让我焦虑,但收入稳定。';
const validPersonas = ['Marcus Aurelius', 'Naval Ravikant', 'Laozi'];

describe('lib/echoChamberSchema', () => {
  describe('validateEchoChamberInput', () => {
    it('accepts a clean payload', () => {
      const out = validateEchoChamberInput({
        query: validQuery,
        personaNames: validPersonas,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.query).toBe(validQuery);
      expect(out.personaNames).toEqual(validPersonas);
    });

    it('rejects non-object payloads', () => {
      expect(validateEchoChamberInput(null).ok).toBe(false);
      expect(validateEchoChamberInput('hi').ok).toBe(false);
      expect(validateEchoChamberInput([]).ok).toBe(false);
    });

    it('rejects queries shorter than minQueryChars', () => {
      const out = validateEchoChamberInput({
        query: '太短了',
        personaNames: validPersonas,
      });
      expect(out.ok).toBe(false);
      if (out.ok === true) return;
      expect(out.reason).toMatch(/at least/);
    });

    it('caps queries at maxQueryChars', () => {
      const long = 'x'.repeat(ECHO_CHAMBER_LIMITS.maxQueryChars + 500);
      const out = validateEchoChamberInput({
        query: long,
        personaNames: validPersonas,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.query.length).toBe(ECHO_CHAMBER_LIMITS.maxQueryChars);
    });

    it('rejects fewer than minPersonas personas', () => {
      const out = validateEchoChamberInput({
        query: validQuery,
        personaNames: ['Marcus Aurelius', 'Laozi'],
      });
      expect(out.ok).toBe(false);
    });

    it('caps the persona list at maxPersonas (drops surplus)', () => {
      const many = Array.from({ length: 12 }, (_, i) => `persona-${i}`);
      const out = validateEchoChamberInput({
        query: validQuery,
        personaNames: many,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.personaNames.length).toBe(ECHO_CHAMBER_LIMITS.maxPersonas);
    });

    it('dedupes persona names case-sensitively', () => {
      const out = validateEchoChamberInput({
        query: validQuery,
        personaNames: ['A', 'A', 'B', 'C'],
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.personaNames).toEqual(['A', 'B', 'C']);
    });

    it('drops non-string + empty entries before counting', () => {
      const out = validateEchoChamberInput({
        query: validQuery,
        personaNames: [42, '', '  ', 'A', null, 'B', 'C'],
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.personaNames).toEqual(['A', 'B', 'C']);
    });

    it('trims the query', () => {
      const out = validateEchoChamberInput({
        query: `   ${validQuery}   `,
        personaNames: validPersonas,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.query).toBe(validQuery);
    });
  });
});
