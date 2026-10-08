import { describe, expect, it } from 'vitest';
import { answerAvatarEvidence, resolvePatternCorrection } from './avatarEvidenceDialogue';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';
import type { DiaryEntry, Principle } from '../types';
const pattern: AvatarUnderstandingVersion = {
  id: 'p',
  statement: '行动前会准备',
  status: 'confirmed',
  sourceEntryIds: ['e'],
  createdAt: 1,
};
const entry: DiaryEntry = {
  id: 'e',
  title: '准备',
  content: '提前整理材料，仍出现了遗漏。',
  tags: [],
  createdAt: 1,
  isLocked: false,
};
const principle: Principle = {
  id: 'rule',
  text: '先列检查清单',
  year: 2026,
  createdAt: 1,
  showOnHome: true,
  sourcePatternIds: ['p'],
  confidence: 0.62,
};
describe('Avatar evidence answers', () => {
  it('excludes unconfirmed conclusions and narrations are not hijacked', () => {
    expect(answerAvatarEvidence('我今天按原则提前准备了材料', [pattern], [], [entry])).toBeNull();
    const answer = answerAvatarEvidence(
      '我有哪些模式？',
      [
        pattern,
        { ...pattern, id: 'pending', status: 'pending', statement: '未认可' },
        { ...pattern, id: 'rejected', status: 'rejected', statement: '不符合' },
      ],
      [],
      [entry],
    );
    expect(answer).toContain(pattern.statement);
    expect(answer).not.toContain('未认可');
    expect(answer).not.toContain('不符合');
  });
  it('resolves principle evidence through confirmed patterns and reports actual outcomes', () => {
    const answer = answerAvatarEvidence(
      '原则有哪些证据，什么情况适用？',
      [pattern],
      [principle],
      [
        {
          ...entry,
          principleFeedback: [{ principleId: 'rule', outcome: 'unhelpful', createdAt: 1 }],
        },
      ],
    );
    expect(answer).toContain(entry.content);
    expect(answer).toContain('没有帮助');
    expect(answer).toContain('尚未明确适用情境');
    expect(answer).not.toContain('62%');
  });
  it('does not invent lost, sampled, or time-locked evidence', () => {
    for (const entries of [
      [],
      [{ ...entry, isSample: true }],
      [{ ...entry, unlockAt: Date.now() + 100000 }],
    ]) {
      const answer = answerAvatarEvidence('模式的证据是什么？', [pattern], [], entries);
      expect(answer).toContain('没有可读取的关联经历');
      expect(answer).not.toContain(entry.content);
    }
  });
});

describe('pattern correction selection', () => {
  it('keeps ordinal selection tied to the offered IDs after reordering', () => {
    const other = { ...pattern, id: 'other', statement: '另一个模式' };
    expect(resolvePatternCorrection('1', [other, pattern], ['p', 'other']).target?.id).toBe('p');
  });
  it('does not redirect a missing or invalid ordinal to the last remaining pattern', () => {
    expect(resolvePatternCorrection('1', [pattern], ['deleted', 'p']).target).toBeUndefined();
    expect(resolvePatternCorrection('0', [pattern], ['p']).target).toBeUndefined();
    expect(resolvePatternCorrection('9', [pattern], ['p']).target).toBeUndefined();
  });
});
