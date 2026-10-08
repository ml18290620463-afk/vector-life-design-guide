import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { connect } from 'node:net';
import { avatarModelProxy, parseSystemProxy, rememberAvatarModelProxy } from './avatarModelProxy';
import { callCustomModel } from './avatarCustomModel';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const execFile = vi.fn((_file, _args, _options, callback) => callback(null, ''));
  return { ...actual, execFile, default: { ...actual, execFile } };
});

vi.mock('node:dns/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns/promises')>();
  const lookup = vi.fn();
  return { ...actual, lookup, default: { ...actual, lookup } };
});
vi.mock('node:https', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:https')>();
  const request = vi.fn();
  return { ...actual, request, default: { ...actual, request } };
});
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>();
  const connect = vi.fn();
  return { ...actual, connect, default: { ...actual, connect } };
});
beforeEach(() => {
  for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) vi.stubEnv(key, '');
});
afterEach(() => {
  rememberAvatarModelProxy(new URL(config.baseUrl), undefined);
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const config = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  apiKey: 'test-only-key',
  model: 'gemini-2.5-flash',
  endpoint: 'chat' as const,
};

it('limits proxy DNS resolution to exact official HTTPS hosts', () => {
  const proxy = 'http://127.0.0.1:7980';
  const agent = avatarModelProxy(new URL(config.baseUrl), proxy);
  expect(agent?.proxy.port).toBe('7980');
  agent?.destroy();
  for (const target of [
    'https://custom.example/v1',
    'https://generativelanguage.googleapis.com.evil.test',
    'https://127.0.0.1',
  ])
    expect(avatarModelProxy(new URL(target), proxy)).toBeUndefined();
  expect(() =>
    avatarModelProxy(new URL('http://generativelanguage.googleapis.com'), proxy),
  ).toThrow('invalid_model_config');
  expect(() => avatarModelProxy(new URL(config.baseUrl), 'socks5://localhost:7980')).toThrow(
    'model_proxy_config_invalid',
  );
  expect(avatarModelProxy(new URL(config.baseUrl), '')).toBeUndefined();
});

it('sends official requests through the proxy without consulting Fake-IP DNS', async () => {
  vi.stubEnv('VECTOR_MODEL_PROXY_URL', 'http://127.0.0.1:7980');
  vi.mocked(lookup).mockResolvedValue([{ address: '198.18.0.1', family: 4 }] as never);
  const req = new EventEmitter() as EventEmitter & { end: ReturnType<typeof vi.fn> };
  req.end = vi.fn(() => {
    const callback = vi.mocked(request).mock.calls[0][2] as (res: unknown) => void;
    const res = Object.assign(new EventEmitter(), { statusCode: 200, setEncoding: vi.fn() });
    callback(res);
    res.emit('data', JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
    res.emit('end');
  });
  vi.mocked(request).mockReturnValue(req as never);
  expect(
    await callCustomModel(
      config,
      [{ role: 'user', content: 'Hello' }],
      new AbortController().signal,
    ),
  ).toBe('OK');
  expect(lookup).not.toHaveBeenCalled();
  expect(vi.mocked(request).mock.calls[0][0].toString()).toBe(config.baseUrl + '/chat/completions');
  expect(vi.mocked(request).mock.calls[0][1]).toEqual(
    expect.objectContaining({ agent: expect.objectContaining({ proxy: expect.any(URL) }) }),
  );
  expect(JSON.parse(req.end.mock.calls[0][0]).model).toBe('gemini-2.5-flash');
});

it('still blocks Fake-IP for custom endpoints and direct official connections', async () => {
  vi.stubEnv('VECTOR_MODEL_PROXY_URL', 'http://127.0.0.1:7980');
  vi.mocked(lookup).mockResolvedValue([{ address: '198.18.0.1', family: 4 }] as never);
  await expect(
    callCustomModel(
      { ...config, baseUrl: 'https://custom.example/v1' },
      [],
      new AbortController().signal,
    ),
  ).rejects.toThrow('model_network_blocked');
  vi.stubEnv('VECTOR_MODEL_PROXY_URL', '');
  vi.mocked(connect).mockImplementation(() => {
    const socket = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    queueMicrotask(() => socket.emit('error', new Error('offline')));
    return socket as never;
  });
  await expect(callCustomModel(config, [], new AbortController().signal)).rejects.toThrow(
    'model_network_blocked',
  );
  expect(request).not.toHaveBeenCalled();
});

it('reads enabled local system proxy ports and ignores disabled or remote proxies', () => {
  expect(parseSystemProxy('  HTTPSEnable : 1\n  HTTPSProxy : 127.0.0.1\n  HTTPSPort : 7980')).toBe(
    'http://127.0.0.1:7980/',
  );
  expect(
    parseSystemProxy('  HTTPSEnable : 0\n  HTTPSProxy : 127.0.0.1\n  HTTPSPort : 7980'),
  ).toBeUndefined();
  expect(
    parseSystemProxy('  HTTPSEnable : 1\n  HTTPSProxy : remote.example\n  HTTPSPort : 7980'),
  ).toBeUndefined();
  expect(
    parseSystemProxy('  HTTPEnable : 1\n  HTTPProxy : localhost\n  HTTPPort : 65536'),
  ).toBeUndefined();
});

function mockTransport(outcomes: ('offline' | 'sent' | 'auth' | 'ok')[]) {
  vi.mocked(connect).mockImplementation(() => {
    const socket = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    queueMicrotask(() => socket.emit('connect'));
    return socket as never;
  });
  vi.mocked(request).mockImplementation(((_url, _options, callback) => {
    const req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
    req.end.mockImplementation(() => {
      const outcome = outcomes.shift();
      if (outcome === 'sent') {
        const socket = new EventEmitter();
        req.emit('socket', socket);
        socket.emit('secureConnect');
      }
      if (outcome === 'offline' || outcome === 'sent') {
        req.emit('error', Object.assign(new Error('connection failed'), { code: 'ECONNRESET' }));
        return;
      }
      const res = Object.assign(new EventEmitter(), {
        statusCode: outcome === 'auth' ? 401 : 200,
        setEncoding: vi.fn(),
      });
      callback(res);
      res.emit('data', JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
      res.emit('end');
      req.emit('close');
    });
    return req;
  }) as never);
}

it('automatically replaces a failed route and reuses the working route', async () => {
  vi.stubEnv('VECTOR_MODEL_PROXY_URL', 'http://127.0.0.1:7980');
  mockTransport(['offline', 'ok', 'ok']);
  const signal = new AbortController().signal;
  expect(await callCustomModel(config, [], signal)).toBe('OK');
  expect(await callCustomModel(config, [], signal)).toBe('OK');
  const ports = vi
    .mocked(request)
    .mock.calls.map((call) => (call[1] as unknown as { agent: { proxy: URL } }).agent.proxy.port);
  expect(ports).toEqual(['7980', '7890', '7890']);
});

it.each(['sent', 'auth'] as const)(
  'does not retry after %s to avoid duplicate calls or futile auth retries',
  async (outcome) => {
    vi.stubEnv('VECTOR_MODEL_PROXY_URL', 'http://127.0.0.1:7980');
    mockTransport([outcome]);
    await expect(callCustomModel(config, [], new AbortController().signal)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  },
);

it('uses API-key authentication only for Gemini native model discovery', async () => {
  vi.stubEnv('VECTOR_MODEL_PROXY_URL', 'http://127.0.0.1:7980');
  mockTransport(['auth']);
  await expect(callCustomModel(config, [], new AbortController().signal, true)).rejects.toThrow(
    'model_auth_failed',
  );
  const options = vi.mocked(request).mock.calls[0][1];
  expect(options.headers).toEqual({
    'Content-Type': 'application/json',
    'x-goog-api-key': config.apiKey,
  });
  expect(vi.mocked(request).mock.calls[0][0].toString()).toBe(
    'https://generativelanguage.googleapis.com/v1beta/models',
  );
});

it('uses Bearer authentication only for the OpenAI-compatible chat endpoint', async () => {
  vi.stubEnv('VECTOR_MODEL_PROXY_URL', 'http://127.0.0.1:7980');
  mockTransport(['ok']);
  await callCustomModel(config, [], new AbortController().signal);
  expect(vi.mocked(request).mock.calls[0][1].headers).toEqual({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  });
});
