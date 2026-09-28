import { expect, it } from 'vitest';
import {
  classifyUpstreamError,
  ModelUpstreamError,
  modelErrorDiagnostic,
  isPublicAddress,
  validateModelConfig,
  safeModelError,
} from './avatarCustomModel';

it('keeps the selected model endpoint for latest model connections', () => {
  expect(
    validateModelConfig({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1',
      apiKey: 'key',
      endpoint: 'chat',
    }),
  ).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    apiKey: 'key',
    endpoint: 'chat',
  });
  expect(
    validateModelConfig({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'key',
      endpoint: 'unknown',
    }),
  ).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: 'key',
    endpoint: 'chat',
  });
});

it('rejects local and credential-bearing endpoints', () => {
  for (const baseUrl of [
    'http://api.example.com',
    'https://127.0.0.1',
    'https://localhost',
    'https://user:secret@api.example.com',
    'https://api.example.com?key=secret',
  ]) {
    expect(() => validateModelConfig({ baseUrl, model: 'model', apiKey: 'key' })).toThrow(
      'invalid_model_config',
    );
  }
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '172.16.0.1',
    '100.64.0.1',
    '::1',
  ])
    expect(isPublicAddress(ip)).toBe(false);
  expect(isPublicAddress('8.8.8.8')).toBe(true);
});

it('classifies upstream model errors from response bodies', () => {
  expect(
    classifyUpstreamError(
      400,
      JSON.stringify({ error: { message: 'The model `gpt-x` does not exist' } }),
    ),
  ).toBe('model_not_found');
  expect(
    classifyUpstreamError(400, JSON.stringify({ error: { message: 'Unsupported model' } })),
  ).toBe('model_not_found');
  expect(
    classifyUpstreamError(
      401,
      JSON.stringify({ error: { message: 'Incorrect API key provided' } }),
    ),
  ).toBe('model_auth_failed');
  expect(
    classifyUpstreamError(429, JSON.stringify({ error: { code: 'insufficient_quota' } })),
  ).toBe('model_rate_limited');
  expect(classifyUpstreamError(403, 'Please enable billing for this project')).toBe(
    'model_billing_required',
  );
  expect(classifyUpstreamError(403, 'Permission denied for this model')).toBe(
    'model_permission_denied',
  );
  expect(classifyUpstreamError(407, 'Proxy authentication required')).toBe(
    'model_proxy_auth_required',
  );
  expect(classifyUpstreamError(500, 'server failed')).toBe('model_upstream_unavailable');
});

it('keeps Fake-IP addresses blocked and preserves the network error for the UI', () => {
  expect(isPublicAddress('198.18.0.106')).toBe(false);
  expect(safeModelError(new Error('model_network_blocked'), false)).toBe('model_network_blocked');
});

it('distinguishes transport failures from provider rejection without exposing details', () => {
  for (const code of ['ENOTFOUND', 'EAI_AGAIN'])
    expect(safeModelError(Object.assign(new Error('private detail'), { code }), false)).toBe(
      'model_dns_failed',
    );
  for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH'])
    expect(safeModelError(Object.assign(new Error('private detail'), { code }), false)).toBe(
      'model_network_failed',
    );
  expect(
    safeModelError(
      Object.assign(new Error('private detail'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }),
      false,
    ),
  ).toBe('model_tls_failed');
  expect(safeModelError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), false)).toBe(
    'model_timeout',
  );
  expect(safeModelError(new Error('unknown'), false)).toBe('model_unavailable');
  expect(safeModelError(new Error('unknown'), true)).toBe('model_timeout');
  expect(safeModelError(new Error('model_response_invalid'), false)).toBe('model_response_invalid');
});

it('distinguishes an unknown route from an explicitly missing model and keeps quota errors', () => {
  expect(classifyUpstreamError(404, '<html>Not Found</html>')).toBe('model_endpoint_not_found');
  expect(classifyUpstreamError(404, '{"error":{"message":"models/example is not found"}}')).toBe(
    'model_not_found',
  );
  expect(classifyUpstreamError(429, 'API key quota exceeded')).toBe('model_rate_limited');
});
it('recognizes a retired Gemini model without blaming the API endpoint', () => {
  const message = 'This model models/example is no longer available to this account.';
  const error = new ModelUpstreamError(404, JSON.stringify({ error: { message } }), 'test-key');
  expect(error.message).toBe('model_not_found');
  expect(modelErrorDiagnostic(error)).toEqual({ upstreamStatus: 404, detail: message });
});

it('returns bounded provider diagnostics without credentials or raw HTML', () => {
  const error = new ModelUpstreamError(
    400,
    JSON.stringify([
      { error: { message: 'Invalid secret-key at https://example.test/?key=secret-key' } },
    ]),
    'secret-key',
  );
  expect(modelErrorDiagnostic(error)).toEqual({
    upstreamStatus: 400,
    detail: 'Invalid [REDACTED] at [URL]',
  });
  expect(modelErrorDiagnostic(new ModelUpstreamError(404, '<html>secret</html>', 'key'))).toEqual({
    upstreamStatus: 404,
  });
  expect(modelErrorDiagnostic(new Error('secret'))).toEqual({});
});
