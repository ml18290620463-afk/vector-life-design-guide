import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

// Exercise the real editor: first-run must not mount the autosaving NowFlow.
describe('minimal onboarding', () => {
  it('skips straight to writing and requests protection only on save', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    render(<Onboarding language="zh" onSetLanguage={vi.fn()} onComplete={complete} />);
    expect(screen.queryByTestId('onboarding-password')).toBeNull();
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    fireEvent.change(screen.getByLabelText('此刻发生了什么？'), { target: { value: '私密内容' } });
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('保存到过去'));
    fireEvent.change(screen.getByTestId('onboarding-password'), {
      target: { value: 'Vector123!' },
    });
    fireEvent.change(screen.getByTestId('onboarding-password-confirm'), {
      target: { value: 'Vector123!' },
    });
    fireEvent.click(screen.getByTestId('onboarding-protect'));
    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith(
        'Vector123!',
        [],
        [],
        expect.objectContaining({ text: '私密内容' }),
      ),
    );
  });
  it('retains content after failed protection and returning to edit', async () => {
    render(
      <Onboarding
        language="zh"
        onSetLanguage={vi.fn()}
        onComplete={vi.fn().mockRejectedValue(new Error('disk'))}
      />,
    );
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    fireEvent.change(screen.getByLabelText('此刻发生了什么？'), { target: { value: '保留我' } });
    fireEvent.click(screen.getByLabelText('保存到过去'));
    for (const id of ['onboarding-password', 'onboarding-password-confirm'])
      fireEvent.change(screen.getByTestId(id), { target: { value: 'Vector123!' } });
    fireEvent.click(screen.getByTestId('onboarding-protect'));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByText('返回编辑'));
    expect((screen.getByLabelText('此刻发生了什么？') as HTMLTextAreaElement).value).toBe('保留我');
  });
});
