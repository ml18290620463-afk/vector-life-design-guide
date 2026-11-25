import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AvatarMemoryDetail } from './AvatarMemoryDetail';
import { cognition, evidenceGraph } from '../../../tests/fixtures/avatarOntology';
import { AVATAR_ONTOLOGY_KEY } from '../../../services/avatarOntologyKey';
import { clear, set } from 'idb-keyval';
import { DiaryStorageKeys } from '../../../services/diaryStorage';
import { useAppStore } from '../../../stores/appStore';
import { initializeAvatarOntology, readAvatarConfirmationPreview } from '../../../services/avatarOntologyStore';
import { rawVaultTransaction } from '../../../services/vaultTransaction';
import { createAvatarSessionWriter } from '../../../services/avatarOntologySessions';

afterEach(() => localStorage.clear());

it('keeps verified dialogue and supplement evidence collapsed and removes inaccessible excerpts', async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
  await set(DiaryStorageKeys.entries, [
    {
      id: 'entry',
      title: '',
      content: '工作',
      supplements: [{ id: 's', content: '独处更专注', createdAt: 2 }],
      tags: [],
      createdAt: 1,
      isLocked: false,
      aiVisibility: 'allowed',
    },
  ]);
  await createAvatarSessionWriter()({
    id: 'chat',
    mode: 'general',
    context: { mode: 'general', source: 'global' },
    createdAt: 1,
    updatedAt: 1,
    references: [],
    messages: [
      {
        aiPrivacyToken: (await readAvatarConfirmationPreview()).privacyToken,
        id: 'm',
        role: 'user',
        type: 'text',
        content: '我喜欢安静',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
  const memory = cognition({ id: 'understanding', statement: '我需要安静的环境', status: 'candidate', confirmedAt: undefined });
  const preview = await readAvatarConfirmationPreview();
  const graph = evidenceGraph([memory], preview.entries);
  graph.sessions = preview.graph.sessions;
  graph.edges[0] = { ...graph.edges[0], verbatimQuote: '独处更专注' } as typeof graph.edges[0];
  graph.edges.push({ id: 'chat-edge', schemaVersion: 2, type: 'EVIDENCED_BY',
    fromId: memory.id, toId: 'm', createdAt: memory.createdAt,
    sourceKind: 'chat_user_message', sessionId: 'chat', userMessageIndex: 0,
    verbatimQuote: '我喜欢安静', quoteVerifiedByServer: true,
    sourceOccurredAt: '2026-01-01T00:00:00.000Z', lastKnownSourceState: 'accessible' });
  graph.edges.push({ id: 'deleted-edge', schemaVersion: 2, type: 'EVIDENCED_BY',
    fromId: memory.id, toId: 'deleted', createdAt: memory.createdAt,
    sourceKind: 'past_experience', verbatimQuote: '已删除的事实', quoteVerifiedByServer: true,
    sourceOccurredAt: memory.createdAt, lastKnownSourceState: 'accessible' });
  await set(AVATAR_ONTOLOGY_KEY, graph);
  const props = { memory, onClose: vi.fn(), onSave: vi.fn(), onSupersede: vi.fn() };
  const { container } = render(
    <AvatarMemoryDetail
      {...props}
      entries={[
        {
          id: 'entry',
          title: '',
          content: '工作',
          tags: [],
          aiVisibility: 'allowed' as const,
          isLocked: false,
          createdAt: 1,
          supplements: [{ id: 's', content: '独处更专注', createdAt: 2 }],
        },
      ]}
    />,
  );
  expect(await screen.findByText('出处摘录')).toBeTruthy();
  expect(container.querySelector('details')?.open).toBe(false);
  expect(screen.getByText('独处更专注')).toBeTruthy();
  expect(screen.getByText('我喜欢安静')).toBeTruthy();
  expect(screen.getByText('过往记录')).toBeTruthy();
  expect(screen.getByText('来自聊天自述')).toBeTruthy();
  expect(screen.queryByText('已删除的事实')).toBeNull();
  await act(async () => {
    await rawVaultTransaction([DiaryStorageKeys.entries], (values) => {
      values[DiaryStorageKeys.entries] = [];
    });
  });
  await waitFor(() => expect(screen.queryByText('出处摘录')).toBeNull());
  expect(screen.queryByText('独处更专注')).toBeNull();
  expect(screen.queryByText('我喜欢安静')).toBeNull();
});


it('never accepts prop-only excerpts as authoritative evidence', async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
  const entry = { id: 'entry', title: '', content: '真实原文', tags: [],
    createdAt: 1, isLocked: false, aiVisibility: 'allowed' as const };
  await set(DiaryStorageKeys.entries, [entry]);
  const memory = cognition({ id: 'understanding', statement: '候选', status: 'candidate', confirmedAt: undefined });
  const graph = evidenceGraph([memory], [entry]);
  graph.edges[0] = { ...graph.edges[0], verbatimQuote: '伪造的补充' } as typeof graph.edges[0];
  await set(AVATAR_ONTOLOGY_KEY, graph);
  render(<AvatarMemoryDetail memory={memory} entries={[{ ...entry, content: '伪造的补充' }]}
    onClose={vi.fn()} onSave={vi.fn()} onSupersede={vi.fn()} />);
  await act(async () => { await readAvatarConfirmationPreview(); });
  expect(screen.queryByText('出处摘录')).toBeNull();
  expect(screen.queryByText('伪造的补充')).toBeNull();
});
