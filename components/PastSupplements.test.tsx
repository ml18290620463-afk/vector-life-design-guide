import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { clear, get, set } from 'idb-keyval';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../types';
import { SecurityService } from '../services/securityService';
import { PastSupplements } from './PastSupplements';

const entry: DiaryEntry = {
  id: 'entry-1',
  title: '记录',
  content: '原文',
  createdAt: 1,
  isLocked: false,
  tags: [],
};
const key = 'past-supplement-draft:entry-1';

beforeEach(async () => {
  await clear();
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () { this.open = false; });
});
afterEach(() => vi.restoreAllMocks());

it('keeps an encrypted draft intact until its password is available', async () => {
  const encrypted = await SecurityService.encrypt('后来的想法', 'secret');
  await set(key, { content: encrypted, encrypted: true });
  const onAppend = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(<PastSupplements entry={entry} language="zh" onAppend={onAppend} />);
  fireEvent.click(screen.getByRole('button', { name: '补充' }));
  expect(screen.getByRole('textbox', { name: '补充内容' })).toHaveProperty('disabled', true);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 450)); });
  expect(await get(key)).toEqual({ content: encrypted, encrypted: true });
  rerender(<PastSupplements entry={entry} language="zh" onAppend={onAppend} draftPassword="secret" />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: '补充内容' })).toHaveProperty('value', '后来的想法'));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(onAppend).toHaveBeenCalledWith(entry.id, '后来的想法', expect.any(String)));
  await waitFor(async () => expect(await get(key)).toBeUndefined());
});

it('recovers a plain draft after remount and preserves it on failed save', async () => {
  const onAppend = vi.fn().mockRejectedValue(new Error('保存失败'));
  const first = render(<PastSupplements entry={entry} language="zh" onAppend={onAppend} />);
  fireEvent.click(screen.getByRole('button', { name: '补充' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '补充内容' })).toHaveProperty('disabled', false));
  fireEvent.change(screen.getByRole('textbox', { name: '补充内容' }), { target: { value: '待补充的事实' } });
  await waitFor(async () => expect(await get(key)).toMatchObject({ content: '待补充的事实' }));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveProperty('textContent', '保存失败'));
  first.unmount();
  render(<PastSupplements entry={entry} language="zh" onAppend={onAppend} />);
  fireEvent.click(screen.getByRole('button', { name: '补充' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '补充内容' })).toHaveProperty('value', '待补充的事实'));
});
