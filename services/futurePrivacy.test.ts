import { beforeEach, expect, it } from 'vitest';
import { clear } from 'idb-keyval';
import {
  saveVision,
  saveGoal,
  saveFutureAction,
  readFutureSnapshot,
  recordActionPractice,
} from './futureRepository';
import { evidenceGraph } from '../tests/fixtures/avatarOntology';
import { buildGuidanceSources } from './avatarGuidanceSources';
import { readAIPrivacy, assertAIPrivacyUnchanged } from './aiPrivacy';

beforeEach(async () => {
  await clear();
  localStorage.clear();
});
const sources = async () => {
  const { state, actions } = await readFutureSnapshot();
  return buildGuidanceSources({
    entries: [],
    graph: evidenceGraph([], []),
    principles: [],
    future: state,
    actions,
  });
};
it('defaults future content to private and requires every parent to be allowed', async () => {
  let vision = await saveVision({ text: '秘密愿景', status: 'active' });
  let goal = await saveGoal({
    title: '秘密目标',
    visionId: vision.id,
    measurement: { kind: 'narrative' },
    status: 'active',
    tags: [],
    aiVisibility: 'allowed',
  });
  const action = await saveFutureAction({
    title: '秘密行动',
    status: 'pending',
    goalId: goal.id,
    aiVisibility: 'allowed',
  });
  expect(vision.aiVisibility).toBe('private');
  expect(await sources()).toEqual([]);
  vision = await saveVision({ ...vision, aiVisibility: 'allowed' });
  expect((await sources()).map((s) => s.id)).toEqual(
    expect.arrayContaining([vision.id, goal.id, action.id]),
  );
  const old = (await readAIPrivacy()).token;
  goal = await saveGoal({ ...goal, aiVisibility: 'private' });
  expect((await sources()).map((s) => s.id)).toEqual([vision.id]);
  await expect(assertAIPrivacyUnchanged(old)).rejects.toThrow();
  await saveGoal({ ...goal, aiVisibility: 'allowed' });
  await expect(assertAIPrivacyUnchanged(old)).rejects.toThrow();
});
it('persists action consent and revokes action plus practice evidence on a private feedback save', async () => {
  const action = await saveFutureAction({
    title: '安排检查',
    status: 'pending',
    aiVisibility: 'allowed',
  });
  expect((await readFutureSnapshot()).actions[0].aiVisibility).toBe('allowed');
  await recordActionPractice({
    actionId: action.id,
    expectedActionRevision: action.revision!,
    status: 'partial',
    nextStep: 'continue',
    note: '私密反馈',
    occurredOn: '2026-11-10',
    aiVisibility: 'private',
  });
  expect((await readFutureSnapshot()).actions[0].aiVisibility).toBe('private');
  expect(await sources()).toEqual([]);
});
