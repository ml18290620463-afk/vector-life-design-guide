import { readFile } from 'node:fs/promises';

type Grade = Record<string, number>;
type Result = {
  condition: string;
  status: string;
  latencyMs: number | null;
  grade: Grade | null;
  hardFailure: boolean | null;
  reviewer: string | null;
};
type ReportFile = { split?: string; executed?: boolean; results?: Result[] };
const files = process.argv.slice(2);
if (!files.length) throw new Error('请传入至少一个评测结果 JSON 文件');
const reports = await Promise.all(
  files.map(async (path) => JSON.parse(await readFile(path, 'utf8')) as ReportFile),
);
const results = reports.flatMap((report) => report.results ?? []);
const reviewed = results.filter((result) => result.grade && result.reviewer);
const dimensions = new Map<string, number[]>();
for (const result of reviewed)
  for (const [name, value] of Object.entries(result.grade ?? {}))
    if (Number.isFinite(value)) dimensions.set(name, [...(dimensions.get(name) ?? []), value]);
const byCondition = Object.fromEntries(
  [...new Set(results.map((result) => result.condition))].map((condition) => {
    const group = results.filter((result) => result.condition === condition);
    const times = group
      .map((result) => result.latencyMs)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    return [
      condition,
      {
        total: group.length,
        reviewed: group.filter((result) => result.grade && result.reviewer).length,
        callFailures: group.filter((result) => result.status === 'call_failed').length,
        hardFailures: group.filter((result) => result.hardFailure === true).length,
        medianLatencyMs: times.length ? times[Math.floor(times.length / 2)] : null,
      },
    ];
  }),
);
const ready =
  reports.every((report) => report.executed) &&
  reviewed.length === results.length &&
  reports.some((report) => report.split === 'holdout');
console.log(
  JSON.stringify(
    {
      ready,
      reason: ready
        ? null
        : !reports.every((report) => report.executed)
          ? '存在未执行真实模型调用的结果，不能得出质量结论'
          : reviewed.length !== results.length
            ? '仍有结果未完成人工评审，不能得出质量结论'
            : '缺少保留集结果，不能得出质量结论',
      files: files.length,
      results: results.length,
      reviewed: reviewed.length,
      hardFailures: results.filter((result) => result.hardFailure === true).length,
      dimensions: Object.fromEntries(
        [...dimensions].map(([name, values]) => [
          name,
          values.reduce((sum, value) => sum + value, 0) / values.length,
        ]),
      ),
      byCondition,
    },
    null,
    2,
  ),
);
