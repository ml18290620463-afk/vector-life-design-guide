import { HttpsProxyAgent } from 'https-proxy-agent';
import { connect } from 'node:net';
import { execFile } from 'node:child_process';

// Only trusted local proxies and fixed provider hosts may bypass local DNS.
// Arbitrary user endpoints still use the public-IP validation and pinning path.
const providerHosts = new Set([
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.deepseek.com',
  'openrouter.ai',
]);

const localProxyPorts = ['7890', '7897', '7891', '7980'];

function configuredProxyUrl() {
  // VECTOR_MODEL_PROXY_URL is the explicit deployment setting. The standard
  // variables make a locally running Clash work without a second app setting.
  // Ignore a corporate/CI proxy here: the model connector only trusts a local
  // proxy and an explicit invalid VECTOR setting should still surface clearly.
  if (process.env.VECTOR_MODEL_PROXY_URL?.trim()) return process.env.VECTOR_MODEL_PROXY_URL;
  for (const value of [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
  ]) {
    if (!value?.trim()) continue;
    try {
      if (isLoopbackProxy(new URL(value.trim()))) return value;
    } catch {
      // Standard environment variables are optional compatibility hints.
    }
  }
  return undefined;
}

function isLoopbackProxy(proxy: URL) {
  return ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(proxy.hostname.toLowerCase());
}

function parseLocalProxy(proxyUrl: string) {
  let proxy: URL;
  try {
    proxy = new URL(proxyUrl.trim());
  } catch {
    throw new Error('model_proxy_config_invalid');
  }
  if (
    !['http:', 'https:'].includes(proxy.protocol) ||
    !isLoopbackProxy(proxy) ||
    proxy.search ||
    proxy.hash ||
    proxy.pathname !== '/'
  )
    throw new Error('model_proxy_config_invalid');
  return proxy;
}

export function avatarModelProxy(target: URL, proxyUrl = configuredProxyUrl()) {
  if (!proxyUrl?.trim() || !providerHosts.has(target.hostname)) return undefined;
  if (target.protocol !== 'https:' || (target.port && target.port !== '443'))
    throw new Error('invalid_model_config');
  return new HttpsProxyAgent(parseLocalProxy(proxyUrl));
}

// Read the OS preference instead of requiring users to know their proxy port.
export function parseSystemProxy(output: string): string | undefined {
  for (const kind of ['HTTPS', 'HTTP']) {
    const field = (name: string) =>
      output.match(new RegExp(`^\\s*${kind}${name}\\s*:\\s*(\\S+)`, 'm'))?.[1];
    const host = field('Proxy');
    const port = field('Port');
    if (
      field('Enable') !== '1' ||
      !host ||
      !port ||
      !/^\d+$/.test(port) ||
      Number(port) < 1 ||
      Number(port) > 65535
    )
      continue;
    try {
      const url = new URL(
        `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`,
      );
      if (isLoopbackProxy(url)) return url.href;
    } catch {
      /* Ignore unsupported OS preferences. */
    }
  }
  return undefined;
}

let systemProxyCache: { until: number; value: Promise<string | undefined> } | undefined;
function systemProxyUrl() {
  if (process.platform !== 'darwin') return Promise.resolve(undefined);
  if (systemProxyCache && systemProxyCache.until > Date.now()) return systemProxyCache.value;
  const value = new Promise<string | undefined>((resolve) => {
    execFile(
      '/usr/sbin/scutil',
      ['--proxy'],
      { timeout: 1500, maxBuffer: 64 * 1024 },
      (error, stdout) => resolve(error ? undefined : parseSystemProxy(stdout)),
    );
  });
  systemProxyCache = { until: Date.now() + 15000, value };
  return value;
}

function canReach(proxy: URL) {
  return new Promise<boolean>((resolve) => {
    const socket = connect({
      host: proxy.hostname.replace(/^\[|\]$/g, ''),
      port: Number(proxy.port || (proxy.protocol === 'https:' ? 443 : 80)),
    });
    const timer = setTimeout(() => socket.destroy(), 180);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    socket.once('close', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Finds a running local Clash-compatible HTTP proxy when no explicit proxy is
 * configured. This keeps Fake-IP DNS inside Clash instead of exposing DNS
 * instructions in the product UI.
 */
const workingProxy = new Map<string, string>();

export function rememberAvatarModelProxy(target: URL, proxy: string | undefined) {
  if (proxy) workingProxy.set(target.hostname, proxy);
  else workingProxy.delete(target.hostname);
}

export async function availableAvatarModelProxy(target: URL, excluded = new Set<string>()) {
  if (!providerHosts.has(target.hostname)) return undefined;
  const configured = configuredProxyUrl();
  // Validate explicit deployment configuration even when a cached route exists.
  if (configured?.trim()) parseLocalProxy(configured);
  const cached = workingProxy.get(target.hostname);
  if (cached && !excluded.has(cached)) return avatarModelProxy(target, cached);
  if (configured?.trim()) {
    const candidate = parseLocalProxy(configured).href;
    if (!excluded.has(candidate)) return avatarModelProxy(target, candidate);
  }
  const systemProxy = await systemProxyUrl();
  if (systemProxy && !excluded.has(systemProxy)) return avatarModelProxy(target, systemProxy);
  // Probe ports concurrently, without sending credentials or model requests.
  const candidates = localProxyPorts.map((port) => new URL(`http://127.0.0.1:${port}`));
  const reachable = await Promise.all(
    candidates.map(
      async (candidate) => !excluded.has(candidate.href) && (await canReach(candidate)),
    ),
  );
  const candidate = candidates.find((_candidate, index) => reachable[index]);
  return candidate ? avatarModelProxy(target, candidate.href) : undefined;
}
