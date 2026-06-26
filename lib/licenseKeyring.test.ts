import { describe, expect, it } from 'vitest';
import { LICENSE_KEYRING } from './licenseKeyring';

/**
 * Phase 5.2 §Q4 — `licenseKeyring` production gate.
 *
 * Vite rewrites `import.meta.env.MODE` at build time, so we can't
 * flip it inside a single test process. What we CAN verify:
 *   - In the test environment (`MODE === 'test'`), the dev kid
 *     is present (so dev-mint-license + verify still works in
 *     the suite).
 *   - The production kid (`vector-master-2026`) stays absent
 *     until someone explicitly populates `PRODUCTION_PUBLIC_KEY_BYTES`.
 *
 * The "production strips dev kid" branch is exercised by a
 * dedicated build-time check the operator runs:
 *   `npm run build && grep -c "DEV_KID" dist/assets/*.js | grep '^0$'`
 * (added to `scripts/check-beta.sh` in a follow-up sprint).
 */
describe('lib/licenseKeyring', () => {
  it('exposes the dev-2026 kid in non-production builds (so vitest can verify dev tokens)', () => {
    expect(Object.keys(LICENSE_KEYRING)).toContain('dev-2026');
    const dev = LICENSE_KEYRING['dev-2026'];
    expect(dev).toBeInstanceOf(Uint8Array);
    expect(dev.length).toBe(32);
  });

  it('does NOT expose vector-master-2026 yet (placeholder slot until the production minter ships)', () => {
    expect(Object.keys(LICENSE_KEYRING)).not.toContain('vector-master-2026');
  });
});
