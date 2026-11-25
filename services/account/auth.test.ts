import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const session = {
  access_token: 'test-access',
  refresh_token: 'test-refresh',
  expires_at: 1,
  user: { id: '11111111-1111-4111-8111-111111111111' },
};
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => vi.unstubAllGlobals());
it('never restores an in-flight login after logout', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const auth = await import('./auth');
  const login = auth.verifyEmailCode('a@example.test', '123456');
  const rejected = expect(login).rejects.toThrow('取消');
  await auth.logoutAccount();
  finish(new Response(JSON.stringify(session)));
  await rejected;
  expect(sessionStorage.getItem('vector-auth-session-v1')).toBeNull();
  await expect(auth.accountAccessToken()).rejects.toThrow('重新登录');
});
it('deduplicates refresh and rejects refresh results received after session clearing', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(session)));
  vi.stubGlobal('fetch', fetcher);
  const auth = await import('./auth');
  await auth.verifyEmailCode('a@example.test', '123456');
  let finish!: (value: Response) => void;
  fetcher.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const first = auth.accountAccessToken();
  const second = auth.accountAccessToken();
  const results = Promise.allSettled([first, second]);
  auth.clearSavedSession();
  finish(new Response(JSON.stringify(session)));
  expect((await results).every((result) => result.status === 'rejected')).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem('vector-auth-session-v1')).toBeNull();
});
it('preserves refresh credentials on a transient network failure', async () => {
  sessionStorage.setItem('vector-auth-session-v1', JSON.stringify(session));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  const auth = await import('./auth');
  await expect(auth.resumeAccount()).rejects.toThrow('offline');
  expect(sessionStorage.getItem('vector-auth-session-v1')).not.toBeNull();
});

it('exchanges email link credentials for a server-verified session and removes URL secrets', async () => {
  window.location.hash = 'access_token=callback-access&refresh_token=callback-refresh';
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(session)));
  vi.stubGlobal('fetch', fetcher);
  const auth = await import('./auth');
  expect(await auth.resumeAccount()).toEqual(session);
  expect(window.location.hash).toBe('');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ refresh_token: 'callback-refresh' });
});
it('rejects incomplete email links and clears their credentials', async () => {
  window.location.hash = 'access_token=invalid';
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const auth = await import('./auth');
  await expect(auth.resumeAccount()).rejects.toThrow('不完整');
  expect(window.location.hash).toBe('');
  expect(fetcher).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('vector-auth-session-v1')).toBeNull();
});
