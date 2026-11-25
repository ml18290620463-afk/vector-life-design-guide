import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvatarChatMessage } from './AvatarChatMessage';
import type { DiaryEntry } from '../../../types';
import { useAppStore } from '../../../stores/appStore';
const entry: DiaryEntry = {
  id: 'e',
  title: 'Live title',
  content: 'Live body',
  createdAt: 1,
  tags: [],
  isLocked: false,
  aiVisibility: 'allowed',
};
const select = vi.fn();
function show(entries: DiaryEntry[]) {
  return render(
    <AvatarChatMessage
      message={{
        id: 'm',
        type: 'text',
        created_at: '2026-11-23',
        role: 'assistant',
        content: 'Answer',
        references: [
          {
            entryId: 'e',
            date: 1,
            title: 'Stale title',
            excerpt: 'Stale excerpt',
            reason: 'Stale reason',
          },
        ],
      }}
      pastEntries={entries}
      preview={null}
      sending={false}
      launchContext={{ mode: 'general', source: 'global' }}
      onSelectEntry={select}
      onSetPreview={vi.fn()}
      onEditTags={vi.fn()}
      onSendPreview={vi.fn()}
    />,
  );
}
afterEach(() => {
  useAppStore.setState({ language: 'zh' });
  select.mockClear();
});
it('uses current source text, allows navigation, and hides protected or future supplements', () => {
  useAppStore.setState({ language: 'en' });
  show([
    {
      ...entry,
      supplements: [
        { id: 's', content: 'Visible supplement', createdAt: 1 },
        { id: 'hidden', content: 'Secret supplement', createdAt: 1, isEncrypted: true },
        { id: 'future', content: 'Future supplement', createdAt: Date.now() + 100000 },
      ],
    },
  ]);
  fireEvent.click(screen.getByText(/View sources/));
  expect(screen.getByText('Live body')).toBeTruthy();
  expect(screen.getByText('Visible supplement')).toBeTruthy();
  expect(screen.queryByText(/Stale|Secret supplement|Future supplement/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Live title' }));
  expect(select).toHaveBeenCalledWith('e');
});
it.each(
  [
    [],
    [{ ...entry, aiVisibility: 'private' as const }],
    [{ ...entry, isLocked: true }],
    [{ ...entry, isEncrypted: true }],
    [{ ...entry, isSample: true }],
    [{ ...entry, unlockAt: Date.now() + 100000 }],
  ].map((entries) => ({ entries })),
)('does not reveal cached text for unavailable sources %#', ({ entries }) => {
  show(entries);
  expect(screen.getByText('来源已删除、锁定或不可访问')).toBeTruthy();
  expect(screen.queryByText(/Stale|Live body|Live title/)).toBeNull();
});
