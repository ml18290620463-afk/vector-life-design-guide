import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvatarMemoryConfirm } from './AvatarMemoryConfirm';

afterEach(() => {
  vi.restoreAllMocks();
});

it('makes a proposed change explicit before the user confirms it', () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () {
    this.setAttribute('open', '');
  });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () {
    this.removeAttribute('open');
  });
  const confirm = vi.fn();
  render(
    <AvatarMemoryConfirm
      text="我现在更适合在有少量环境声的地方工作"
      nature="explicit"
      tags={[]}
      facets={['preference']}
      candidateKind="preference"
      replacementStatement="我偏好绝对安静的工作环境"
      sourceCount={2}
      onTextChange={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={confirm}
      sending={false}
    />,
  );

  expect(screen.getByRole('heading', { name: '更新这条关于你的理解？' })).toBeTruthy();
  expect(screen.getByText('「我偏好绝对安静的工作环境」')).toBeTruthy();
  expect(screen.getByText(/模型从当前对话的 2 条用户表述中提炼/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确认更新' }));
  expect(confirm).toHaveBeenCalledWith([], 'recent_state', 'explicit', undefined);
});
