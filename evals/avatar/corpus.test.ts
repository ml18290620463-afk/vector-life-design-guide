import { expect, it } from 'vitest';
import { avatarEvaluationCases as cases } from './corpus';
it('keeps a versionable synthetic corpus with single, multi-session and reserved cases', () => {
  expect(cases.filter((c) => c.steps.length === 1)).toHaveLength(60);
  expect(cases.filter((c) => c.steps.length > 1)).toHaveLength(20);
  expect(cases.filter((c) => c.split === 'holdout').length).toBeGreaterThanOrEqual(
    Math.ceil(cases.length / 3),
  );
  expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  const questions = cases.flatMap((c) => c.steps.map((s) => s.question));
  expect(new Set(questions).size).toBe(questions.length);
  expect(cases.filter((c) => c.steps.some((s) => s.newSession)).length).toBeGreaterThanOrEqual(6);
  for (const c of cases)
    for (const s of c.steps) {
      expect(s.expected.trim().length).toBeGreaterThanOrEqual(4);
      expect(s.forbidden.trim().length).toBeGreaterThanOrEqual(3);
    }
});
