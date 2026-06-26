/**
 * Phase 3 §3.e — Argon2id vs PBKDF2-SHA256 head-to-head benchmark.
 *
 * Run via `npm run bench:argon2`. Prints a markdown-friendly table
 * suitable for pasting into `docs/security/argon2-eval.md`.
 *
 * Methodology:
 *   - Each cell is the average of `RUNS` end-to-end derivations
 *     (warm-up run discarded). Salt + password held constant
 *     across runs so we measure pure KDF cost, not RNG / decoder.
 *   - PBKDF2 baseline: SHA-256, 600 000 iterations (current
 *     production cost factor in `services/securityService.ts`).
 *   - Argon2id presets: OWASP_MIN (19 MiB / 2t / 1p),
 *     OWASP_RECOMMENDED (64 MiB / 3t / 1p) and STRICT
 *     (128 MiB / 3t / 1p).
 *   - Output length normalised to 32 bytes everywhere so the
 *     resulting bits could (in principle) drive AES-GCM-256.
 *
 * Limitations:
 *   - Runs in Node.js with `hash-wasm`'s WebAssembly backend,
 *     which is what the production browser bundle would execute.
 *     Real-world browser numbers are typically 10–25 % slower
 *     because of V8 JIT differences and main-thread contention.
 *   - Does NOT pin CPU frequency or disable thermal throttling;
 *     the absolute milliseconds are device-specific.
 */

import { webcrypto } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  ARGON2_OWASP_MIN,
  ARGON2_OWASP_RECOMMENDED,
  ARGON2_STRICT,
  type Argon2idParams,
  deriveArgon2idBits,
} from '../services/argon2idPoc';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const RUNS = Number(process.env.VECTOR_BENCH_RUNS ?? '5');
const PBKDF2_ITERATIONS = Number(process.env.VECTOR_PBKDF2_ITERATIONS ?? '600000');

const PASSWORD = 'correct horse battery staple';
const SALT = new Uint8Array(16);
for (let i = 0; i < 16; i += 1) SALT[i] = i + 1;

interface BenchRow {
  name: string;
  meanMs: number;
  minMs: number;
  maxMs: number;
  notes: string;
}

const formatMs = (ms: number): string => `${ms.toFixed(1)} ms`;

const benchPbkdf2 = async (iterations: number): Promise<BenchRow> => {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PASSWORD),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const samples: number[] = [];
  // Warm-up
  await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: SALT, iterations, hash: 'SHA-256' },
    passwordKey,
    256,
  );
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: SALT, iterations, hash: 'SHA-256' },
      passwordKey,
      256,
    );
    samples.push(performance.now() - t0);
  }
  return {
    name: `PBKDF2-SHA256 (${iterations.toLocaleString()} iter)`,
    meanMs: samples.reduce((s, x) => s + x, 0) / samples.length,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    notes: 'WebCrypto baseline — current production cost factor',
  };
};

const benchArgon2id = async (
  label: string,
  params: Argon2idParams,
  notes: string,
): Promise<BenchRow> => {
  const samples: number[] = [];
  // Warm-up — first call also pays the WASM instantiation cost
  // (~30 ms on a modern laptop), which we deliberately exclude.
  await deriveArgon2idBits(PASSWORD, SALT, params);
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    await deriveArgon2idBits(PASSWORD, SALT, params);
    samples.push(performance.now() - t0);
  }
  return {
    name: label,
    meanMs: samples.reduce((s, x) => s + x, 0) / samples.length,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    notes,
  };
};

const renderMarkdownTable = (rows: BenchRow[]): string => {
  const head = '| Configuration | Mean | Min | Max | Notes |';
  const sep = '| --- | ---: | ---: | ---: | --- |';
  const body = rows
    .map(
      (r) =>
        `| ${r.name} | ${formatMs(r.meanMs)} | ${formatMs(r.minMs)} | ${formatMs(r.maxMs)} | ${r.notes} |`,
    )
    .join('\n');
  return [head, sep, body].join('\n');
};

const main = async () => {
  // Prefer no-op output by default; if --json is passed, emit
  // machine-readable JSON instead.
  const wantJson = process.argv.includes('--json');

  process.stdout.write(`# Argon2id vs PBKDF2 — n=${RUNS} runs (warm-up discarded)\n\n`);

  const rows: BenchRow[] = [];

  rows.push(await benchPbkdf2(PBKDF2_ITERATIONS));
  rows.push(
    await benchArgon2id(
      `Argon2id OWASP_MIN (19 MiB / 2t / 1p)`,
      ARGON2_OWASP_MIN,
      'OWASP 2024+ minimum acceptable for password storage',
    ),
  );
  rows.push(
    await benchArgon2id(
      `Argon2id OWASP_REC (64 MiB / 3t / 1p)`,
      ARGON2_OWASP_RECOMMENDED,
      'Recommended for high-value secrets — VECTOR target',
    ),
  );
  rows.push(
    await benchArgon2id(
      `Argon2id STRICT (128 MiB / 3t / 1p)`,
      ARGON2_STRICT,
      'Paranoid bracket — too slow for low-spec mobile UX',
    ),
  );

  if (wantJson) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
  } else {
    process.stdout.write(renderMarkdownTable(rows) + '\n');
  }
};

main().catch((err) => {
  process.stderr.write(`bench failed: ${(err as Error).stack || (err as Error).message}\n`);
  process.exit(1);
});
