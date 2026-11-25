import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clear, set } from 'idb-keyval';
import type { DiaryEntry, ActionItem, Principle } from '../types';
import type { ChatMessage } from '../features/now/types/now';
import { cognition, evidenceGraph } from '../tests/fixtures/avatarOntology';
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
    const originals = [entry(), entry({ id: 'entry2', createdAt: 86400001 })];
    const pattern = cognition({ id: 'pattern', statement: 'PRIVATE_PATTERN' });
    const memory = cognition({
      id: 'memory',
      domain: 'about_me',
      category: 'preferences_boundaries',
      statement: 'PRIVATE_MEMORY',
      origin: 'user_manual',
    });
    const graph = evidenceGraph([pattern, memory], originals);
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
    const input = { graph, principles, actions };
    const allowed = buildGuidanceSources({ ...input, entries: originals });
    expect(allowed.map((s) => s.id)).toEqual(
      expect.arrayContaining(['pattern', 'principle', 'action', 'memory']),
    );
    for (const entries of [
      originals.map((e) => ({ ...e, aiVisibility: 'private' as const })),
      [],
    ]) {
      expect(buildGuidanceSources({ ...input, entries })).toEqual([]);
    }
    const privatePrinciple = buildGuidanceSources({
      ...input,
      principles: [{ ...principles[0], aiVisibility: 'private' }],
      entries: originals,
    }).map((s) => s.id);
    expect(privatePrinciple).not.toContain('principle');
    expect(privatePrinciple).not.toContain('action');
    expect(
      buildGuidanceSources({
        ...input,
        graph: {
          ...graph,
          objects: [pattern, { ...memory, privacy: { ...memory.privacy, aiVisible: false } }],
        },
        entries: originals,
      }).map((s) => s.id),
    ).not.toContain('memory');
    const token = aiPrivacyToken(originals, undefined, actions, principles, graph);
    expect(token).not.toContain('PRIVATE_MEMORY');
    expect(token).not.toContain('AUTHORIZED_SENTINEL');
    expect(
      aiPrivacyToken(originals, undefined, actions, principles, {
        ...graph,
        objects: [{ ...pattern, statement: 'changed' }, memory],
      }),
    ).not.toBe(token);
  });
  it('invalidates a conversation when principle or memory consent changes', () => {
    const principles = [
      {
        id: 'p',
        text: '原则',
        year: 2026,
        createdAt: 1,
        showOnHome: false,
        aiVisibility: 'allowed' as const,
        aiConsentAt: 1,
      },
    ];
    const graph: AvatarOntologySnapshot = {
      ontologySchemaVersion: 2,
      revision: 1,
      edges: [],
      objects: [
        {
          id: 'm',
          schemaVersion: 2,
          domain: 'about_me',
          category: 'preferences_boundaries',
          statement: '记忆',
          status: 'confirmed',
          validity: { mode: 'long_term', validFrom: '2026-01-01T00:00:00.000Z' },
          privacy: { sensitivity: 'normal', aiVisible: true, traceabilityDegraded: false },
          evidenceGate: {
            requiresMultiSourceGate: false,
            independentExperienceCount: 0,
            distinctUserMessageCount: 1,
            distinctDateCount: 1,
            distinctSessionCount: 1,
            isReadyForConfirmation: true,
          },
          confidenceScore: 1,
          reinforcementCount: 0,
          version: 1,
          lineageId: 'm',
          origin: 'user_manual',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          confirmedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const old = aiPrivacyToken([entry()], undefined, [], principles, graph);
    expect(
      aiPrivacyToken(
        [entry()],
        undefined,
        [],
        [{ ...principles[0], aiVisibility: 'private', aiConsentAt: 2 }],
        graph,
      ),
    ).not.toBe(old);
    expect(
      aiPrivacyToken([entry()], undefined, [], principles, {
        ...graph,
        objects: [
          { ...graph.objects[0], privacy: { ...graph.objects[0].privacy, aiVisible: false } },
        ],
      }),
    ).not.toBe(old);
    expect(
      aiPrivacyToken([entry()], undefined, [], [{ ...principles[0], aiConsentAt: 3 }], graph),
    ).not.toBe(old);
  });
  it('filters stale messages and memories before the network request', async () => {
    const entries = [entry()];
    await set(DiaryStorageKeys.entries, entries);
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ reply: '回复' }) });
    vi.stubGlobal('fetch', fetchMock);
    const memories = buildGuidanceSources({
      entries,
      graph: evidenceGraph([], []),
      principles: [],
      actions: [],
    });
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
  expect(
    isAIMessageAllowed(old, [
      entry(),
      entry({ id: 'private', aiVisibility: 'private', aiConsentAt: 99 }),
    ]),
  ).toBe(true);
});
it('still blocks removal and locking of an old authorized source even without explicit citations', () => {
  const old = message([entry()]);
  expect(isAIMessageAllowed(old, [])).toBe(false);
  expect(isAIMessageAllowed(old, [entry({ isLocked: true })])).toBe(false);
});
