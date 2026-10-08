import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatternReviewDialog } from './PatternReviewDialog';
import {
  readAvatarUnderstandings,
  updateAvatarUnderstandingStatus,
} from '../services/avatarMemory';
vi.mock('../services/avatarMemory', () => ({
  readAvatarUnderstandings: vi.fn(),
  updateAvatarUnderstandingStatus: vi.fn(),
}));
const pattern = { id: 'p', statement: '沟通前先整理想法', status: 'pending' as const };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAvatarUnderstandings).mockReturnValue([
    pattern as ReturnType<typeof readAvatarUnderstandings>[number],
  ]);
  vi.mocked(updateAvatarUnderstandingStatus).mockImplementation(
    (_id, status, statement) =>
      ({ ...pattern, status, statement }) as ReturnType<typeof updateAvatarUnderstandingStatus>,
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
describe('contextual pattern review', () => {
  it.each(['稍后再说', 'escape'])('defers via %s without recording agreement', (method) => {
    const onDefer = vi.fn();
    render(<PatternReviewDialog pattern={pattern} onDone={vi.fn()} onDefer={onDefer} />);
    if (method === 'escape')
      fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    else fireEvent.click(screen.getByText(method));
    expect(onDefer).toHaveBeenCalledOnce();
    expect(updateAvatarUnderstandingStatus).not.toHaveBeenCalled();
  });
  it.each(['认可', '不认可'])('persists an explicit %s', (label) => {
    const onDone = vi.fn();
    render(<PatternReviewDialog pattern={pattern} onDone={onDone} onDefer={vi.fn()} />);
    fireEvent.click(screen.getByText(label));
    expect(updateAvatarUnderstandingStatus).toHaveBeenCalledWith(
      'p',
      label === '认可' ? 'confirmed' : 'rejected',
      pattern.statement,
    );
    expect(onDone).toHaveBeenCalledOnce();
  });
  it('saves user wording and keeps failed decisions open for retry', () => {
    const onDone = vi.fn();
    render(<PatternReviewDialog pattern={pattern} onDone={onDone} onDefer={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('用你的话描述'), {
      target: { value: '只在重要沟通前准备' },
    });
    vi.mocked(updateAvatarUnderstandingStatus).mockReturnValueOnce(null);
    fireEvent.click(screen.getByText('保存修正'));
    expect(screen.getByRole('alert').textContent).toContain('尚未保存');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('保存修正'));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ statement: '只在重要沟通前准备' }),
    );
  });
  it('prevents overwriting a decision made in another tab', () => {
    render(<PatternReviewDialog pattern={pattern} onDone={vi.fn()} onDefer={vi.fn()} />);
    vi.mocked(readAvatarUnderstandings).mockReturnValue([]);
    fireEvent.click(screen.getByText('认可'));
    expect(screen.getByRole('alert').textContent).toContain('其他页面');
    expect(updateAvatarUnderstandingStatus).not.toHaveBeenCalled();
  });
});
