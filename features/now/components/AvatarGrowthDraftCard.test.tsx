import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AvatarGrowthDraftCard } from './AvatarGrowthDraftCard';
import { loadFutureDrafts, saveFutureDraft } from '../../../services/futureDraftRepository';

vi.mock('../../../services/futureDraftRepository', () => ({
  loadFutureDrafts: vi.fn(),
  saveFutureDraft: vi.fn(),
}));

it('requires explicit confirmation and keeps an existing future draft intact', async () => {
  vi.mocked(loadFutureDrafts).mockResolvedValue({ revision: 2, drafts: {
    'action:new': { fields: { title: '已有草稿' }, updatedAt: 1 },
  } });
  const openFuture = vi.fn();
  render(<AvatarGrowthDraftCard suggestion="下一步：每天读书" onOpenFuture={openFuture} />);
  expect(saveFutureDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '生成下一步微行动草稿' }));
  expect(saveFutureDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认保存草稿' }));
  await waitFor(() => expect(screen.getByText(/已有未完成的未来行动草稿/)).toBeTruthy());
  expect(saveFutureDraft).not.toHaveBeenCalled();
  expect(openFuture).not.toHaveBeenCalled();
});

it('saves an edited draft only after the user confirms it', async () => {
  vi.mocked(loadFutureDrafts).mockResolvedValue({ revision: 4, drafts: {} });
  vi.mocked(saveFutureDraft).mockResolvedValue({ revision: 5, drafts: {} });
  const openFuture = vi.fn();
  render(<AvatarGrowthDraftCard suggestion="模型建议" onOpenFuture={openFuture} />);
  fireEvent.click(screen.getByRole('button', { name: '生成下一步微行动草稿' }));
  fireEvent.change(screen.getByRole('textbox', { name: '下一步微行动' }), { target: { value: '用户修改后的行动' } });
  expect(saveFutureDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认保存草稿' }));
  await waitFor(() => expect(saveFutureDraft).toHaveBeenCalledWith('action:new', expect.objectContaining({ fields: { title: '用户修改后的行动' } }), 4));
  expect(openFuture).toHaveBeenCalledOnce();
});
