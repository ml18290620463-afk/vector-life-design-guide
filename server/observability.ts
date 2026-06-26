import * as Sentry from '@sentry/node';
import type { ErrorRequestHandler, Request, Response } from 'express';
import { scrubLogText } from './scrubLog';

/**
 * Server-side observability glue for the Express AI proxy.
 *
 * Initialises `@sentry/node` only when `SENTRY_DSN` is set so local
 * development and self-hosted deployments without an account stay
 * completely silent. Reuses the same scrubbing rules as the request
 * logger (`server/scrubLog.ts`) so the two pipelines cannot drift.
 */

let initialised = false;

export const initServerObservability = (): boolean => {
  if (initialised) return true;
  const dsn = (process.env.SENTRY_DSN ?? '').trim();
  if (!dsn) return false;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    environment: process.env.NODE_ENV ?? 'production',
    beforeSend(event) {
      // Mirror the browser SDK: drop incoming request bodies and headers
      // entirely, then run the message + every exception value through the
      // shared scrubber.
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
        delete event.request.query_string;
      }
      if (event.message) event.message = scrubLogText(event.message);
      if (event.exception?.values) {
        for (const value of event.exception.values) {
          if (value?.value) value.value = scrubLogText(value.value);
        }
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb?.message) breadcrumb.message = scrubLogText(breadcrumb.message);
      return breadcrumb;
    },
  });

  initialised = true;
  return true;
};

/**
 * Attach the (optional) Sentry request handler. We do not wire the
 * tracing/profiling middleware because we are running classic CommonJS
 * Express and Sentry's express-integration assumes the new V2 API; the
 * minimal request-id-aware capture below is enough for our needs.
 */
export const captureServerError = (
  error: unknown,
  context?: { requestId?: string; provider?: string; mode?: string },
) => {
  if (!initialised) return;
  try {
    Sentry.withScope((scope) => {
      if (context?.requestId) scope.setTag('requestId', context.requestId);
      if (context?.provider) scope.setTag('provider', context.provider);
      if (context?.mode) scope.setTag('mode', context.mode);
      Sentry.captureException(error);
    });
  } catch {
    // Reporting failures must never crash the app.
  }
};

/**
 * Express error middleware. Falls through to the next handler when
 * Sentry is disabled so we don't change response semantics.
 */
export const sentryErrorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  captureServerError(err, {
    requestId:
      typeof res.getHeader === 'function' ? String(res.getHeader('x-request-id') ?? '') : undefined,
  });
  next(err);
};

/** Lightweight ping called from /api/health to confirm the SDK is alive. */
export const observabilityStatus = () => ({
  enabled: initialised,
});

// Suppress ts-unused warnings for Express types that may be tree-shaken in
// strict configs.
export type { Request, Response };
