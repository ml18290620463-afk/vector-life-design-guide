/**
 * Phase 4 §4.b-3 — IndexedDB shim for the test runner.
 *
 * The default `happy-dom` environment doesn't include an IndexedDB
 * implementation; without it, every `idb-keyval` call throws a
 * synchronous `ReferenceError: indexedDB is not defined` that
 * escapes Promise `.catch()` handlers (idb-keyval v6 dereferences
 * `indexedDB` synchronously).
 *
 * The pre-existing tests workaround was wrapping every `idb-keyval`
 * call in `try/catch`, which only protects READ paths. The new
 * device-keypair / trusted-devices / signature flows in Phase 4
 * §4.b-3 also need WRITE paths to actually succeed in tests, so
 * we install `fake-indexeddb` (memory-backed, IDB-spec-compliant)
 * once per test process. Auto-imported via `vitest.config.ts →
 * test.setupFiles`.
 *
 * fake-indexeddb is widely used (also by Jest, jsdom-based suites),
 * pure JS, no native deps, ~75 KB unpacked.
 */
import 'fake-indexeddb/auto';
