import type { Express, RequestHandler, Response } from 'express';
import { randomUUID } from 'crypto';

import { containsInjection } from './promptEnvelope';
import {
  buildEchoChamberPrompt,
  isEchoChamberValidationFail,
  validateEchoChamberInput,
} from './echoChamberPrompt';
import { formatLogError } from './scrubLog';
import { captureServerError } from './observability';
import {
  callGemini,
  callOpenRouter,
  chooseProvider,
  type Provider,
  type ProviderConfig,
} from './aiProviders';

/**
 * Phase 4.5 §B (Echo Chamber) — `server/echoChamberRoutes.ts`
 *
 * Wires the `/api/echo-chamber` endpoint onto an existing Express
 * app. Sister to `server/memoirRoutes.ts`: uses the registrar
 * pattern (a small function instead of an Express Router) so the
 * handler can close over `providerConfig` + `env` resolved at
 * server startup without round-tripping them through
 * `req.app.locals`.
 *
 * The handler is buffered (no SSE in this first cut). The Echo
 * Chamber result is short enough (≤ 2000 tokens at 7 personas)
 * that the streaming UX gain doesn't justify the extra surface.
 * If user feedback says otherwise, swap the inner call to
 * `streamFromSecureBackend` and add an `onChunk` callback.
 */
export interface EchoChamberRouteDeps {
  morningStarLimiter: RequestHandler;
  requireAiProxyAuth: RequestHandler;
  providerConfig: ProviderConfig;
  env: { openrouterTimeoutMs: number };
}

const provideOrFail = (
  providerConfig: ProviderConfig,
  res: Response,
  requestId: string,
): Provider | null => {
  const provider = chooseProvider(providerConfig);
  if (!provider) {
    res.status(503).json({ error: 'AI backend is not configured', requestId });
    return null;
  }
  return provider;
};

/* ------------------------------------------------------------------ */
/*  Persona-prompt + recall validators (lightweight)                   */
/* ------------------------------------------------------------------ */

/** Strict guard for the optional `customPersonaPrompts` map: it must
 *  be a plain object whose values are strings. Anything else gets
 *  silently dropped (defensive — the map is informational, not
 *  required for the round to function). */
const validateCustomPersonaPrompts = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v.slice(0, 4000);
  }
  return out;
};

/** Strict guard for the optional `memoirRecallByPersona` map: every
 *  value must be an array of `{ body: string }`. Same defensive
 *  silent-drop semantics. */
const validateRecallMap = (raw: unknown): Record<string, ReadonlyArray<{ body: string }>> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, ReadonlyArray<{ body: string }>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const bodies: { body: string }[] = [];
    for (const item of v) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { body?: unknown }).body === 'string'
      ) {
        bodies.push({ body: (item as { body: string }).body.slice(0, 240) });
      }
    }
    if (bodies.length > 0) out[k] = bodies;
  }
  return out;
};

export const registerEchoChamberRoutes = (
  app: Express,
  { morningStarLimiter, requireAiProxyAuth, providerConfig, env }: EchoChamberRouteDeps,
): void => {
  app.post('/api/echo-chamber', morningStarLimiter, requireAiProxyAuth, async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const provider = provideOrFail(providerConfig, res, requestId);
    if (!provider) return;

    const validation = validateEchoChamberInput(req.body);
    if (isEchoChamberValidationFail(validation)) {
      res
        .status(400)
        .json({ error: 'Invalid echo chamber input', requestId, detail: validation.reason });
      return;
    }
    const { query, personaNames } = validation;

    // Injection-guard: the user's query is the freshest LLM input
    // and the most likely vector for "ignore previous instructions".
    if (containsInjection(query)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'echo_chamber_rejected_injection',
          requestId,
          provider,
          queryBytes: query.length,
        }),
      );
      res
        .status(400)
        .json({ error: 'Query rejected by safety guard', requestId, code: 'INJECTION' });
      return;
    }

    const customPersonaPrompts = validateCustomPersonaPrompts(req.body?.customPersonaPrompts);
    const memoirRecallByPersona = validateRecallMap(req.body?.memoirRecallByPersona);

    const { prompt } = buildEchoChamberPrompt({
      query,
      personaNames,
      customPersonaPrompts,
      memoirRecallByPersona,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.openrouterTimeoutMs);
    const startedAt = Date.now();

    try {
      const text =
        provider === 'openrouter'
          ? await callOpenRouter(prompt, providerConfig, controller.signal)
          : await callGemini(prompt, providerConfig, controller.signal);
      if (!text || text.trim().length === 0) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'echo_chamber_empty_response',
            requestId,
            provider,
            durationMs: Date.now() - startedAt,
          }),
        );
        res.status(502).json({
          error: 'Empty response from AI backend',
          requestId,
          code: 'EMPTY',
        });
        return;
      }
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'echo_chamber_success',
          requestId,
          provider,
          durationMs: Date.now() - startedAt,
          personaCount: personaNames.length,
          markdownLength: text.length,
        }),
      );
      res.json({ markdown: text, provider, requestId });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'echo_chamber_failed',
          requestId,
          provider,
          durationMs: Date.now() - startedAt,
          error: formatLogError(error),
        }),
      );
      captureServerError(error, { requestId, provider, mode: 'echo-chamber' });
      res.status(502).json({ error: 'Failed to fetch from secure backend', requestId });
    } finally {
      clearTimeout(timeout);
    }
  });
};
