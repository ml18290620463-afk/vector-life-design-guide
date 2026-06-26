import { describe, expect, it } from 'vitest';
import {
  buildExtractorPrompt,
  isTranscriptValidationFail,
  parseExtractedMemories,
  validateTranscript,
} from './memoryExtractor';

const transcript = [
  { role: 'user' as const, content: '我下周要去面试一个产品经理的岗位。' },
  { role: 'memoir' as const, content: '我记得你大学时也很爱想这些。慢慢来。' },
  { role: 'user' as const, content: '上周面试过了。其实我自己有点惊喜。' },
];

describe('server/memoryExtractor', () => {
  describe('validateTranscript', () => {
    it('accepts a clean transcript and trims overlong content', () => {
      const huge = [{ role: 'user', content: 'X'.repeat(5000) }];
      const result = validateTranscript(huge);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.turns[0].content.length).toBeLessThanOrEqual(4000);
    });

    it('rejects non-array payloads', () => {
      expect(isTranscriptValidationFail(validateTranscript(null))).toBe(true);
      expect(isTranscriptValidationFail(validateTranscript({}))).toBe(true);
      expect(isTranscriptValidationFail(validateTranscript('hi'))).toBe(true);
    });

    it('rejects empty transcripts', () => {
      const result = validateTranscript([]);
      expect(isTranscriptValidationFail(result)).toBe(true);
      if (!isTranscriptValidationFail(result)) return;
      expect(result.reason).toMatch(/empty/);
    });

    it('rejects transcripts > 50 turns', () => {
      const huge = Array.from({ length: 51 }, () => ({ role: 'user', content: 'x' }));
      const result = validateTranscript(huge);
      expect(isTranscriptValidationFail(result)).toBe(true);
    });

    it('rejects unknown roles', () => {
      const result = validateTranscript([{ role: 'bot', content: 'x' }]);
      expect(isTranscriptValidationFail(result)).toBe(true);
    });

    it('rejects non-string content', () => {
      const result = validateTranscript([{ role: 'user', content: 123 }]);
      expect(isTranscriptValidationFail(result)).toBe(true);
    });
  });

  describe('buildExtractorPrompt', () => {
    it('embeds the safety + extraction blocks', () => {
      const { prompt } = buildExtractorPrompt(transcript);
      expect(prompt).toMatch(/SAFETY GUARDRAILS/);
      expect(prompt).toMatch(/never include third-party private contact details/i);
      expect(prompt).toMatch(/EXTRACTION GUIDANCE/);
      expect(prompt).toMatch(/0-8 short, factual memory candidates/);
      expect(prompt).toMatch(/OUTPUT FORMAT/);
    });

    it('formats turns with USER / MEMOIR labels and collapses whitespace', () => {
      const { prompt } = buildExtractorPrompt([
        { role: 'user', content: 'hello\n\n\nworld' },
        { role: 'memoir', content: '  trim me  ' },
      ]);
      expect(prompt).toMatch(/USER: hello world/);
      expect(prompt).toMatch(/MEMOIR: trim me/);
    });
  });

  describe('parseExtractedMemories', () => {
    const valid = {
      memories: [
        { category: 'fact', body: '用户上周面试通过了' },
        { category: 'emotion', body: '用户感到惊喜' },
      ],
    };

    it('parses a clean JSON response', () => {
      const out = parseExtractedMemories(JSON.stringify(valid));
      expect(out).toHaveLength(2);
      expect(out![0]).toEqual({ category: 'fact', body: '用户上周面试通过了' });
    });

    it('strips markdown fences', () => {
      const out = parseExtractedMemories('```json\n' + JSON.stringify(valid) + '\n```');
      expect(out).toHaveLength(2);
    });

    it('returns an empty array when memories key is missing', () => {
      const out = parseExtractedMemories(JSON.stringify({}));
      expect(out).toEqual([]);
    });

    it('returns an empty array when memories is empty', () => {
      const out = parseExtractedMemories(JSON.stringify({ memories: [] }));
      expect(out).toEqual([]);
    });

    it('drops candidates with invalid categories', () => {
      const out = parseExtractedMemories(
        JSON.stringify({
          memories: [
            { category: 'fact', body: 'good' },
            { category: 'bogus', body: 'drop me' },
          ],
        }),
      );
      expect(out).toHaveLength(1);
      expect(out![0].body).toBe('good');
    });

    it('drops candidates with empty bodies', () => {
      const out = parseExtractedMemories(
        JSON.stringify({
          memories: [
            { category: 'fact', body: '   ' },
            { category: 'fact', body: 'kept' },
          ],
        }),
      );
      expect(out).toEqual([{ category: 'fact', body: 'kept' }]);
    });

    it('returns null when no JSON object is present', () => {
      expect(parseExtractedMemories('not json')).toBeNull();
      expect(parseExtractedMemories('')).toBeNull();
    });

    it('returns null when memories is not an array', () => {
      const out = parseExtractedMemories(JSON.stringify({ memories: 'oops' }));
      expect(out).toBeNull();
    });
  });
});
