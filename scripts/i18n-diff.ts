#!/usr/bin/env -S npx tsx

/**
 * i18n drift detector — Phase 3 §3.d.
 *
 * Loads every locale module under `i18n/locales/*.ts` via tsx's runtime
 * import and reports any key that drifts between locales (missing,
 * extra, or empty-string).
 *
 * The reference locale is `zh` (the original copy is authored there
 * first); other locales are checked against it. Keys that exist in a
 * non-`zh` locale but not in `zh` also count as drift (likely a typo
 * or stale copy).
 *
 * Usage:
 *   npm run i18n:diff               # human-readable report (exit 1 on
 *                                     ANY drift — strict mode)
 *   npm run i18n:diff -- --soft     # exit 0 on "missing" alone; exit 1
 *                                     only on extras / empty-value bugs.
 *                                     Use this in `scripts/check-beta.sh`
 *                                     until the translation backlog is
 *                                     filled in.
 *   npm run i18n:diff -- --json     # machine-readable for CI
 *
 * Exit codes:
 *   0 — clean (or only "missing" drift in --soft mode)
 *   1 — drift detected (CI should fail)
 *   2 — script crashed
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '..', 'i18n', 'locales');
const REFERENCE_LOCALE = 'zh';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

type LocaleMap = Record<string, Record<string, unknown>>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Each locale file exports a single named const matching its file name
 * (e.g. `i18n/locales/zh.ts` → `export const zh = { … }`). We import
 * the module dynamically and pluck out the named export, falling back
 * to `default` for safety.
 */
const loadLocale = async (filePath: string, code: string): Promise<Record<string, unknown>> => {
  const moduleUrl = url.pathToFileURL(filePath).href;
  const mod = (await import(moduleUrl)) as Record<string, unknown>;
  const candidate = mod[code] ?? (mod as { default?: unknown }).default;
  if (!isPlainObject(candidate)) {
    throw new Error(
      `Locale module ${path.basename(filePath)} did not export an object named "${code}".`,
    );
  }
  return candidate;
};

const loadAllLocales = async (): Promise<LocaleMap> => {
  const files = (await fs.readdir(LOCALES_DIR))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort();
  const out: LocaleMap = {};
  for (const file of files) {
    const code = path.basename(file, '.ts');
    out[code] = await loadLocale(path.join(LOCALES_DIR, file), code);
  }
  return out;
};

interface DriftReport {
  locale: string;
  /** Keys present in zh but missing (or null/undefined) in this locale. */
  missing: string[];
  /** Keys present in this locale but not in zh — likely typos / stale copy. */
  extra: string[];
  /** Keys whose value collapsed to empty string. */
  emptyValues: string[];
}

const analyse = (locales: LocaleMap): DriftReport[] => {
  const reference = locales[REFERENCE_LOCALE];
  if (!isPlainObject(reference)) {
    throw new Error(`Reference locale "${REFERENCE_LOCALE}" did not parse to an object`);
  }
  const referenceKeys = new Set(Object.keys(reference));

  const reports: DriftReport[] = [];
  for (const [code, entries] of Object.entries(locales)) {
    if (code === REFERENCE_LOCALE) continue;
    if (!isPlainObject(entries)) {
      reports.push({
        locale: code,
        missing: [...referenceKeys],
        extra: [],
        emptyValues: [],
      });
      continue;
    }
    const missing: string[] = [];
    const emptyValues: string[] = [];
    for (const key of referenceKeys) {
      const value = entries[key];
      const referenceValue = reference[key];
      // Reference-side intentional placeholders (`subjectTitle: ''`)
      // are *expected* to stay empty in every locale — flagging them
      // would be noise, not a drift signal.
      const referenceIsEmpty = typeof referenceValue === 'string' && referenceValue.trim() === '';
      if (value === undefined || value === null) {
        missing.push(key);
      } else if (typeof value === 'string' && value.trim() === '' && !referenceIsEmpty) {
        emptyValues.push(key);
      }
    }
    const extra = Object.keys(entries).filter((k) => !referenceKeys.has(k));
    reports.push({ locale: code, missing, extra, emptyValues });
  }
  return reports;
};

const formatBucket = (label: string, items: string[]): string => {
  if (items.length === 0) return '';
  const head = items.slice(0, 8).join(', ');
  const tail = items.length > 8 ? ` … +${items.length - 8}` : '';
  return `    ${YELLOW}${label.padEnd(11)}(${items.length}):${RESET} ${head}${tail}`;
};

const formatHuman = (reports: DriftReport[]): string => {
  const lines: string[] = [];
  let totalDrift = 0;
  for (const r of reports) {
    const driftCount = r.missing.length + r.extra.length + r.emptyValues.length;
    totalDrift += driftCount;
    if (driftCount === 0) {
      lines.push(`${GREEN}✓${RESET} ${r.locale.padEnd(4)}  in sync`);
      continue;
    }
    lines.push(
      `${RED}✗${RESET} ${r.locale.padEnd(4)}  ${driftCount} drift entr${driftCount === 1 ? 'y' : 'ies'}`,
    );
    const missing = formatBucket('missing', r.missing);
    const extra = formatBucket('extra', r.extra);
    const empty = formatBucket('empty val', r.emptyValues);
    if (missing) lines.push(missing);
    if (extra) lines.push(extra);
    if (empty) lines.push(empty);
  }
  lines.push('');
  lines.push(
    `${DIM}Reference locale: ${REFERENCE_LOCALE}.  Total drift entries across all locales: ${totalDrift}.${RESET}`,
  );
  return lines.join('\n');
};

const main = async (): Promise<number> => {
  const json = process.argv.includes('--json');
  const soft = process.argv.includes('--soft');
  let locales: LocaleMap;
  try {
    locales = await loadAllLocales();
  } catch (err) {
    process.stderr.write(
      `${RED}i18n-diff: failed to load locales — ${(err as Error).message}${RESET}\n`,
    );
    return 2;
  }

  const reports = analyse(locales);
  const totalMissing = reports.reduce((s, r) => s + r.missing.length, 0);
  const totalExtra = reports.reduce((s, r) => s + r.extra.length, 0);
  const totalEmpty = reports.reduce((s, r) => s + r.emptyValues.length, 0);
  const totalDrift = totalMissing + totalExtra + totalEmpty;

  if (json) {
    process.stdout.write(
      JSON.stringify({ totalDrift, totalMissing, totalExtra, totalEmpty, reports }, null, 2) + '\n',
    );
  } else {
    process.stdout.write(formatHuman(reports) + '\n');
    if (soft && (totalExtra > 0 || totalEmpty > 0)) {
      process.stderr.write(
        `${RED}i18n-diff (soft mode): typo/empty drift detected — failing CI.${RESET}\n`,
      );
    } else if (soft && totalMissing > 0) {
      process.stderr.write(
        `${YELLOW}i18n-diff (soft mode): ${totalMissing} missing translation${
          totalMissing === 1 ? '' : 's'
        } — non-blocking translator backlog.${RESET}\n`,
      );
    }
  }

  if (soft) {
    return totalExtra > 0 || totalEmpty > 0 ? 1 : 0;
  }
  return totalDrift === 0 ? 0 : 1;
};

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(
      `${RED}i18n-diff: unexpected error — ${err.stack || err.message}${RESET}\n`,
    );
    process.exit(2);
  });
