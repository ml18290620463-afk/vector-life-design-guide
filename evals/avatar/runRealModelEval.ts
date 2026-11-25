import { readFile, writeFile } from 'node:fs/promises';

type EvalCase = { id: string; priority: 'P0' | 'P1'; category: string; messages: { role: string; content: string }[]; required: string[]; forbidden: string[] };
type Suite = { schemaVersion: number; cases: EvalCase[] };

const suite = JSON.parse(await readFile(new URL('./real_model_eval_suite.json', import.meta.url), 'utf8')) as Suite;
if (suite.schemaVersion !== 1 || !Array.isArray(suite.cases) || !suite.cases.length) throw new Error('Invalid evaluation suite');
const endpoint = process.env.VECTOR_EVAL_MODEL_URL;
const model = process.env.VECTOR_EVAL_MODEL_ID;
const key = process.env.VECTOR_EVAL_MODEL_API_KEY;
if (!endpoint || !model || !key) throw new Error('Set VECTOR_EVAL_MODEL_URL, VECTOR_EVAL_MODEL_ID and VECTOR_EVAL_MODEL_API_KEY to run the real-model evaluation');
const url = new URL(endpoint);
if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('Real-model endpoint must use HTTPS');
const rows = [];
for (const item of suite.cases) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: item.messages, temperature: 0 }) });
  if (!response.ok) throw new Error(`Model request failed for ${item.id}: HTTP ${response.status}`);
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const answer = payload.choices?.[0]?.message?.content;
  if (typeof answer !== 'string') throw new Error(`Model returned no text for ${item.id}`);
  rows.push({ id: item.id, priority: item.priority, category: item.category, passed: item.required.every((part) => answer.includes(part)) && item.forbidden.every((part) => !answer.includes(part)), missing: item.required.filter((part) => !answer.includes(part)), forbiddenHits: item.forbidden.filter((part) => answer.includes(part)) });
}
const report = { generatedAt: new Date().toISOString(), model, total: rows.length, passed: rows.filter((row) => row.passed).length, p0Passed: rows.filter((row) => row.priority === 'P0' && row.passed).length, p0Total: rows.filter((row) => row.priority === 'P0').length, results: rows };
const reportPath = process.env.VECTOR_EVAL_REPORT_PATH ?? '/tmp/vector-avatar-real-model-eval.json';
await writeFile(reportPath, JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify({ reportPath, total: report.total, passed: report.passed, p0Passed: report.p0Passed, p0Total: report.p0Total })}\n`);
if (report.passed !== report.total) process.exitCode = 1;
