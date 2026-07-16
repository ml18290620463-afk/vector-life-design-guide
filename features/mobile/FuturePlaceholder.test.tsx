import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FuturePlaceholder } from './FuturePlaceholder';
import type { ActionItem, DiaryEntry, Principle } from '../../types';

vi.mock('../../services/neuralSemanticRecall', () => ({
  searchNeuralRelatedEntryIds: vi.fn().mockResolvedValue([]),
}));

afterEach(cleanup);

const entry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'entry-1',
  title: '客户沟通复盘',
  content: '今天客户沟通前没有先确认目标，后面节奏有点散。',
  createdAt: Date.parse('2026-07-06T10:00:00+08:00'),
  tags: ['事件:工作', '心情:焦虑'],
  isLocked: false,
  ...overrides,
});

const principle = (overrides: Partial<Principle> = {}): Principle => ({
  id: 'principle-1',
  text: '重要沟通先定义目标再行动',
  year: 2026,
  createdAt: Date.parse('2026-07-07T10:00:00+08:00'),
  showOnHome: true,
  ...overrides,
});

describe('FuturePlaceholder', () => {
  it('prioritizes confirmed principles for the next action', () => {
    render(<FuturePlaceholder language="zh" entries={[entry()]} principles={[principle()]} />);

    expect(screen.getByText('基于已确认原则')).not.toBeNull();
    expect(screen.getAllByText('重要沟通先定义目标再行动')).toHaveLength(2);
    expect(screen.getByText(/下一步：找一个与「工作」相关的小场景/)).not.toBeNull();
  });

  it('falls back to recent entries before principles exist', () => {
    render(<FuturePlaceholder language="zh" entries={[entry()]} principles={[]} />);

    expect(screen.queryByText('基于已确认原则')).toBeNull();
    expect(screen.getByText('客户沟通复盘')).not.toBeNull();
  });

  it('creates an action only after the user analyzes and claims it', async () => {
    const onAddAction = vi.fn().mockResolvedValue({ id: 'action-1' });
    render(
      <FuturePlaceholder
        language="zh"
        entries={[entry()]}
        principles={[principle({ confidence: 0.82, derivedFromEntryIds: ['entry-1'] })]}
        onAddAction={onAddAction}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/我该继续这个项目/), {
      target: { value: '下次客户会议如何避免讨论失焦？' },
    });
    fireEvent.click(screen.getByRole('button', { name: '基于我的经验分析' }));

    expect(screen.getByText('一个可验证的下一步')).not.toBeNull();
    expect(screen.getByText(/先做一次小范围验证/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '认领这一步' }));

    await waitFor(() =>
      expect(onAddAction).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          principleId: 'principle-1',
          evidenceEntryIds: ['entry-1'],
        }),
      ),
    );
  });

  it('routes an active action into explicit result review', () => {
    const onOpenAvatar = vi.fn();
    const action: ActionItem = {
      id: 'action-1',
      title: '先确认会议目标',
      status: 'active',
      question: '怎样避免讨论失焦？',
      createdAt: 1,
    };
    render(
      <FuturePlaceholder
        language="zh"
        entries={[entry()]}
        principles={[principle()]}
        actions={[action]}
        onOpenAvatar={onOpenAvatar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '记录实际结果' }));

    expect(onOpenAvatar).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'review',
        source: 'action-review',
        actionId: action.id,
      }),
    );
  });
});
