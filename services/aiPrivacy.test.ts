import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clear, set } from 'idb-keyval';
import type { DiaryEntry, ActionItem, Principle } from '../types';
import type { ChatMessage } from '../features/now/types/now';
import type { AvatarAtomicMemory, AvatarUnderstandingVersion } from '../features/avatar/types';
import { aiPrivacyToken, canAIReadEntry, isAIMessageAllowed } from './aiPrivacy';
import { sanitizeDiaryEntry } from './diaryDataRead';
import { DiaryStorageKeys } from './diaryStorage';
import { buildGuidanceSources } from './avatarGuidanceSources';
import {
  chatWithAvatar,
  extractAvatarFacts,
  summarizeAvatarMessages,
} from '../features/now/api/avatar';

const entry = (patch: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'entry',
  title: '记录',
  content: 'AUTHORIZED_SENTINEL',
  tags: [],
  createdAt: 1,
  isLocked: false,
  aiVisibility: 'allowed',
  aiConsentAt: 1,
  ...patch,
});
const message = (entries: DiaryEntry[], patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'message',
  role: 'user',
  type: 'text',
  content: '当前问题',
  created_at: new Date().toISOString(),
  aiPrivacyToken: aiPrivacyToken(entries),
  ...patch,
});
beforeEach(async () => {
  await clear();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('AI consent boundary', () => {
  it.each([
    { aiVisibility: undefined },
    { aiVisibility: 'private' as const },
    { isLocked: true },
    { isEncrypted: true },
    { isSample: true },
    { unlockAt: Date.now() + 100000 },
  ])('blocks unauthorized or inaccessible records: %o', (patch) => {
    expect(canAIReadEntry(entry(patch))).toBe(false);
  });
  it('defaults legacy and malformed permissions to private', () => {
    expect(sanitizeDiaryEntry({ id: 'old' }).aiVisibility).toBe('private');
    expect(sanitizeDiaryEntry({ id: 'old', aiVisibility: true }).aiVisibility).toBe('private');
    expect(sanitizeDiaryEntry(entry()).aiVisibility).toBe('allowed');
  });
  it('invalidates old conversations on revoke and reallow, while ignoring order', () => {
    const entries = [entry(), entry({ id: 'other' })];
    const old = message(entries);
    expect(isAIMessageAllowed(old, entries.slice().reverse())).toBe(true);
    expect(
      isAIMessageAllowed(old, [entry({ aiVisibility: 'private', aiConsentAt: 2 }), entries[1]]),
    ).toBe(false);
    expect(isAIMessageAllowed(old, [entry({ aiConsentAt: 3 }), entries[1]])).toBe(false);
    expect(isAIMessageAllowed({ ...old, aiPrivacyToken: undefined }, entries)).toBe(false);
  });
  it('blocks private, missing, and indirect derived evidence', () => {
    const patterns: AvatarUnderstandingVersion[] = [
      {
        id: 'pattern',
        aiVisibility: 'allowed',
        statement: 'PRIVATE_PATTERN',
        status: 'confirmed',
        sourceEntryIds: ['entry'],
        createdAt: 1,
      },
    ];
    const principles: Principle[] = [
      {
        id: 'principle',
        aiVisibility: 'allowed',
        text: 'PRIVATE_PRINCIPLE',
        sourcePatternIds: ['pattern'],
        year: 2026,
        createdAt: 1,
        showOnHome: false,
      },
    ];
    const actions: ActionItem[] = [
      {
        id: 'action',
        title: 'PRIVATE_ACTION',
        aiVisibility: 'allowed',
        principleId: 'principle',
        status: 'active',
        createdAt: 1,
      },
    ];
    const avatarMemories: AvatarAtomicMemory[] = [
      {
        id: 'memory',
        aiVisibility: 'allowed',
        statement: 'PRIVATE_MEMORY',
        sourceRefs: [{ source: 'action', id: 'action' }],
        nature: 'explicit',
        facets: ['preference'],
        tags: [],
        contexts: [],
        confidence: 1,
        status: 'confirmed',
        sensitivity: 'normal',
        createdAt: 1,
      },
    ];
    const input = { patterns, principles, actions, avatarMemories };
    const allowed = buildGuidanceSources({ ...input, entries: [entry()] });
    expect(allowed.map((s) => s.id)).toEqual(
      expect.arrayContaining(['pattern', 'principle', 'action', 'memory']),
    );
    for (const entries of [[entry({ aiVisibility: 'private' })], []]) {
      expect(buildGuidanceSources({ ...input, entries })).toEqual([]);
    }
    expect(buildGuidanceSources({ ...input, principles: [{ ...principles[0], aiVisibility: 'private' }], entries: [entry()] }).map((s) => s.id)).not.toContain('memory');
    expect(buildGuidanceSources({ ...input, avatarMemories: [{ ...avatarMemories[0], aiVisibility: 'private' }], entries: [entry()] }).map((s) => s.id)).not.toContain('memory');
  });
  it('invalidates a conversation when principle or memory consent changes', () => {
    const principles = [{ id: 'p', text: '原则', year: 2026, createdAt: 1, showOnHome: false, aiVisibility: 'allowed' as const, aiConsentAt: 1 }];
    const memories = [{ id: 'm', statement: '记忆', nature: 'explicit' as const, facets: ['preference' as const], tags: [], contexts: [], sourceRefs: [], confidence: 1, status: 'confirmed' as const, sensitivity: 'normal' as const, createdAt: 1, aiVisibility: 'allowed' as const, aiConsentAt: 1 }];
    const old = aiPrivacyToken([entry()], undefined, [], principles, memories);
    expect(aiPrivacyToken([entry()], undefined, [], [{ ...principles[0], aiVisibility: 'private', aiConsentAt: 2 }], memories)).not.toBe(old);
    expect(aiPrivacyToken([entry()], undefined, [], principles, [{ ...memories[0], aiVisibility: 'private', aiConsentAt: 2 }])).not.toBe(old);
    expect(aiPrivacyToken([entry()], undefined, [], [{ ...principles[0], aiConsentAt: 3 }], memories)).not.toBe(old);
  });
  it('filters stale messages and memories before the network request', async () => {
    const entries = [entry()];
    await set(DiaryStorageKeys.entries, entries);
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ reply: '回复' }) });
    vi.stubGlobal('fetch', fetchMock);
    const memories = buildGuidanceSources({ entries, patterns: [], principles: [], actions: [] });
    await chatWithAvatar(
      [
        message(entries, { content: 'AUTHORIZED_SENTINEL' }),
        message(entries, { content: 'PRIVATE_SENTINEL', aiPrivacyToken: 'expired' }),
      ],
      [
        ...memories,
        {
          id: 'stale',
          kind: '背景',
          module: 'past',
          text: 'PRIVATE_SENTINEL',
          aiPrivacyToken: 'expired',
        },
      ],
    );
    const body = fetchMock.mock.calls[0][1].body as string;
    expect(body).toContain('AUTHORIZED_SENTINEL');
    expect(body).not.toContain('PRIVATE_SENTINEL');
    expect(body).not.toContain('aiPrivacyToken');
  });
  it('does not call chat, summary, or extraction with stale user context', async () => {
    await set(DiaryStorageKeys.entries, [entry({ aiVisibility: 'private' })]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const old = [message([entry()])];
    await expect(chatWithAvatar(old, [])).rejects.toThrow('新的对话');
    await expect(
      summarizeAvatarMessages({ messages: old, record_time: '', followup_round: 0 }),
    ).rejects.toThrow('新的对话');
    await expect(extractAvatarFacts(old, [])).rejects.toThrow('新的对话');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a response when access is revoked while it is in flight', async () => {
    const entries = [entry()];
    await set(DiaryStorageKeys.entries, entries);
    let finish!: (value: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const request = chatWithAvatar([message(entries)], []);
    const rejected = expect(request).rejects.toThrow('AI 权限已变化');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await set(DiaryStorageKeys.entries, [entry({ aiVisibility: 'private', aiConsentAt: 2 })]);
    finish({ ok: true, json: async () => ({ reply: '不应采用的旧回复' }) });
    await rejected;
  });
});

it('preserves old chat when unrelated records are added or private records are changed', () => {
  const old = message([entry(), entry({ id: 'private', aiVisibility: 'private' })]);
  expect(isAIMessageAllowed(old, [entry(), entry({ id: 'new' })])).toBe(true);
  expect(isAIMessageAllowed(old, [entry(), entry({ id: 'private', aiVisibility: 'private', aiConsentAt: 99 })])).toBe(true);
});
it('still blocks removal and locking of an old authorized source even without explicit citations', () => {
  const old = message([entry()]);
  expect(isAIMessageAllowed(old, [])).toBe(false);
  expect(isAIMessageAllowed(old, [entry({ isLocked: true })])).toBe(false);
});
