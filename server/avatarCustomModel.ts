import { availableAvatarModelProxy, rememberAvatarModelProxy } from './avatarModelProxy';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import type { AvatarModelConfig } from '../features/now/api/avatarModel';

export function validateModelConfig(value: unknown): AvatarModelConfig {
  const c = value as AvatarModelConfig;
  if (
    !c ||
    !['baseUrl', 'apiKey', 'model'].every(
      (k) => typeof c[k] === 'string' && c[k].trim() && c[k].length <= 2048,
    )
  )
    throw new Error('invalid_model_config');
  let url: URL;
  try {
    url = new URL(c.baseUrl);
  } catch {
    throw new Error('invalid_model_config');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443') ||
    isIP(url.hostname) ||
    !url.hostname.includes('.') ||
    /[\r\n]/.test(c.apiKey)
  )
    throw new Error('invalid_model_config');
  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    apiKey: c.apiKey.trim(),
    model: c.model.trim(),
    endpoint: c.endpoint === 'responses' ? 'responses' : 'chat',
  };
}
// Resolve and pin a public IPv4 address: a custom endpoint must never reach local services.
export function isPublicAddress(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export function classifyUpstreamError(statusCode = 0, body = '') {
  const text = body.toLowerCase();
  if (statusCode === 407) return 'model_proxy_auth_required';
  if (/billing|billable|payment required|enable billing|billing account/.test(text))
    return 'model_billing_required';
  if (statusCode === 429 || /rate limit|quota|insufficient_quota|too many requests/.test(text))
    return 'model_rate_limited';
  if (statusCode === 403 || /permission denied|permission.*not.*granted|access denied/.test(text))
    return 'model_permission_denied';
  if (
    statusCode === 401 ||
    /invalid[_ -]?api[_ -]?key|incorrect api key|unauthorized|authentication|api key/.test(text)
  )
    return 'model_auth_failed';
  if (
    /model[^\n]{0,160}(not found|does not exist|no longer available|retired|decommissioned|不存在|未找到)|not found[^\n]{0,80}model|unsupported model|invalid model|model_not_found|model_not_exist/.test(
      text,
    )
  )
    return 'model_not_found';
  if (statusCode === 404) return 'model_endpoint_not_found';
  if (statusCode >= 500) return 'model_upstream_unavailable';
  return 'model_unavailable';
}

export class ModelUpstreamError extends Error {
  constructor(
    public status: number,
    body: string,
    apiKey: string,
  ) {
    super(classifyUpstreamError(status, body));
    try {
      const parsed = JSON.parse(body);
      const message = (Array.isArray(parsed) ? parsed[0] : parsed)?.error?.message;
      if (typeof message === 'string') {
        this.detail = message
          .split(apiKey)
          .join('[REDACTED]')
          .replace(/https?:\/\/\S+/g, '[URL]')
          .replace(/\b(?:AIza|sk-)[\w-]+/g, '[REDACTED]')
          .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
          .replace(/[\r\n\t]+/g, ' ')
          .slice(0, 600);
      }
    } catch {
      /* Do not expose HTML responses or arbitrary transport errors. */
    }
  }
  detail?: string;
}

export function modelErrorDiagnostic(error: unknown) {
  return error instanceof ModelUpstreamError
    ? { upstreamStatus: error.status, detail: error.detail }
    : {};
}

export async function callCustomModel(
  config: AvatarModelConfig,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  listModels = false,
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/chat\/completions$/, '').replace(/\/responses$/, '');
  const isGemini = /(^|\.)generativelanguage\.googleapis\.com$/i.test(new URL(baseUrl).hostname);
  const url = new URL(
    listModels
      ? isGemini
        ? 'https://generativelanguage.googleapis.com/v1beta/models'
        : `${baseUrl}/models`
      : config.endpoint === 'responses'
        ? `${baseUrl}/responses`
        : config.baseUrl.endsWith('/chat/completions')
          ? config.baseUrl
          : `${baseUrl}/chat/completions`,
  );
  // A local Clash proxy resolves provider domains itself. This avoids its
  // Fake-IP DNS records entering the direct-request SSRF guard below.
  const excluded = new Set<string>();
  // Only retry before TLS is established: no application request has been sent.
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    const proxyAgent = await availableAvatarModelProxy(url, excluded);
    const proxyUrl = proxyAgent?.proxy.href;
    let connected = false;
    const addresses = proxyAgent ? [] : await lookup(url.hostname, { all: true, family: 4 });
    if (!proxyAgent && (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))))
      throw new Error('model_network_blocked');
    signal.throwIfAborted();
    try {
      return await new Promise<string>((resolve, reject) => {
        const req = request(
          url,
          {
            method: listModels ? 'GET' : 'POST',
            signal,
            agent: proxyAgent || false,
            lookup: (_host, _options, callback) =>
              (_options as { all?: boolean }).all
                ? callback(null, [addresses[0]] as never)
                : callback(null, addresses[0].address, 4),
            headers: {
              'Content-Type': 'application/json',
              // Gemini's native models endpoint uses an API key header.
              // A Bearer header here is interpreted as an OAuth access token.
              ...(isGemini && listModels
                ? { 'x-goog-api-key': config.apiKey }
                : { Authorization: `Bearer ${config.apiKey}` }),
            },
          },
          (res) => {
            clearTimeout(connectTimer);
            connected = true;
            // Even an authentication/quota response proves the route is reachable.
            rememberAvatarModelProxy(url, proxyUrl);
            let body = '';
            res.setEncoding('utf8');
            if (res.statusCode !== 200) {
              res.on('data', (chunk) => {
                body += chunk;
                if (body.length > 256 * 1024) req.destroy(new Error('model_unavailable'));
              });
              res.on('error', reject);
              res.on('end', () =>
                reject(new ModelUpstreamError(res.statusCode || 0, body, config.apiKey)),
              );
              return;
            }
            res.on('data', (chunk) => {
              body += chunk;
              if (body.length > (listModels ? 8 : 1) * 1024 * 1024)
                req.destroy(new Error('model_unavailable'));
            });
            res.on('error', reject);
            res.on('end', () => {
              try {
                if (listModels) {
                  const parsed = JSON.parse(body);
                  const data = isGemini ? parsed.models : parsed.data;
                  if (!Array.isArray(data)) throw new Error('model_response_invalid');
                  resolve(
                    JSON.stringify(
                      [
                        ...new Set(
                          data
                            .map((m) => (isGemini ? m?.name?.replace(/^models\//, '') : m?.id))
                            .filter((id) => typeof id === 'string' && id.length <= 256),
                        ),
                      ].slice(0, 2000),
                    ),
                  );
                  return;
                }
                const data = JSON.parse(body);
                const text =
                  config.endpoint === 'responses'
                    ? readResponsesText(data)
                    : data.choices?.[0]?.message?.content;
                if (typeof text !== 'string' || !text.trim())
                  throw new Error('model_response_invalid');
                resolve(text.trim());
              } catch (error) {
                reject(error instanceof Error ? error : new Error('model_response_invalid'));
              }
            });
          },
        );
        const connectTimer = setTimeout(() => {
          req.destroy(Object.assign(new Error('model_timeout'), { code: 'ETIMEDOUT' }));
        }, 4000);
        req.on('socket', (socket) => {
          socket.once('secureConnect', () => {
            connected = true;
            clearTimeout(connectTimer);
            rememberAvatarModelProxy(url, proxyUrl);
          });
        });
        req.on('close', () => clearTimeout(connectTimer));
        req.on('error', (error) => {
          clearTimeout(connectTimer);
          reject(error);
        });
        req.end(listModels ? undefined : JSON.stringify(modelRequestBody(config, messages)));
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (
        connected ||
        signal.aborted ||
        attempt >= 2 ||
        ![
          'ECONNREFUSED',
          'ECONNRESET',
          'ETIMEDOUT',
          'ENETUNREACH',
          'EHOSTUNREACH',
          'EPIPE',
          'EAI_AGAIN',
          'ENOTFOUND',
        ].includes(code || '')
      ) {
        if (proxyUrl && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(code || ''))
          throw new Error('model_proxy_unreachable');
        if (['ENOTFOUND', 'EAI_AGAIN'].includes(code || '')) throw new Error('model_dns_failed');
        if (
          ['EPROTO', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code || '')
        )
          throw new Error('model_tls_failed');
        throw error;
      }
      rememberAvatarModelProxy(url, undefined);
      if (proxyUrl) excluded.add(proxyUrl);
      else throw error;
    } finally {
      proxyAgent?.destroy();
    }
  }
}

function modelRequestBody(
  config: AvatarModelConfig,
  messages: { role: string; content: string }[],
) {
  if (config.endpoint === 'responses') {
    return {
      model: config.model,
      input: messages.map((message) => ({
        role: message.role === 'assistant' || message.role === 'system' ? message.role : 'user',
        content: message.content,
      })),
      stream: false,
    };
  }
  return { model: config.model, messages, stream: false };
}

function readResponsesText(data: unknown) {
  const response = data as {
    output_text?: unknown;
    output?: { content?: { text?: unknown; type?: unknown }[] }[];
  };
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks =
    response.output
      ?.flatMap((item) => item.content || [])
      .map((content) =>
        typeof content.text === 'string' &&
        (content.type === undefined || content.type === 'output_text')
          ? content.text
          : '',
      )
      .filter(Boolean) || [];
  return chunks.join('\n');
}
export function safeModelError(error: unknown, aborted: boolean) {
  if (aborted) return 'model_timeout';
  const networkCode = (error as { code?: string } | null)?.code;
  if (networkCode === 'ETIMEDOUT' || networkCode === 'ESOCKETTIMEDOUT') return 'model_timeout';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(networkCode || '')) return 'model_dns_failed';
  if (
    [
      'ECONNRESET',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'EPIPE',
    ].includes(networkCode || '')
  )
    return 'model_network_failed';
  if (
    ['EPROTO', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(networkCode || '')
  )
    return 'model_tls_failed';
  const code = error instanceof Error ? error.message : '';
  return [
    'invalid_model_config',
    'model_network_blocked',
    'model_network_failed',
    'model_dns_failed',
    'model_proxy_unreachable',
    'model_proxy_auth_required',
    'model_tls_failed',
    'model_proxy_config_invalid',
    'model_auth_failed',
    'model_permission_denied',
    'model_rate_limited',
    'model_billing_required',
    'model_not_found',
    'model_endpoint_not_found',
    'model_response_invalid',
    'model_upstream_unavailable',
  ].includes(code)
    ? code
    : 'model_unavailable';
}
