import { describe, expect, it } from 'vitest';
import {
  MEMOIR_FIELDS,
  buildMemoirPrompt,
  extractGeneratedMemoir,
  isMemoirAnswerValidationFail,
  validateMemoirAnswers,
} from './memoirBuilderPrompt';

const completeAnswers = {
  name: '奶奶',
  relationship: '我的奶奶',
  voice: '"心里再苦,脸上也要带笑。" "饭要吃饱了再说话。"',
  memories: '小时候每个周末我都会去奶奶家,她会煮一大锅红烧肉。她总在我考砸时拍拍我的头说"不要紧"。',
  wishes: '希望在我焦虑时可以听她说"不要紧"',
};

describe('server/memoirBuilderPrompt', () => {
  describe('MEMOIR_FIELDS', () => {
    it('exposes a 5-step ordered wizard schema', () => {
      expect(MEMOIR_FIELDS).toHaveLength(5);
      expect(MEMOIR_FIELDS[0].id).toBe('name');
      expect(MEMOIR_FIELDS[1].id).toBe('relationship');
      expect(MEMOIR_FIELDS.map((f) => f.id)).toEqual([
        'name',
        'relationship',
        'voice',
        'memories',
        'wishes',
      ]);
    });

    it('every field carries both labels, a hint, and a maxChars cap', () => {
      for (const field of MEMOIR_FIELDS) {
        expect(field.id.length).toBeGreaterThan(0);
        expect(field.zhLabel.length).toBeGreaterThan(0);
        expect(field.enLabel.length).toBeGreaterThan(0);
        expect(field.zhHint.length).toBeGreaterThan(0);
        expect(field.enHint.length).toBeGreaterThan(0);
        expect(field.maxChars).toBeGreaterThan(0);
      }
    });

    it('the optional `wishes` field is the only non-required step', () => {
      const required = MEMOIR_FIELDS.filter((f) => f.required).map((f) => f.id);
      expect(required).toEqual(['name', 'relationship', 'voice', 'memories']);
    });
  });

  describe('validateMemoirAnswers', () => {
    it('accepts a complete payload and returns trimmed answers', () => {
      const result = validateMemoirAnswers({
        ...completeAnswers,
        name: '  奶奶  ',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.answers.name).toBe('奶奶');
      expect(result.answers.wishes?.length).toBeGreaterThan(0);
    });

    it('rejects non-object payloads', () => {
      expect(isMemoirAnswerValidationFail(validateMemoirAnswers(null))).toBe(true);
      expect(isMemoirAnswerValidationFail(validateMemoirAnswers('hi'))).toBe(true);
      expect(isMemoirAnswerValidationFail(validateMemoirAnswers([]))).toBe(true);
    });

    it('rejects payloads missing a required field', () => {
      const partial = { ...completeAnswers, voice: '' };
      const result = validateMemoirAnswers(partial);
      expect(isMemoirAnswerValidationFail(result)).toBe(true);
      if (!isMemoirAnswerValidationFail(result)) return;
      expect(result.reason).toMatch(/missing required field: voice/);
    });

    it('rejects payloads with unknown fields', () => {
      const result = validateMemoirAnswers({ ...completeAnswers, hidden: 'oops' });
      expect(isMemoirAnswerValidationFail(result)).toBe(true);
      if (!isMemoirAnswerValidationFail(result)) return;
      expect(result.reason).toMatch(/unknown field: hidden/);
    });

    it('rejects payloads with wrong-typed fields', () => {
      const result = validateMemoirAnswers({ ...completeAnswers, name: 42 });
      expect(result.ok).toBe(false);
    });

    it('caps each field at its maxChars before forwarding', () => {
      const long = 'X'.repeat(99999);
      const result = validateMemoirAnswers({
        ...completeAnswers,
        memories: long,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const memField = MEMOIR_FIELDS.find((f) => f.id === 'memories')!;
      expect(result.answers.memories.length).toBe(memField.maxChars);
    });

    it('omits empty optional fields from the output object', () => {
      const result = validateMemoirAnswers({ ...completeAnswers, wishes: '' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.answers.wishes).toBeUndefined();
    });
  });

  describe('buildMemoirPrompt', () => {
    it('embeds the safety guardrail blocks verbatim', () => {
      const { prompt } = buildMemoirPrompt(completeAnswers);
      expect(prompt).toMatch(/SAFETY GUARDRAILS/);
      expect(prompt).toMatch(/CRITICAL.*never embed third-party private contact details/i);
      expect(prompt).toMatch(/CRITICAL.*USER.S OWN[\s\S]*memory/);
      expect(prompt).toMatch(/Never claim to be the real person/);
      expect(prompt).toMatch(/self-harm/);
    });

    it("returns a fallback name from the user's name answer", () => {
      const { fallbackName } = buildMemoirPrompt(completeAnswers);
      expect(fallbackName).toBe('奶奶');
    });

    it('falls back to "心中的人" when name is empty', () => {
      const { fallbackName } = buildMemoirPrompt({ ...completeAnswers, name: '' });
      expect(fallbackName).toBe('心中的人');
    });

    it('formats wizard answers as a labelled block in the prompt', () => {
      const { prompt } = buildMemoirPrompt(completeAnswers);
      expect(prompt).toMatch(/WIZARD ANSWERS/);
      expect(prompt).toMatch(/name \(Who is this person/);
      expect(prompt).toMatch(/relationship \(Your relationship/);
    });

    it('still emits answers with `(no answer)` placeholder for blanks', () => {
      const { prompt } = buildMemoirPrompt({
        name: '奶奶',
        relationship: '我的奶奶',
        voice: '记不清了',
        memories: '一起吃晚饭',
      });
      expect(prompt).toMatch(/wishes \(What do you want.*\): \(no answer\)/);
    });
  });

  describe('extractGeneratedMemoir', () => {
    const valid = {
      name: '奶奶',
      description: '是我心中那位奶奶,陪我走过焦虑的夜晚',
      systemPrompt: '你是奶奶,是用户心中的奶奶。'.padEnd(1500, '。'),
    };

    it('parses a clean JSON response', () => {
      const out = extractGeneratedMemoir(JSON.stringify(valid));
      expect(out).toEqual(valid);
    });

    it('strips markdown fences', () => {
      const out = extractGeneratedMemoir('```json\n' + JSON.stringify(valid) + '\n```');
      expect(out).toEqual(valid);
    });

    it('tolerates leading prose ("Sure, here is your Memoir:")', () => {
      const out = extractGeneratedMemoir('Sure, here is your Memoir: ' + JSON.stringify(valid));
      expect(out).toEqual(valid);
    });

    it('returns null on missing systemPrompt', () => {
      const out = extractGeneratedMemoir(
        JSON.stringify({ name: 'X', description: 'D', systemPrompt: '' }),
      );
      expect(out).toBeNull();
    });

    it('returns null on unparseable text', () => {
      expect(extractGeneratedMemoir('not json at all')).toBeNull();
      expect(extractGeneratedMemoir('')).toBeNull();
    });
  });
});
