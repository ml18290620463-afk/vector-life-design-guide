/**
 * Reproducible local baseline for the deterministic Past filters.
 *
 * Run: npm run bench:past-search
 * The script reports medians rather than enforcing machine-specific timings in
 * CI. Correctness and the performance envelope are covered in unit tests and
 * docs/testing/past-search-performance-2026-10-09.md.
 */
import { performance } from 'node:perf_hooks';
import type { DiaryEntry } from '../types';
import { filterPastEntries, type PastSearchFilters } from '../features/mobile/pastSearch';

const RUNS = 15;
const WARM_UP_RUNS = 3;

const makeFixture = (count: number) => {
  const entries: DiaryEntry[] = Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`,
    title: `记录 ${index}`,
    content: index % 5 === 0 ? '项目复盘与下一步尝试' : '日常观察',
    createdAt: index,
    tags: index % 2 === 0 ? ['工作'] : ['生活'],
    isLocked: false,
  }));
  return { entries };
};

const median = (samples: number[]) =>
  [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];

const measure = (run: () => unknown) => {
  for (let index = 0; index < WARM_UP_RUNS; index += 1) run();
  const samples = Array.from({ length: RUNS }, () => {
    const started = performance.now();
    run();
    return performance.now() - started;
  });
  return Number(median(samples).toFixed(2));
};

const scenarios: Array<{ name: string; filters: PastSearchFilters }> = [
  { name: 'tag', filters: { tags: ['工作'] } },
  { name: 'all', filters: {} },
];

const results = [1_000, 10_000].flatMap((count) => {
  const { entries } = makeFixture(count);
  return scenarios.map(({ name, filters }) => ({
    entries: count,
    scenario: name,
    filterMs: measure(() => filterPastEntries(entries, filters)),
  }));
});

console.table(results);
