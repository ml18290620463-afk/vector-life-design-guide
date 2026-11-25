import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clear, set } from 'idb-keyval';
import { useAvatarMemoryCapture } from './useAvatarMemoryCapture';
import { aiPrivacyToken } from '../../../services/aiPrivacy';
import { DiaryStorageKeys } from '../../../services/diaryStorage';
import {
  initializeAvatarOntology,
  readAvatarOntology,
} from '../../../services/avatarOntologyStore';
import { createAvatarSessionWriter } from '../../../services/avatarOntologySessions';
import { useAppStore } from '../../../stores/appStore';
import type { DiaryEntry } from '../../../types';
import type { ChatMessage } from '../types/now';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const entries: DiaryEntry[] = [
  {
    id: 'entry',
    content: '记录',
    title: '',
    tags: [],
    createdAt: 1,
    isLocked: false,
    aiVisibility: 'allowed',
    aiConsentAt: 1,
  },
];
async function setup(kind = 'profile', allowReviewEdit = false) {
  await set(DiaryStorageKeys.entries, entries);
  const showToast = vi.fn();
  const saveSession = createAvatarSessionWriter();
  const source: ChatMessage = {
    id: 'message',
    role: 'user',
    type: 'text',
    content: '以后叫你小向',
    created_at: new Date().toISOString(),
    aiPrivacyToken: aiPrivacyToken(entries),
  };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [
        {
          kind,
          statement: '用户为分身取名为「小向」',
          sourceIndexes: [0],
          evidences: [source.content],
        },
      ],
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const hook = renderHook(() =>
    useAvatarMemoryCapture({
      draft: {
        text: '',
        materials: [],
        mood_tags: [],
        event_tags: [],
        record_time: '',
        display_time: '',
        updated_at: '',
      },
      sessionId: 'session',
      avatarMemoryReferences: [],
      showToast,
      appendReviewMessage: allowReviewEdit ? (statement) => [source, {
        ...source, id: 'edited-message', content: statement,
      }] : undefined,
      refreshAvatarMemories: vi.fn(),
      prepareExtraction: (messages) =>
        saveSession({
          id: 'session',
          mode: 'general',
          context: { mode: 'general', source: 'global' },
          messages,
          references: [],
          createdAt: 1,
          updatedAt: Date.now(),
        }),
    }),
  );
  await act(async () => {
    await hook.result.current.generateCompanionSummary([source]);
  });
  expect(hook.result.current.companionSummary).not.toBeNull();
  expect((await readAvatarOntology()).objects).toHaveLength(0);
  return { ...hook, showToast, fetchMock };
}
async function confirm(result: Awaited<ReturnType<typeof setup>>['result']) {
  let confirmation: Promise<unknown> | undefined;
  act(() => {
    confirmation = result.current.confirmMemory([], 'profile', 'explicit');
  });
  render(<>{result.current.dialog}</>);
  fireEvent.click(screen.getByRole('button', { name: /仅自己可见/ }));
  await act(async () => {
    await confirmation;
  });
}
it('rejects a previously proposed memory after record permission is revoked', async () => {
  const { result, showToast } = await setup();
  await set(DiaryStorageKeys.entries, [{ ...entries[0], aiVisibility: 'private', aiConsentAt: 2 }]);
  await confirm(result);
  expect((await readAvatarOntology()).objects).toHaveLength(0);
  expect(result.current.companionSummary).toBeNull();
  expect(showToast).toHaveBeenCalledWith('记录的 AI 权限已变化，请重新提炼后确认');
});
it('confirms an explicit expression only after the UI action with its original user evidence', async () => {
  const { result } = await setup();
  await confirm(result);
  const graph = await readAvatarOntology();
  expect(graph.objects).toHaveLength(1);
  expect(graph.objects[0]).toMatchObject({
    domain: 'about_me',
    status: 'confirmed',
    privacy: { aiVisible: false },
  });
  expect(graph.edges[0]).toMatchObject({
    type: 'EVIDENCED_BY',
    toId: 'message',
    userMessageIndex: 0,
    verbatimQuote: '以后叫你小向',
  });
  expect(localStorage.getItem('vector_avatar_atomic_memories')).toBeNull();
});
it('keeps a single-message inference as a candidate after explicit review', async () => {
  const { result } = await setup('pattern_candidate');
  await confirm(result);
  expect((await readAvatarOntology()).objects[0]).toMatchObject({
    domain: 'my_understanding',
    status: 'candidate',
  });
});
it('does not save an edited statement without reverification', async () => {
  const { result, showToast } = await setup();
  act(() =>
    result.current.setCompanionSummary((current) => ({ ...current!, text: '未经核验的新陈述' })),
  );
  await act(async () => { await result.current.confirmMemory([], 'profile', 'explicit'); });
  expect((await readAvatarOntology()).objects).toHaveLength(0);
  expect(showToast).toHaveBeenCalledWith('审核内容已修改，请重新核验用户原话');
});

it('revalidates edited user text and requires a second confirmation before writing', async () => {
  const { result, fetchMock } = await setup('profile', true);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{
    kind: 'profile', statement: '以后叫你小明', sourceIndexes: [1], evidences: ['以后叫你小明'],
  }] }) });
  act(() => result.current.setCompanionSummary(current => ({ ...current!, text: '以后叫你小明' })));
  await act(async () => { await result.current.confirmMemory([], 'profile', 'explicit'); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect((await readAvatarOntology()).objects).toHaveLength(0);
  expect(result.current.companionSummary?.text).toBe('以后叫你小明');
  await confirm(result);
  const graph = await readAvatarOntology();
  expect(graph.objects).toHaveLength(1);
  expect(graph.edges[0]).toMatchObject({ toId: 'edited-message', userMessageIndex: 1, verbatimQuote: '以后叫你小明' });
});
