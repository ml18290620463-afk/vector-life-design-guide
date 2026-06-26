import { describe, expect, it } from 'vitest';
import {
  buildMemoirTranscript,
  extractPersonaSection,
  hasAnyHeading,
} from './memoirTranscriptSlicer';
import { mintPersona } from './personaService';

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

const SAMPLE_MD = `### ✉️ 来自 奶奶 的回信

孩子,记得我跟你说过 — 不要紧。慢慢来。

---

### ✉️ 来自 导师 的回信

记忆深刻 — 你那年答辩我也在场。这次同样,稳住。

---

### 💡 共同的思考留白

明天,你会做出怎样的选择?
`;

describe('services/memoirTranscriptSlicer', () => {
  describe('hasAnyHeading', () => {
    it('returns true when at least one persona section exists', () => {
      expect(hasAnyHeading(SAMPLE_MD)).toBe(true);
    });
    it('returns false on plain text', () => {
      expect(hasAnyHeading('just some text')).toBe(false);
      expect(hasAnyHeading('')).toBe(false);
    });
  });

  describe('extractPersonaSection', () => {
    it('extracts the body of a named persona section', () => {
      const slice = extractPersonaSection(SAMPLE_MD, '奶奶');
      expect(slice).toContain('不要紧');
      expect(slice).toContain('慢慢来');
      // Must not bleed into the mentor section.
      expect(slice).not.toContain('导师');
      expect(slice).not.toContain('答辩');
    });

    it('extracts the second persona section without leaking the closing 留白 block', () => {
      const slice = extractPersonaSection(SAMPLE_MD, '导师');
      expect(slice).toContain('稳住');
      expect(slice).not.toContain('共同的思考');
    });

    it('returns null when persona is not present', () => {
      expect(extractPersonaSection(SAMPLE_MD, '陌生人')).toBeNull();
    });

    it('returns null on empty input', () => {
      expect(extractPersonaSection('', '奶奶')).toBeNull();
      expect(extractPersonaSection(SAMPLE_MD, '')).toBeNull();
    });

    it('matches persona names with whitespace tolerance on the heading', () => {
      const md = '###  ✉️  来自  奶奶  的回信\n\nbody body body';
      expect(extractPersonaSection(md, '奶奶')).toContain('body body body');
    });
  });

  describe('buildMemoirTranscript', () => {
    it('returns a 2-turn USER + MEMOIR transcript on the happy path', () => {
      const transcript = buildMemoirTranscript({
        reflection: '今天我决定换工作了',
        responseMarkdown: SAMPLE_MD,
        memoir: memoirGrandma,
      });
      expect(transcript).toHaveLength(2);
      expect(transcript![0]).toEqual({
        role: 'user',
        content: '今天我决定换工作了',
      });
      expect(transcript![1].role).toBe('memoir');
      expect(transcript![1].content).toContain('不要紧');
    });

    it('returns null when persona is not a memoir', () => {
      const personaPersona = mintPersona({
        name: '奶奶',
        systemPrompt: 'x'.repeat(200),
        kind: 'persona',
      });
      const transcript = buildMemoirTranscript({
        reflection: 'hi',
        responseMarkdown: SAMPLE_MD,
        memoir: personaPersona,
      });
      expect(transcript).toBeNull();
    });

    it('returns null when reflection is empty / whitespace', () => {
      expect(
        buildMemoirTranscript({
          reflection: '   ',
          responseMarkdown: SAMPLE_MD,
          memoir: memoirGrandma,
        }),
      ).toBeNull();
    });

    it('returns null when the memoir has no section in the markdown', () => {
      const transcript = buildMemoirTranscript({
        reflection: 'hi',
        responseMarkdown: SAMPLE_MD,
        memoir: memoirMentor,
      });
      expect(transcript).not.toBeNull(); // mentor IS in the markdown — sanity
      const transcript2 = buildMemoirTranscript({
        reflection: 'hi',
        responseMarkdown: '### 💡 共同的思考留白\n\n(no persona sections at all)',
        memoir: memoirGrandma,
      });
      expect(transcript2).toBeNull();
    });
  });
});
