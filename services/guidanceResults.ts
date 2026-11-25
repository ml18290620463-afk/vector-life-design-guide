import type { GuidanceSource } from './avatarGuidance';

type Result = NonNullable<GuidanceSource['results']>[number];

/** Keep a recent counterexample visible even when newer successes fill the budget. */
export function selectGuidanceResults(results: Result[]): Result[] {
  const sorted = [...results].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const selected = sorted.slice(0, 4);
  const exception = sorted.find((r) => r.status === 'unhelpful' || r.status === 'unrelated');
  if (exception && !selected.includes(exception)) selected[selected.length - 1] = exception;
  return selected;
}
