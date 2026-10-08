#!/usr/bin/env node
// @ts-check
/**
 * Phase 4.5 §D — Lighthouse audit harness.
 *
 * Boots `vite preview` against the existing `dist/` bundle, runs
 * Lighthouse in mobile + desktop modes, and exits non-zero if any
 * category score sinks below the budget defined in
 * `lighthouse-budget.json`.
 *
 * Usage:
 *   - `npm run audit:lighthouse`        (full mobile + desktop; exits
 *                                        on threshold breach)
 *   - `node scripts/lighthouse-audit.mjs --no-fail`  (informational
 *                                                     only; never exits
 *                                                     non-zero)
 *   - `node scripts/lighthouse-audit.mjs --form-factor=desktop`
 *                                       (run a single form-factor)
 *
 * Reports land in `lighthouse-reports/` (gitignored) as both JSON
 * and HTML. CI uploads them as workflow artefacts; local devs open
 * the HTML in their browser.
 *
 * Why a hand-rolled mjs script (not @lhci/cli):
 *   - lhci@0.x has its own opinionated config layer that fights
 *     our manifest.json + service-worker stack.
 *   - We only need the threshold gate + report dump; both are ~50
 *     lines of code with the bare lighthouse module.
 *   - Keeps `package.json` light: lighthouse + chrome-launcher are
 *     the only new devDeps.
 */

import { spawn } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const reportsDir = path.join(projectRoot, 'lighthouse-reports');
const budgetPath = path.join(projectRoot, 'lighthouse-budget.json');
const previewPort = Number(process.env.LH_PREVIEW_PORT) || 4173;
const previewUrl = `http://localhost:${previewPort}`;

const args = process.argv.slice(2);
const noFail = args.includes('--no-fail');
const requestedFormFactor = args.find((a) => a.startsWith('--form-factor='));
const formFactors = requestedFormFactor
  ? [requestedFormFactor.split('=')[1]]
  : ['mobile', 'desktop'];

/** Read the budget JSON or fall back to safe defaults if it is
 *  missing / malformed. The defaults are intentionally a hair
 *  lower than the published 90 floor so a fresh checkout doesn't
 *  fail until the budget file is created. */
async function readBudget() {
  const fallback = {
    performance: 90,
    accessibility: 90,
    'best-practices': 90,
    seo: 90,
  };
  if (!existsSync(budgetPath)) return fallback;
  try {
    const raw = await readFile(budgetPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch (err) {
    console.warn(`[lh] could not parse ${budgetPath}: ${err.message}`);
    return fallback;
  }
}

/** Spawn `vite preview` in the background. Resolves once the port
 *  is responsive (polled every 250 ms, ~10 s timeout). */
async function startPreview() {
  if (!existsSync(path.join(projectRoot, 'dist'))) {
    throw new Error('dist/ not found — run `npm run build` first.');
  }
  console.log(`[lh] starting vite preview on :${previewPort}`);
  const proc = spawn(
    'npx',
    ['vite', 'preview', '--port', String(previewPort), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    },
  );
  proc.stderr.on('data', (chunk) => {
    process.stderr.write(`[preview] ${chunk}`);
  });
  // Poll the port until it answers.
  const deadline = Date.now() + 15_000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(previewUrl);
      if (res.ok) {
        ok = true;
        break;
      }
    } catch {
      // not yet listening
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ok) {
    proc.kill('SIGINT');
    throw new Error(`vite preview did not become responsive at ${previewUrl}`);
  }
  console.log(`[lh] preview ready at ${previewUrl}`);
  return proc;
}

/** Tear down the preview server. Always best-effort. */
function stopPreview(proc) {
  if (!proc || proc.killed) return;
  try {
    proc.kill('SIGTERM');
  } catch {
    // already dead
  }
}

/** Run one Lighthouse audit + write the JSON + HTML reports.
 *  Returns the category-score map for the threshold check. */
async function runOnce(formFactor) {
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });
  try {
    const result = await lighthouse(previewUrl, {
      port: chrome.port,
      output: ['json', 'html'],
      logLevel: 'error',
      formFactor,
      screenEmulation:
        formFactor === 'desktop'
          ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
          : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      throttling:
        formFactor === 'desktop'
          ? {
              rttMs: 40,
              throughputKbps: 10 * 1024,
              cpuSlowdownMultiplier: 1,
              requestLatencyMs: 0,
              downloadThroughputKbps: 0,
              uploadThroughputKbps: 0,
            }
          : undefined,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    const lhr = result.lhr;
    const reports = Array.isArray(result.report) ? result.report : [result.report];
    await mkdir(reportsDir, { recursive: true });
    await writeFile(path.join(reportsDir, `${formFactor}.json`), reports[0], 'utf8');
    if (reports[1]) {
      await writeFile(path.join(reportsDir, `${formFactor}.html`), reports[1], 'utf8');
    }
    /** @type {Record<string, number>} */
    const scores = {};
    for (const [key, cat] of Object.entries(lhr.categories)) {
      scores[key] = Math.round((cat.score ?? 0) * 100);
    }
    return scores;
  } finally {
    await chrome.kill();
  }
}

async function main() {
  const budget = await readBudget();
  let preview;
  /** @type {Record<string, Record<string, number>>} */
  const allScores = {};
  /** @type {string[]} */
  const breaches = [];
  try {
    preview = await startPreview();
    for (const ff of formFactors) {
      console.log(`[lh] running ${ff}…`);
      const scores = await runOnce(ff);
      allScores[ff] = scores;
      for (const [cat, score] of Object.entries(scores)) {
        const min = budget[cat];
        if (typeof min === 'number' && score < min) {
          breaches.push(`${ff}/${cat}: ${score} < ${min}`);
        }
      }
    }
  } finally {
    stopPreview(preview);
  }

  console.log('\n[lh] scores:');
  for (const [ff, scores] of Object.entries(allScores)) {
    console.log(`  ${ff}:`);
    for (const [cat, score] of Object.entries(scores)) {
      const min = budget[cat] ?? null;
      const tag = min !== null ? (score >= min ? '✅' : '❌') : 'ℹ️';
      console.log(
        `    ${tag} ${cat.padEnd(16)} ${String(score).padStart(3)} (min ${min ?? 'n/a'})`,
      );
    }
  }

  if (breaches.length > 0) {
    console.error(`\n[lh] ${breaches.length} threshold breach(es):`);
    for (const b of breaches) console.error(`  - ${b}`);
    if (!noFail) {
      console.error(`\nHTML reports written to ${path.relative(projectRoot, reportsDir)}/`);
      process.exit(1);
    }
  } else {
    console.log('\n[lh] all categories meet the budget. ✅');
  }
}

main().catch((err) => {
  console.error('[lh] fatal:', err);
  process.exit(2);
});
