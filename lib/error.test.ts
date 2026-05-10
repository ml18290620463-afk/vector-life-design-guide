import { describe, expect, it } from 'vitest';
import { AppError, ErrorCode } from './error';

describe('AppError.fromError', () => {
  it('preserves AppError instances', () => {
    const original = new AppError(ErrorCode.SECURITY_ERROR, 'tampered');
    const wrapped = AppError.fromError(original);
    expect(wrapped).toBe(original);
  });

  it('scrubs likely API keys and bearer tokens from messages', () => {
    const wrapped = AppError.fromError(
      new Error('OpenRouter 401 sk-or-v1-abcdefghijklmnopqrstuvwx and Bearer abcdefghijklmnopqrst'),
    );
    expect(wrapped.message).not.toContain('sk-or-v1-abcdefghijklmnopqrstuvwx');
    expect(wrapped.message).not.toContain('Bearer abcdefghijklmnopqrst');
    expect(wrapped.message).toContain('[REDACTED]');
  });

  it('scrubs long base64-like blobs that may contain encrypted data', () => {
    const blob = 'A'.repeat(140);
    const wrapped = AppError.fromError(new Error(`payload=${blob}`));
    expect(wrapped.message).not.toContain(blob);
    expect(wrapped.message).toContain('[REDACTED]');
  });

  it('falls back to a generic message for non-Error values', () => {
    const wrapped = AppError.fromError(undefined);
    expect(wrapped.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(wrapped.message.length).toBeGreaterThan(0);
  });
});
