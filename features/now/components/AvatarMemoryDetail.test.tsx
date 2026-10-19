import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvatarMemoryDetail } from './AvatarMemoryDetail';
import { atomicMemoryFromUnderstanding } from '../../../services/avatarMemory';
import { writeAvatarSession } from '../../../services/avatarMemorySessions';

afterEach(() => localStorage.clear());

it('keeps verified dialogue and supplement evidence collapsed and removes inaccessible excerpts', () => {
  writeAvatarSession({
    id: 'chat',
    mode: 'general',
    context: { mode: 'general', source: 'global' },
    createdAt: 1,
    updatedAt: 1,
    references: [],
    messages: [
      { id: 'm', role: 'user', type: 'text', content: '我喜欢安静', created_at: '2026-01-01' },
    ],
  });
  const memory = atomicMemoryFromUnderstanding({
    id: 'understanding',
    statement: '我需要安静的环境',
    status: 'confirmed',
    sourceEntryIds: ['entry'],
    createdAt: 1,
  });
  memory.sourceRefs = [
    { source: 'entry', id: 'entry', supplementId: 's', excerpt: '独处更专注' },
    { source: 'message', id: 'm', sessionId: 'chat', excerpt: '我喜欢安静' },
    { source: 'entry', id: 'deleted', excerpt: '已删除的事实' },
  ];
  const props = { memory, onClose: vi.fn(), onSave: vi.fn(), onSupersede: vi.fn() };
  const { container, rerender } = render(
    <AvatarMemoryDetail
      {...props}
      entries={[
        {
          id: 'entry',
          title: '',
          content: '工作',
          tags: [],
          isLocked: false,
          createdAt: 1,
          supplements: [{ id: 's', content: '独处更专注', createdAt: 2 }],
        },
      ]}
    />,
  );
  expect(screen.getByText('出处摘录')).toBeTruthy();
  expect(container.querySelector('details')?.open).toBe(false);
  expect(screen.getByText('独处更专注')).toBeTruthy();
  expect(screen.getByText('我喜欢安静')).toBeTruthy();
  expect(screen.getByText('过往记录 · 补充')).toBeTruthy();
  expect(screen.getByText('来自聊天自述')).toBeTruthy();
  expect(screen.queryByText('已删除的事实')).toBeNull();
  localStorage.clear();
  rerender(<AvatarMemoryDetail {...props} entries={[]} />);
  expect(screen.queryByText('出处摘录')).toBeNull();
  expect(screen.queryByText('独处更专注')).toBeNull();
  expect(screen.queryByText('我喜欢安静')).toBeNull();
});
