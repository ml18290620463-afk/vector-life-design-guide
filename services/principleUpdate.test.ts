import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PatternPrincipleLink, Principle } from '../types';
import { DiaryStorageKeys as K } from './diaryStorage';
import { applyPrincipleFeedback } from './experienceFeedback';
import { commitPrincipleUpdate } from './principleUpdate';

const principle: Principle = {
  id: 'p',
  text: '先确认目标',
  year: 2026,
  createdAt: 1,
  showOnHome: true,
  confidence: 0.5,
};
const link: PatternPrincipleLink = {
  id: 'l',
  patternId: 'pattern',
  principleId: 'p',
  relation: 'continue',
  status: 'confirmed',
  createdBy: 'user',
  createdAt: 1,
  updatedAt: 1,
};
beforeEach(async () => {
  await clear();
  await set(K.principles, [principle]);
  await set(K.patternPrincipleLinks, [link]);
});
describe('atomic principle feedback', () => {
  it('commits counters and link validation once, including stale retries', async () => {
    await set(K.entries, [
      { id: 'e', principleFeedback: [{ principleId: 'p', outcome: 'helpful', createdAt: 5 }] },
    ]);
    const updated = applyPrincipleFeedback(principle, 'helpful', 5, 'e');
    await commitPrincipleUpdate(updated, [principle], [link]);
    await commitPrincipleUpdate(updated, [principle], [link]);
    expect(await get(K.principles)).toEqual([
      expect.objectContaining({
        confidence: 0.62,
        helpfulCount: 1,
        appliedFeedbackEntryIds: ['e'],
      }),
    ]);
    expect(await get(K.patternPrincipleLinks)).toEqual([
      expect.objectContaining({ status: 'validated', updatedAt: 5 }),
    ]);
  });
  it('does not commit either side when feedback has no saved result', async () => {
    await expect(
      commitPrincipleUpdate(
        applyPrincipleFeedback(principle, 'helpful', 5, 'missing'),
        [principle],
        [link],
      ),
    ).rejects.toThrow('未找到');
    expect(await get(K.principles)).toEqual([principle]);
    expect(await get(K.patternPrincipleLinks)).toEqual([link]);
  });
  it('preserves unrelated edits and rejects stale conflicting edits', async () => {
    const other = { ...principle, id: 'other', text: '其他原则' };
    await set(K.principles, [principle, other]);
    await commitPrincipleUpdate({ ...principle, text: '更新表达' }, [principle], [link]);
    expect(await get(K.principles)).toContainEqual(expect.objectContaining(other));
    await expect(
      commitPrincipleUpdate({ ...principle, text: '过期表达' }, [principle], [link]),
    ).rejects.toThrow('其他页面');
  });
});
