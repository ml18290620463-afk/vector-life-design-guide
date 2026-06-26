#!/usr/bin/env node
/**
 * Phase 5.2 — `scripts/billing-smoke-bootstrap.mjs`
 *
 * One-shot helper that bootstraps the local Stripe smoke test
 * (see `docs/billing-smoke-test.md`). It does NOT run Stripe
 * itself; it prepares the artefacts the operator needs:
 *
 *   1. Generates a fresh master Ed25519 keypair, prints the
 *      base64 secret + the JS literal for the public bytes.
 *   2. Prints a `.env.local` template the operator can fill in.
 *   3. Reminds the operator of the next manual steps (create
 *      SKUs in Stripe dashboard, run `stripe listen`).
 *
 * Usage:
 *
 *     node scripts/billing-smoke-bootstrap.mjs
 *
 * # Why a script vs the doc
 *
 * The doc tells you what to type; this script saves you 10
 * lines of manual node REPL invocations + JSON munging. Both
 * exist because the script can't make the manual Stripe
 * dashboard calls for you.
 */
import { argv, exit } from 'node:process';
import { writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

const concat = (...arrays) => {
  let total = 0;
  for (const arr of arrays) total += arr.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
};
ed.hashes.sha512Async = (...messages) => Promise.resolve(sha512(concat(...messages)));
ed.hashes.sha512 = (...messages) => sha512(concat(...messages));

const writeEnv = argv.includes('--write-env');

const main = async () => {
  /* ----- 1. Mint keypair ----- */
  const sk = ed.utils.randomSecretKey();
  const pk = await ed.getPublicKeyAsync(sk);
  const skBase64 = Buffer.from(sk).toString('base64');
  const pkArrayLiteral = '[' + Array.from(pk).join(', ') + ']';

  // eslint-disable-next-line no-console
  console.log('\n=== Phase 5.2 Stripe smoke-test bootstrap ===\n');

  // eslint-disable-next-line no-console
  console.log('1) Master Ed25519 keypair (fresh, do NOT reuse):');
  // eslint-disable-next-line no-console
  console.log('   SECRET (base64): ' + skBase64);
  // eslint-disable-next-line no-console
  console.log('   PUBLIC bytes  : ' + pkArrayLiteral);
  // eslint-disable-next-line no-console
  console.log('\n   → Paste SECRET into .env.local under VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64');
  // eslint-disable-next-line no-console
  console.log(
    '   → Paste PUBLIC bytes into lib/licenseKeyring.ts:\n     PRODUCTION_PUBLIC_KEY_BYTES = new Uint8Array(' +
      pkArrayLiteral +
      ')',
  );

  /* ----- 2. .env.local template ----- */
  const envTemplate = [
    '# Phase 5.2 Stripe smoke-test env vars (test mode).',
    '# Do NOT commit this file (it should already be in .gitignore via the .env glob).',
    '',
    '# --- Stripe (test mode) ---',
    'STRIPE_SECRET_KEY=sk_test_REPLACE_ME',
    'STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME_AFTER_running_stripe_listen',
    '',
    '# --- License signing ---',
    `VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64=${skBase64}`,
    'VECTOR_LICENSE_MASTER_KID=vector-master-2026',
    '',
    '# --- Public origin (Stripe success/cancel URLs) ---',
    'VECTOR_PUBLIC_ORIGIN=http://localhost:3000',
    '',
    '# --- Per-SKU price ids from your Stripe test-mode dashboard ---',
    'VECTOR_STRIPE_PRICE_STARDUST_MONTHLY=price_REPLACE_ME',
    'VECTOR_STRIPE_PRICE_STARDUST_ANNUAL=price_REPLACE_ME',
    'VECTOR_STRIPE_PRICE_POLARIS_MONTHLY=price_REPLACE_ME',
    'VECTOR_STRIPE_PRICE_POLARIS_ANNUAL=price_REPLACE_ME',
    'VECTOR_STRIPE_PRICE_OWNER_LIFETIME=price_REPLACE_ME',
    '',
  ].join('\n');

  if (writeEnv) {
    const target = '.env.local';
    let exists = false;
    try {
      await access(target, constants.F_OK);
      exists = true;
    } catch {
      // doesn't exist yet, good
    }
    if (exists) {
      // eslint-disable-next-line no-console
      console.error(
        `\nERROR: ${target} already exists; refusing to overwrite. Delete it first if you want a fresh template.`,
      );
      exit(2);
    }
    await writeFile(target, envTemplate, { encoding: 'utf8', mode: 0o600 });
    // eslint-disable-next-line no-console
    console.log(`\n2) Wrote .env.local template (chmod 600) — fill in the REPLACE_ME values.`);
  } else {
    // eslint-disable-next-line no-console
    console.log('\n2) .env.local template (re-run with --write-env to write it for you):\n');
    // eslint-disable-next-line no-console
    console.log(envTemplate);
  }

  /* ----- 3. Next steps ----- */
  // eslint-disable-next-line no-console
  console.log(
    [
      '\n3) Next manual steps (see docs/billing-smoke-test.md for the full walkthrough):',
      '',
      '   a. Create the 5 SKUs in https://dashboard.stripe.com/test/products',
      '      (Stardust monthly $4.99, Stardust annual $49.90, Polaris monthly $9.99,',
      '       Polaris annual $99.90, Owner lifetime $199.00).',
      '',
      '   b. Copy each price_xxx into .env.local under the matching VECTOR_STRIPE_PRICE_* var.',
      '',
      '   c. In a dedicated terminal, start the Stripe CLI webhook forwarder:',
      '        stripe listen --forward-to localhost:3000/api/stripe/webhook',
      '      Copy the printed whsec_… value into .env.local under STRIPE_WEBHOOK_SECRET.',
      '',
      '   d. Update lib/licenseKeyring.ts: replace the PRODUCTION_PUBLIC_KEY_BYTES = null',
      '      line with the PUBLIC bytes literal printed above. (Revert before committing.)',
      '',
      '   e. Start the dev server (must read .env.local — see your dotenv setup):',
      '        npm run build && npm start',
      '      Look for: [stripe] billing routes mounted (kid=vector-master-2026)',
      '',
      '   f. Open http://localhost:3000, set up a master password, then walk steps 6-10',
      '      of docs/billing-smoke-test.md.',
      '',
      '   g. After the smoke test:',
      '        rm .env.local',
      '        git checkout lib/licenseKeyring.ts',
      '',
    ].join('\n'),
  );
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  exit(1);
});
