import { expect, test } from '@playwright/test';

/**
 * Backend-only end-to-end checks for the AI proxy. They exercise the
 * combined origin + token gate plus the rate limiter, so a regression in
 * `server/aiProxyAuth.ts` or in the route wiring shows up immediately.
 *
 * The tests do not depend on a real OpenRouter key being present; the
 * placeholder key in `.env.local` is enough to make the proxy attempt the
 * upstream call and surface either a 502 (proxy reached the handler) or a
 * 401/403/429 (handler short-circuited).
 *
 * Serial mode keeps the in-memory rate limiter deterministic across test
 * cases: parallel calls to /api/morning-star would compete for the same
 * 5/min bucket and produce flaky 429s.
 */
test.describe.configure({ mode: 'serial' });

const PROMPT_BODY = JSON.stringify({ prompt: 'hi' });

test('rejects browser requests from a foreign origin with 403', async ({ request, baseURL }) => {
  const response = await request.post('/api/morning-star', {
    data: PROMPT_BODY,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://evil.example',
    },
  });
  expect(response.status()).toBe(403);
  expect(baseURL).toBeTruthy();
});

test('lets same-origin browser requests through to the upstream handler', async ({
  request,
  baseURL,
}) => {
  expect(baseURL).toBeTruthy();
  const response = await request.post('/api/morning-star', {
    data: PROMPT_BODY,
    headers: {
      'Content-Type': 'application/json',
      Origin: baseURL!,
    },
  });
  // The auth gate must let the request through (so never 401/403). The
  // handler outcome depends on which secrets are present at run time:
  //   200      provider configured + upstream accepted (real AI key)
  //   502      provider configured + upstream rejected (placeholder key)
  //   503      no provider configured at all (.env.local cleaned up)
  // CI runs in the third state, local dev hits one of the first two.
  expect([200, 502, 503]).toContain(response.status());
  expect(response.headers()['x-request-id']).toBeTruthy();
});

test('rate-limits Morning Star bursts and exposes a request id', async ({ request, baseURL }) => {
  const targetOrigin = baseURL!;
  // Default limit is 5 / 60s; the 6th request must come back as 429.
  const responses = await Promise.all(
    Array.from({ length: 6 }).map(() =>
      request.post('/api/morning-star', {
        data: PROMPT_BODY,
        headers: {
          'Content-Type': 'application/json',
          Origin: targetOrigin,
        },
      }),
    ),
  );

  const statuses = responses.map((r) => r.status());
  expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);

  for (const r of responses) {
    expect(r.headers()['ratelimit-policy']).toBeTruthy();
  }
});
