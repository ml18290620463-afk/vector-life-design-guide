export interface AccountSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}
const env = import.meta.env;
export const accountConfig = {
  url: String(env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: String(env.VITE_SUPABASE_ANON_KEY ?? ''),
};
export const accountsEnabled = Boolean(accountConfig.url && accountConfig.key);
export const accountsRequired = env.VITE_REQUIRE_ACCOUNT === 'true';
const SESSION_KEY = 'vector-auth-session-v1';
let active: AccountSession | null = null;
let generation = 0;
export const accountSessionGeneration = () => generation;
let refreshing: Promise<AccountSession> | null = null;
async function request(path: string, body?: unknown, token?: string) {
  const response = await fetch(`${accountConfig.url}/auth/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: accountConfig.key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? '请求过于频繁，请稍后再试' : '登录验证失败，请检查验证码或重新登录');
  return response.status === 204 ? null : response.json();
}
function save(session: AccountSession, expectedGeneration = generation) {
  if (expectedGeneration !== generation) throw new Error('登录已取消，请重新登录');
  if (!session?.user?.id || !session.access_token || !session.refresh_token) throw new Error('登录响应无效');
  active = session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export async function sendEmailCode(email: string) {
  await request(`otp?redirect_to=${encodeURIComponent(window.location.origin + '/')}`, { email: email.trim(), create_user: true });
}
export async function verifyEmailCode(email: string, code: string) {
  const expected = generation;
  return save(await request('verify', { email: email.trim(), token: code.trim(), type: 'email' }), expected);
}
export async function resumeAccount() {
  const expected = generation;
  const callback = new URLSearchParams(window.location.hash.slice(1));
  if (callback.has('access_token') || callback.has('refresh_token') || callback.has('error')) {
    // Remove credentials before any diary code or third-party resources load.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (callback.has('error')) throw new Error('邮件链接已失效，请重新发送登录邮件');
    const refreshToken = callback.get('refresh_token');
    if (!callback.get('access_token') || !refreshToken) throw new Error('登录链接不完整，请重新发送登录邮件');
    // Obtain identity from Supabase, never from unverified URL claims.
    const session = await request('token?grant_type=refresh_token', { refresh_token: refreshToken });
    return save(session, expected);
  }
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as AccountSession;
    const session = await request('token?grant_type=refresh_token', { refresh_token: stored.refresh_token });
    return save(session, expected);
  } catch (error) {
    // Keep the saved refresh token on transient network failures so retry remains possible.
    if (expected === generation) active = null;
    throw error;
  }
}
export async function accountAccessToken() {
  if (!active) throw new Error('请重新登录');
  if (active.expires_at * 1000 > Date.now() + 60000) return active.access_token;
  const expected = generation;
  refreshing ??= request('token?grant_type=refresh_token', { refresh_token: active.refresh_token }).then((session) => save(session, expected)).finally(() => { refreshing = null; });
  return (await refreshing).access_token;
}
export async function logoutAccount() {
  const session = active;
  generation++;
  active = null;
  sessionStorage.removeItem(SESSION_KEY);
  if (session) {
    localStorage.setItem('vector-account-logout', JSON.stringify({ id: session.user.id, at: Date.now() }));
    try { await request('logout?scope=local', {}, session.access_token); } catch { /* Local logout remains effective offline. */ }
  }
}
export function clearSavedSession() { generation++; active = null; sessionStorage.removeItem(SESSION_KEY); }
