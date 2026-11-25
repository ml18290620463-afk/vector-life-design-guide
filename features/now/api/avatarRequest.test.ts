import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { avatarRequest } from './avatarRequest';
import { cognition, evidenceGraph } from '../../../tests/fixtures/avatarOntology';
import { buildGuidanceSources } from '../../../services/avatarGuidance';
import type { DiaryEntry } from '../../../types';
const state = vi.hoisted(() => ({
  session: { isUnlocked: true, masterPassword: null as string | null },
  account: 'a',
  valid: true,
  notify: () => {},
  notifySession: () => {},
  cleanupSession: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock('../../../stores/appStore', () => ({
  useAppStore: {
    getState: () => state.session,
    subscribe: (callback: () => void) => {
      state.notifySession = callback;
      return state.cleanupSession;
    },
  },
}));
vi.mock('../../../services/accountScope', () => ({ currentAccountId: () => state.account }));
vi.mock('../../../services/vaultTransaction', () => ({
  subscribeVault: (callback: () => void) => {
    state.notify = callback;
    return state.cleanup;
  },
}));
vi.mock('../../../services/aiPrivacy', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../services/aiPrivacy')>(),
  assertAIPrivacyUnchanged: async () => {
    if (!state.valid) throw new Error('revoked');
  },
}));
beforeEach(() => {
  state.valid = true;
  state.account = 'a';
  state.session = { isUnlocked: true, masterPassword: null };
  state.cleanup.mockClear();
  state.cleanupSession.mockClear();
});
afterEach(() => vi.unstubAllGlobals());
it('never sends when permission was revoked before dispatch', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  state.valid = false;
  await expect(avatarRequest('token', '/chat', {})).rejects.toThrow('revoked');
  expect(fetch).not.toHaveBeenCalled();
  expect(state.cleanup).toHaveBeenCalledOnce();
  expect(state.cleanupSession).toHaveBeenCalledOnce();
});
it.each(['permission', 'lock', 'account', 'caller'])(
  'cancels in-flight requests on %s change',
  async (kind) => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
            started();
          }),
      ),
    );
    const caller = new AbortController();
    const request = avatarRequest('token', '/chat', { signal: caller.signal });
    const assertion = expect(request).rejects.toThrow('aborted');
    await ready;
    if (kind === 'permission') state.valid = false;
    if (kind === 'lock') state.session = { ...state.session, isUnlocked: false };
    if (kind === 'account') state.account = 'b';
    if (kind === 'caller') caller.abort();
    else if (kind === 'lock') state.notifySession();
    else state.notify();
    await assertion;
    expect(state.cleanup).toHaveBeenCalledOnce();
    expect(state.cleanupSession).toHaveBeenCalledOnce();
  },
);
it('rejects a response revoked during JSON parsing even if transport ignores abort', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      json: async () => {
        state.valid = false;
        return { reply: 'stale' };
      },
    })),
  );
  await expect(avatarRequest('token', '/chat', {})).rejects.toThrow('revoked');
  expect(state.cleanup).toHaveBeenCalledOnce();
  expect(state.cleanupSession).toHaveBeenCalledOnce();
});
it.each(['source revision', 'source lock', 'source revocation'] as const)(
  'FI-01 drops an in-flight %s response and blocks the next request',
  async (kind) => {
    const entries: DiaryEntry[] = [1, 2].map((n) => ({
      id: `entry-${n}`, title: '记录', content: `独处之后更容易思考${n}`,
      createdAt: n * 86400000, tags: ['工作'], aiVisibility: 'allowed', isLocked: false,
    }));
    const graph = evidenceGraph([cognition()], entries);
    const sources = (live: DiaryEntry[]) => buildGuidanceSources({
      entries: live, principles: [], actions: [], graph,
    });
    expect(sources(entries).some((source) => source.text.includes('行动前会准备'))).toBe(true);
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const waitForChange = new Promise<void>((resolve) => { release = resolve; });
    const fetch = vi.fn(async () => {
      started();
      await waitForChange;
      return { json: async () => ({ candidates: [{ statement: 'stale' }] }) };
    });
    vi.stubGlobal('fetch', fetch);
    const inFlight = avatarRequest('token', '/extract', {});
    await ready;
    const changed = kind === 'source revision'
      ? [{ ...entries[0], content: '原文已经修订' }, entries[1]]
      : kind === 'source lock'
        ? [{ ...entries[0], isLocked: true }, entries[1]]
        : [{ ...entries[0], aiVisibility: 'private' as const }, entries[1]];
    state.valid = false;
    state.notify();
    release();
    await expect(inFlight).rejects.toThrow();
    await expect(avatarRequest('token', '/extract', {})).rejects.toThrow('revoked');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sources(changed).some((source) => source.text.includes('行动前会准备'))).toBe(false);
  },
);
it('returns a permitted response and removes subscriptions', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => ({ reply: 'ok' }) })),
  );
  expect((await avatarRequest('token', '/chat', {})).result).toEqual({ reply: 'ok' });
  expect(state.cleanup).toHaveBeenCalledOnce();
  expect(state.cleanupSession).toHaveBeenCalledOnce();
});
