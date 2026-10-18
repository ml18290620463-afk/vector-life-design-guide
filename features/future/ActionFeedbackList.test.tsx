import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionItem } from '../../types';
import { ActionFeedbackList, feedbackActionStatus } from './ActionFeedbackList';

const actions = ['pending', 'active', 'active', 'completed', 'abandoned'].map((status, index) => ({
  id: String(index),
  title: `路线准备${index}`,
  status,
  createdAt: index,
})) as ActionItem[];

beforeEach(() => window.sessionStorage.clear());

describe('Action feedback list', () => {
  it('combines title search with two lifecycle groups and preserves the query', () => {
    const onOpen = vi.fn();
    render(
      <ActionFeedbackList
        actions={actions}
        onOpen={onOpen}
        onDelete={vi.fn().mockResolvedValue(true)}
      />,
    );
    const list = screen.getByRole('list', { name: '行动列表' });
    expect(within(list).getAllByRole('button')).toHaveLength(5);
    const filters = screen.getByRole('group', { name: '行动状态' });
    expect(within(filters).getAllByRole('button')).toHaveLength(3);
    for (const [status, indices] of [
      ['待推进', [0, 1, 2]],
      ['已结束', [3, 4]],
    ] as const) {
      fireEvent.click(within(filters).getByRole('button', { name: status }));
      expect(within(list).getAllByRole('button')).toHaveLength(indices.length);
      for (const index of indices) {
        expect(
          within(list).getByRole('button', { name: new RegExp(`^${actions[index].title}`) }),
        ).toBeTruthy();
      }
    }
    fireEvent.click(within(filters).getByRole('button', { name: '待推进' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '准备3' } });
    expect(screen.getByText('没有匹配的行动。')).toBeTruthy();
    fireEvent.click(within(filters).getByRole('button', { name: '已结束' }));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('准备3');
    fireEvent.click(within(list).getByRole('button', { name: new RegExp(`^${actions[3].title}`) }));
    expect(onOpen).toHaveBeenCalledWith('3');
  });
  it('merges completed and stopped actions while keeping active actions together', () => {
    expect(feedbackActionStatus(actions[3])).toBe('已结束');
    expect(feedbackActionStatus(actions[4])).toBe('已结束');
    expect(feedbackActionStatus(actions[2])).toBe('待推进');
  });
});

it('lets people select visible actions and confirm a batch deletion', async () => {
  const onDelete = vi.fn().mockResolvedValue(true);
  render(<ActionFeedbackList actions={actions} onOpen={vi.fn()} onDelete={onDelete} />);
  fireEvent.click(screen.getByRole('button', { name: /^选择$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^全选$/ }));
  expect(screen.getByText('已选 5 项')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^删除 5 项$/ }));
  const dialog = screen.getByRole('dialog', { name: '确认删除行动' });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }));
  await Promise.resolve();
  expect(onDelete).toHaveBeenCalledWith(actions);
});

it('finds actions by their goal through the existing search field', () => {
  const goals: import('../../types/future').Goal[] = [
    {
      id: 'g',
      title: '年度阅读',
      status: 'active',
      measurement: { kind: 'narrative' },
      tags: [],
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  render(
    <ActionFeedbackList
      actions={[{ ...actions[0], goalId: 'g' }, actions[1]]}
      goals={goals}
      onOpen={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '年度阅读' } });
  const list = screen.getByRole('list', { name: '行动列表' });
  expect(
    within(list).getByRole('button', { name: new RegExp(`^${actions[0].title}`) }),
  ).toBeTruthy();
  expect(
    within(list).queryByRole('button', { name: new RegExp(`^${actions[1].title}`) }),
  ).toBeNull();
});

it('restores the search and lifecycle filter for the current browser session', () => {
  const { unmount } = render(
    <ActionFeedbackList actions={actions} onOpen={vi.fn()} onDelete={vi.fn()} />,
  );
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '准备1' } });
  fireEvent.click(
    within(screen.getByRole('group', { name: '行动状态' })).getByRole('button', { name: '待推进' }),
  );
  unmount();
  render(<ActionFeedbackList actions={actions} onOpen={vi.fn()} onDelete={vi.fn()} />);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('准备1');
  expect(
    within(screen.getByRole('group', { name: '行动状态' }))
      .getByRole('button', { name: '待推进' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

it('shows only the newest feedback note as the list progress summary', () => {
  render(
    <ActionFeedbackList
      actions={actions.slice(0, 2)}
      onOpen={vi.fn()}
      onDelete={vi.fn()}
      latestRecordsByAction={{
        '0': {
          id: 'p',
          actionId: '0',
          status: 'completed',
          note: '完成第一轮整理',
          nextStep: 'end',
          occurredOn: '2026-10-17',
          createdAt: 1,
        },
      }}
    />,
  );
  expect(screen.getByText('完成第一轮整理')).toBeTruthy();
  expect(within(screen.getByRole('list', { name: '行动列表' })).getByText('进行中')).toBeTruthy();
});

it('migrates an old lifecycle filter without losing its search', () => {
  window.sessionStorage.setItem(
    'vector.future.action-feedback.view.v1',
    JSON.stringify({ query: '准备', status: '未开始' }),
  );
  render(<ActionFeedbackList actions={actions} onOpen={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByRole('button', { name: '待推进' }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('准备');
  expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(3);
});

it.each(['reject', 'false'])(
  'keeps selection and allows retry when deletion returns %s',
  async (failure) => {
    const onDelete = vi.fn();
    if (failure === 'reject') onDelete.mockRejectedValueOnce(new Error('offline'));
    else onDelete.mockResolvedValueOnce(false);
    onDelete.mockResolvedValueOnce(true);
    render(<ActionFeedbackList actions={actions} onOpen={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /^选择$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^全选$/ }));
    fireEvent.click(screen.getByRole('button', { name: '删除 5 项' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect((await screen.findByRole('alert')).textContent).toContain('删除未完成');
    expect(screen.getByText('已选 5 项')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /^选择$/ })).toBeTruthy();
  },
);
