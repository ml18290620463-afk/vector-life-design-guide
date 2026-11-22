import { describe, expect, it } from 'vitest';
import { selectGuidanceResults } from './guidanceResults';

describe('feedback evidence budget', () => {
  const successes = [5, 4, 3, 2].map(day => ({ text: '汇报顺利', status: 'helpful', occurredOn: `2026-11-0${day}` }));
  it('retains an older explicit counterexample without exceeding four records', () => {
    const exception = { text: '临时讨论时提纲没有帮助', status: 'unhelpful', occurredOn: '2026-11-01' };
    const result = selectGuidanceResults([...successes, exception]);
    expect(result).toHaveLength(4);
    expect(result).toContain(exception);
    expect(result[0]).toEqual(successes[0]);
  });
  it('does not treat cancellation or noncompletion as evidence of ineffectiveness', () => {
    for (const status of ['cancelled', 'not_completed']) {
      expect(selectGuidanceResults([...successes, { text: '暂停', status, occurredOn: '2026-11-01' }])).toEqual(successes);
    }
  });
});
