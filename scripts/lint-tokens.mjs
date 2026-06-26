#!/usr/bin/env node

/**
 * Design-token migration scoreboard — Phase 3 §3.a-2.
 *
 * Scans `components/**\/*.{ts,tsx}` for raw `#RRGGBB` / `rgba(…)`
 * colour literals that ROADMAP §3.a wants to move into
 * `lib/designTokens.ts`. Prints a per-file count + the top offenders
 * so the team can chip away at the migration without flipping the
 * lint rule to `warn` (which would trip `--max-warnings=0`).
 *
 * Usage:
 *   npm run lint:tokens                        # default — full report
 *   npm run lint:tokens -- --dir <path>        # narrow to one folder
 *   npm run lint:tokens -- --json              # machine-readable
 *   npm run lint:tokens -- --strict            # exit 1 if any hit found
 *
 * Exit codes:
 *   0 — scoreboard printed (always, unless --strict and there are hits)
 *   1 — strict mode and at least one offender found
 *   2 — script crashed
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const argDir = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : 'components';
const json = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Recursively walk a directory and yield .ts / .tsx files,
 * skipping the usual node_modules / dist / coverage noise.
 */
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'coverage' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }
      yield* walk(full);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.spec.tsx')
    ) {
      yield full;
    }
  }
}

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA_PATTERN = /\brgba?\([^)]+\)/g;

const main = async () => {
  const target = path.resolve(ROOT, argDir);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    process.stderr.write(`${RED}lint-tokens: ${target} is not a directory${RESET}\n`);
    process.exit(2);
  }

  /** @type {Array<{ file: string; hex: number; rgba: number; samples: string[] }>} */
  const reports = [];
  for await (const file of walk(target)) {
    const source = await fs.readFile(file, 'utf8');
    const hexMatches = source.match(HEX_PATTERN) || [];
    const rgbaMatches = source.match(RGBA_PATTERN) || [];
    const total = hexMatches.length + rgbaMatches.length;
    if (total === 0) continue;
    const samples = Array.from(new Set([...hexMatches.slice(0, 4), ...rgbaMatches.slice(0, 2)]));
    reports.push({
      file: path.relative(ROOT, file),
      hex: hexMatches.length,
      rgba: rgbaMatches.length,
      samples,
    });
  }

  reports.sort((a, b) => b.hex + b.rgba - (a.hex + a.rgba));

  const totalHex = reports.reduce((s, r) => s + r.hex, 0);
  const totalRgba = reports.reduce((s, r) => s + r.rgba, 0);
  const totalAll = totalHex + totalRgba;

  if (json) {
    process.stdout.write(
      JSON.stringify({ totalHex, totalRgba, totalAll, reports }, null, 2) + '\n',
    );
  } else {
    if (reports.length === 0) {
      process.stdout.write(`${GREEN}✓ no hex / rgba literals under ${argDir}${RESET}\n`);
    } else {
      process.stdout.write(`${YELLOW}Design-token migration backlog under ${argDir}/${RESET}\n`);
      process.stdout.write(
        `${DIM}(rule '${`no raw colour literals in .tsx`}' — ROADMAP §3.a-2)${RESET}\n\n`,
      );
      process.stdout.write(`  ${'hex'.padStart(4)} ${'rgba'.padStart(5)}  file\n`);
      for (const r of reports.slice(0, 30)) {
        process.stdout.write(
          `  ${String(r.hex).padStart(4)} ${String(r.rgba).padStart(5)}  ${r.file}\n`,
        );
      }
      if (reports.length > 30) {
        process.stdout.write(`  ${DIM}… +${reports.length - 30} more files${RESET}\n`);
      }
      process.stdout.write(
        `\n${DIM}Total: ${totalHex} hex + ${totalRgba} rgba = ${totalAll} literal${
          totalAll === 1 ? '' : 's'
        } across ${reports.length} file${reports.length === 1 ? '' : 's'}.${RESET}\n`,
      );
    }
  }

  if (strict && totalAll > 0) {
    process.stderr.write(
      `${RED}lint-tokens (strict): ${totalAll} hit${totalAll === 1 ? '' : 's'} — failing CI.${RESET}\n`,
    );
    process.exit(1);
  }
  process.exit(0);
};

main().catch((err) => {
  process.stderr.write(`${RED}lint-tokens: ${err.stack || err.message}${RESET}\n`);
  process.exit(2);
});
