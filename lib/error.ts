import * as Sentry from '@sentry/react';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static fromError(err: unknown): AppError {
    if (err instanceof AppError) return err;
    const message = err instanceof Error ? err.message : '未知系统故障';
    return new AppError(ErrorCode.UNKNOWN_ERROR, scrubMessage(message));
  }
}

const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|api|access|secret|bearer)[\s_:=-]+[A-Za-z0-9._\-+/=]{12,}/gi,
  /Bearer\s+[A-Za-z0-9._\-+/=]{12,}/gi,
  /\b[A-Za-z0-9+/=]{120,}\b/g, // long base64-ish blobs (likely encrypted payloads)
];

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'masterpassword',
  'master_password',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'authheader',
  'auth',
  'prompt',
  'recoverykey',
  'recovery_key',
  'pwdhash',
  'pwd_hash',
  'pwdsalt',
  'pwd_salt',
  'pwd',
]);

const scrubMessage = (message: string): string => {
  let next = message;
  for (const pattern of SENSITIVE_KEY_PATTERNS) {
    next = next.replace(pattern, '[REDACTED]');
  }
  return next;
};

const scrubValue = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubMessage(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubValue(item, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = scrubValue(val, depth + 1);
      }
    }
    return result;
  }
  return undefined;
};

const isSentryActive = (): boolean => {
  try {
    return Boolean(Sentry.getClient?.());
  } catch {
    return false;
  }
};

/**
 * Log errors to console (in non-production) and forward to Sentry when an
 * SDK client has been initialised. Sensitive substrings are scrubbed before
 * leaving the process so we never ship secrets, prompts or encrypted blobs.
 */
export const reportError = (
  error: Error | AppError,
  context?: string,
  extra?: Record<string, unknown>,
) => {
  const safeMessage = scrubMessage(error.message || 'unknown');
  const safeExtra = extra ? (scrubValue(extra) as Record<string, unknown>) : undefined;

  if (process.env.NODE_ENV !== 'production') {
    if (safeExtra) {
      console.error(`[${context || 'GLOBAL'}]`, safeMessage, safeExtra);
    } else {
      console.error(`[${context || 'GLOBAL'}]`, safeMessage);
    }
  }

  if (!isSentryActive()) return;
  try {
    Sentry.withScope((scope) => {
      if (context) scope.setTag('context', context);
      if (safeExtra) {
        for (const [key, value] of Object.entries(safeExtra)) {
          scope.setExtra(key, value);
        }
      }
      const sanitized =
        error instanceof AppError
          ? new AppError(error.code, safeMessage)
          : Object.assign(new Error(safeMessage), { name: error.name });
      Sentry.captureException(sanitized);
    });
  } catch {
    // Reporting failures must never crash the app.
  }
};
