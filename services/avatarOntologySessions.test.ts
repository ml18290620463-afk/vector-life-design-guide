import { beforeEach, expect, it } from 'vitest';
import { clear } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import type { AvatarSession } from '../features/avatar/types';
import { initializeAvatarOntology, readAvatarOntology } from './avatarOntologyStore';
import { createAvatarSessionWriter, selectAvatarConversation } from './avatarOntologySessions';

const session = (id = 'chat'): AvatarSession => ({
  id,
  mode: 'general',
  context: { mode: 'general', source: 'global' },
  messages: [
    {
      id: 'user-1',
      role: 'user',
      type: 'text',
      content: '原始表达',
      created_at: '2026-11-24T00:00:00Z',
    },
  ],
  references: [],
  createdAt: 1,
  updatedAt: 1,
});
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
});
it('serializes rapid saves and preserves message indices without a legacy cache', async () => {
  const write = createAvatarSessionWriter();
  const first = session();
  const second = {
    ...first,
    updatedAt: 2,
    messages: [...first.messages, { ...first.messages[0], id: 'user-2', content: '新的表达' }],
  };
  await Promise.all([write(first), write(second)]);
  const graph = await readAvatarOntology();
  expect(graph.sessions?.[0].messages.map((message) => message.id)).toEqual(['user-1', 'user-2']);
  expect(localStorage.getItem('vector:avatar:sessions:v1')).toBeNull();
});
it('restores one source session without merging, sorting or dropping its messages', async () => {
  const write = createAvatarSessionWriter();
  await write(session('old'));
  const latest = {
    ...session('latest'),
    updatedAt: 2,
    messages: [{ ...session().messages[0], id: 'different' }],
  };
  await write(latest);
  await write({ ...session('blank'), updatedAt: 3, messages: [] });
  expect(selectAvatarConversation(await readAvatarOntology(), latest.context)).toEqual(latest);
});
it('rejects a rewrite and allows a subsequent append without swallowing the error', async () => {
  const write = createAvatarSessionWriter();
  const original = session();
  await write(original);
  await expect(write({ ...original, updatedAt: 2, messages: [] })).rejects.toThrow(
    '不得删除原始会话消息',
  );
  await write({ ...original, updatedAt: 3 });
  expect((await readAvatarOntology()).sessions?.[0].messages).toEqual(original.messages);
});
it('rejects queued saves after a lock transition', async () => {
  const write = createAvatarSessionWriter();
  const pending = write(session());
  useAppStore.setState({ isUnlocked: false });
  await expect(pending).rejects.toThrow();
  useAppStore.setState({ isUnlocked: true });
  expect((await readAvatarOntology()).sessions ?? []).toEqual([]);
});
it('retains a long conversation without trimming original message indices', async () => {
  const original = session();
  original.messages = Array.from({ length: 360 }, (_, index) => ({
    ...original.messages[0],
    id: `message-${index}`,
  }));
  await createAvatarSessionWriter()(original);
  expect(selectAvatarConversation(await readAvatarOntology(), original.context)?.messages).toEqual(
    original.messages,
  );
});
