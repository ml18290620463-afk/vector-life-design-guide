import { describe, expect, it } from 'vitest';
import {
  buildEchoChamberPrompt,
  isEchoChamberValidationFail,
  validateEchoChamberInput,
} from './echoChamberPrompt';

const validQuery = '我现在该不该辞职?这份工作让我焦虑,但收入稳定,而且团队我也喜欢。';
const validPersonas = ['Marcus Aurelius', 'Naval Ravikant', 'Laozi'];

describe('server/echoChamberPrompt', () => {
  describe('validateEchoChamberInput re-export', () => {
    it('accepts a clean payload (re-exported from lib/)', () => {
      const out = validateEchoChamberInput({
        query: validQuery,
        personaNames: validPersonas,
      });
      expect(out.ok).toBe(true);
    });

    it('isEchoChamberValidationFail narrows', () => {
      const out = validateEchoChamberInput({
        query: 'too short',
        personaNames: validPersonas,
      });
      expect(isEchoChamberValidationFail(out)).toBe(true);
    });
  });

  describe('buildEchoChamberPrompt', () => {
    it('embeds the round-table + safety + synthesis guidance blocks', () => {
      const { prompt } = buildEchoChamberPrompt({
        query: validQuery,
        personaNames: validPersonas,
      });
      expect(prompt).toMatch(/Round Table/);
      expect(prompt).toMatch(/disagreement is a feature/);
      expect(prompt).toMatch(/SYNTHESIS BLOCK GUIDANCE/);
      expect(prompt).toMatch(/SAFETY GUARDRAILS/);
      expect(prompt).toMatch(/共识/);
      expect(prompt).toMatch(/分歧/);
      expect(prompt).toMatch(/下一步问题/);
    });

    it('includes the verbatim user query at the end', () => {
      const { prompt } = buildEchoChamberPrompt({
        query: validQuery,
        personaNames: validPersonas,
      });
      expect(prompt).toContain(validQuery);
      // Query should be near the very end of the prompt (after the
      // last divider) so the LLM sees the question as the freshest
      // context.
      const queryIdx = prompt.lastIndexOf(validQuery);
      expect(queryIdx).toBeGreaterThan(prompt.length - validQuery.length - 200);
    });

    it('lists every persona name in the instructions block', () => {
      const { prompt } = buildEchoChamberPrompt({
        query: validQuery,
        personaNames: validPersonas,
      });
      for (const name of validPersonas) {
        expect(prompt).toContain(name);
      }
    });

    it('inlines a custom persona system prompt when supplied', () => {
      const { prompt } = buildEchoChamberPrompt({
        query: validQuery,
        personaNames: ['Custom Sage'],
        customPersonaPrompts: { 'Custom Sage': 'You are a custom system prompt.' },
      });
      expect(prompt).toMatch(/Custom Sage/);
      expect(prompt).toMatch(/自定义启明星/);
      expect(prompt).toMatch(/You are a custom system prompt/);
    });

    it('inlines memoir recall snippets when supplied', () => {
      const { prompt } = buildEchoChamberPrompt({
        query: validQuery,
        personaNames: ['奶奶'],
        memoirRecallByPersona: {
          奶奶: [{ body: '上次你说要换工作' }, { body: '上次你说焦虑' }],
        },
      });
      expect(prompt).toMatch(/长期记忆/);
      expect(prompt).toMatch(/上次你说要换工作/);
      expect(prompt).toMatch(/上次你说焦虑/);
    });

    it('omits the recall block for personas not in the recall map', () => {
      const { prompt } = buildEchoChamberPrompt({
        query: validQuery,
        personaNames: ['Marcus'],
      });
      expect(prompt).not.toMatch(/长期记忆/);
    });
  });
});
