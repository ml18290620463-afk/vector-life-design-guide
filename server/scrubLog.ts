/**
 * Shared scrubbing helpers used by both the structured JSON logger in
 * `server.ts` and the Sentry SDK initialised in `server/observability.ts`.
 *
 * Keeping a single source of truth prevents the two pipelines from
 * drifting (which would let a regex tweak in one place silently leak
 * tokens through the other).
 */

export const REDACT_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|api|access|secret|bearer)[\s_:=-]+[A-Za-z0-9._\-+/=]{12,}/gi,
  /Bearer\s+[A-Za-z0-9._\-+/=]{12,}/gi,
];

export const scrubLogText = (input: string): string => {
  let next = input;
  for (const pattern of REDACT_PATTERNS) {
    next = next.replace(pattern, '[REDACTED]');
  }
  return next;
};

export const formatLogError = (error: unknown): string => {
  if (error instanceof Error) {
    return scrubLogText(`${error.name}: ${error.message}`);
  }
  if (typeof error === 'string') return scrubLogText(error);
  try {
    return scrubLogText(JSON.stringify(error));
  } catch {
    return 'unserializable error';
  }
};
