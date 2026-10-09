import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ArchivePrinciplesView } from './ArchivePrinciplesView';
import { TRANSLATIONS } from '../constants';
import type { Principle } from '../types';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  principles: [] as Principle[],
  onAddPrinciple: vi.fn(),
  onDeletePrinciple: vi.fn(),
  onUpdatePrinciple: vi.fn(),
};

describe('ArchivePrinciplesView', () => {
  it('keeps an empty principles area focused on extraction', () => {
    render(<ArchivePrinciplesView {...baseProps} />);
    expect(screen.getByRole('button', { name: '萃取' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByLabelText(t.addPrinciple)).toBeTruthy();
    expect(screen.queryByText(t.noPrinciples)).toBeNull();
  });

  it('explains a source-deletion empty state without changing the normal empty state', () => {
    render(<ArchivePrinciplesView {...baseProps} displayFirst emptyReason="source-deletion" />);

    expect(
      screen.getByText('关联经历已删除，原有原则已同步清理。新的理解会在回看中慢慢沉淀。'),
    ).toBeTruthy();
    expect(screen.queryByText(t.noPrinciples)).toBeNull();
  });

  it('keeps the principle library on the results page and opens a clean editor from card actions', async () => {
    const onUpdatePrinciple = vi.fn();
    const principle: Principle = {
      id: 'result-first',
      text: '先确认事实，再作判断',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
    };

    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        displayFirst
        principles={[principle]}
        onUpdatePrinciple={onUpdatePrinciple}
      />,
    );

    expect(screen.getByText('我的原则')).toBeTruthy();
    expect(screen.getByText('先确认事实，再作判断')).toBeTruthy();
    expect(screen.getByText('形成于 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: '编辑原则：先确认事实，再作判断' })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.showOnHome }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑原则：先确认事实，再作判断' }));

    expect(screen.getByRole('dialog', { name: '书写原则' })).toBeTruthy();
    expect(screen.getByLabelText('编辑原则：先确认事实，再作判断')).toBeTruthy();
    expect(document.querySelector('.mobile-principles-view__list')).toBeNull();

    fireEvent.change(screen.getByLabelText('编辑原则：先确认事实，再作判断'), {
      target: { value: '先核对事实，再作判断' },
    });
    expect(screen.getByRole('heading', { name: '编辑原则' })).toBeTruthy();
    expect(screen.getByText('原则内容')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    expect(onUpdatePrinciple).toHaveBeenCalledWith({
      ...principle,
      text: '先核对事实，再作判断',
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '书写原则' })).toBeNull());
    expect(screen.getByText('先确认事实，再作判断')).toBeTruthy();
  });

  it('records a wording change as a selected principle revision', async () => {
    const onRevisePrinciple = vi.fn();
    const principle: Principle = {
      id: 'revised-principle',
      text: '先确认事实，再作判断',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
    };
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        displayFirst
        principles={[principle]}
        onRevisePrinciple={onRevisePrinciple}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑原则：先确认事实，再作判断' }));
    fireEvent.change(screen.getByLabelText('编辑原则：先确认事实，再作判断'), {
      target: { value: '先核对事实，再作判断' },
    });
    expect(screen.getByText('这次修改代表什么？')).toBeTruthy();
    expect(screen.getByText('纠正原记录')).toBeTruthy();
    fireEvent.click(screen.getByText('记录新的变化'));
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() =>
      expect(onRevisePrinciple).toHaveBeenCalledWith(
        principle,
        '先核对事实，再作判断',
        'evolution',
      ),
    );
  });

  it('updates the homepage star directly from the principle card', async () => {
    const onUpdatePrinciple = vi.fn();
    const principle: Principle = {
      id: 'starred-principle',
      text: '把注意力放回能改变的事',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
    };
    render(
      <ArchivePrinciplesView
        {...baseProps}
        displayFirst
        principles={[principle]}
        onUpdatePrinciple={onUpdatePrinciple}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: t.showOnHome }));
    await waitFor(() =>
      expect(onUpdatePrinciple).toHaveBeenCalledWith({ ...principle, showOnHome: false }),
    );
  });

  it('saves a new principle with a clear confirmation action and returns to results', async () => {
    const onAddPrinciple = vi.fn();
    const onManagementChange = vi.fn();

    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        displayFirst
        onAddPrinciple={onAddPrinciple}
        onManagementChange={onManagementChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '写原则' }));
    expect(screen.getByRole('heading', { name: '写下原则' })).toBeTruthy();
    expect(screen.getByText('原则内容')).toBeTruthy();
    expect(screen.getByPlaceholderText('例如：重要会议前，先写下一个要确认的问题。')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t.addPrinciple), {
      target: { value: '先确认事实，再作判断' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存原则' }));

    expect(onAddPrinciple).toHaveBeenCalledWith(
      '先确认事实，再作判断',
      expect.any(Number),
      true,
      undefined,
      undefined,
      undefined,
      [],
      [],
    );
    await waitFor(() => expect(onManagementChange).toHaveBeenLastCalledWith(false));
    expect(screen.queryByLabelText(t.addPrinciple)).toBeNull();
    expect(screen.getByRole('button', { name: '写原则' })).toBeTruthy();
  });

  it('keeps the exact practice record as the source when an action is distilled', () => {
    const onAddPrinciple = vi.fn();
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        onAddPrinciple={onAddPrinciple}
        practiceReflectionContext={{
          actionId: 'action-1',
          practiceRecordId: 'practice-2',
          occurredOn: '2026-10-09',
          actionTitle: '确认会议范围',
          result: '已确认范围',
          nextStep: 'end',
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(t.addPrinciple), {
      target: { value: '会议开始前先确认范围' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.addPrinciple }));

    expect(onAddPrinciple).toHaveBeenLastCalledWith(
      '会议开始前先确认范围',
      expect.any(Number),
      true,
      undefined,
      undefined,
      undefined,
      [],
      ['practice-2'],
    );
  });

  it('keeps writing focused and records principle metadata automatically', () => {
    render(<ArchivePrinciplesView {...baseProps} displayFirst language="zh" />);

    fireEvent.click(screen.getByRole('button', { name: '写原则' }));

    expect(screen.getByText('原则内容')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存原则' })).toBeTruthy();
    for (const hiddenControl of [
      '记录于',
      '更多设置',
      '归档年份',
      '标签（可选）',
      '在首页呈现',
      '关联模式（可选）',
    ]) {
      expect(screen.queryByText(hiddenControl)).toBeNull();
    }
  });

  it('always displays every event tag page even before principles use them', () => {
    render(<ArchivePrinciplesView {...baseProps} language="zh" />);
    [
      '工作事业',
      '财务收支',
      '身心健康',
      '人际交往',
      '家庭亲密',
      '学习探索',
      '兴趣休闲',
      '生活起居',
      '未分类',
    ].forEach((tag) => expect(screen.getByRole('button', { name: tag })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '工作事业' }));
    expect(screen.getByText(t.noPrinciples)).toBeTruthy();
  });

  it('typing into the textarea routes through the controlled input', () => {
    render(<ArchivePrinciplesView {...baseProps} />);
    const textarea = screen.getByLabelText(t.addPrinciple) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Be water' } });
    expect(textarea.value).toBe('Be water');
  });

  it('saves the complete principle at the 120-character boundary', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} onAddPrinciple={onAddPrinciple} />);
    const text = 'A'.repeat(120);
    fireEvent.change(screen.getByLabelText(t.addPrinciple), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: t.addPrinciple }));
    expect(onAddPrinciple).toHaveBeenCalledTimes(1);
    expect(onAddPrinciple.mock.calls[0][0]).toBe(text);
  });

  it('preserves over-limit input and blocks saving with a visible warning', () => {
    render(<ArchivePrinciplesView {...baseProps} />);
    const textarea = screen.getByLabelText(t.addPrinciple) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A'.repeat(121) } });
    expect(textarea.value.length).toBe(121);
    expect(screen.getByRole('button', { name: t.addPrinciple }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('alert').textContent).toContain(t.charLimitWarning);
  });

  it('clicking add with empty input does NOT call onAddPrinciple', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} onAddPrinciple={onAddPrinciple} />);
    // The label and the submit button share the same localised string;
    // pick the actual <button>.
    const button = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.addPrinciple));
    expect(button).toBeTruthy();
    fireEvent.click(button!);
    expect(onAddPrinciple).not.toHaveBeenCalled();
  });

  it('clicking add with a non-empty input fires onAddPrinciple with text + year + showOnHome', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} onAddPrinciple={onAddPrinciple} />);
    fireEvent.change(screen.getByLabelText(t.addPrinciple), {
      target: { value: 'Be water, friend' },
    });
    const button = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.addPrinciple));
    fireEvent.click(button!);
    expect(onAddPrinciple).toHaveBeenCalledTimes(1);
    const [text, year, showOnHome] = onAddPrinciple.mock.calls[0];
    expect(text).toBe('Be water, friend');
    expect(typeof year).toBe('number');
    expect(showOnHome).toBe(true);
  });

  it('keeps the principle form focused by omitting trigger and response fields', () => {
    render(<ArchivePrinciplesView {...baseProps} language="zh" />);
    expect(screen.queryByText('何时想起它（可选）')).toBeNull();
    expect(screen.queryByText('触发后做什么（可选）')).toBeNull();
    expect(screen.queryByLabelText('触发场景（可选）')).toBeNull();
    expect(screen.queryByLabelText('对应动作（可选）')).toBeNull();
  });

  it('renders a structured principle as a when-do pair', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'structured',
            text: '沟通前先对齐',
            year: 2026,
            createdAt: 1,
            showOnHome: true,
            application: { trigger: '重要沟通开始前', action: '写下唯一目标' },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    expect(screen.getByText('重要沟通开始前')).toBeTruthy();
    expect(screen.getByText('写下唯一目标')).toBeTruthy();
  });

  it('renders persisted principles grouped by year (descending)', () => {
    const principles: Principle[] = [
      { id: 'p1', text: 'Older', year: 2023, createdAt: 1, showOnHome: true },
      { id: 'p2', text: 'Newer', year: 2025, createdAt: 2, showOnHome: false },
    ];
    render(<ArchivePrinciplesView {...baseProps} principles={principles} />);
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    expect(screen.getByText('Older')).toBeTruthy();
    expect(screen.getByText('Newer')).toBeTruthy();
    // Year separators carry the "formed through {year}" label.
    expect(screen.getByText(t.formedThrough.replace('{year}', '2025'))).toBeTruthy();
  });

  it('keeps linked pattern metadata hidden in principle display cards', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'p1',
            text: '先行动一步',
            year: 2026,
            createdAt: 1,
            showOnHome: true,
            sourcePatternIds: ['pattern-1'],
          },
        ]}
        patterns={[
          { id: 'pattern-1', statement: '面对压力时，你倾向于推迟行动。', status: 'confirmed' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    expect(screen.queryByText('回应 1 个模式')).toBeNull();
    expect(screen.queryByRole('button', { name: /调整回应：先行动一步/ })).toBeNull();
    expect(screen.queryByText('面对压力时，你倾向于推迟行动。')).toBeNull();
  });

  it('does not summarize linked patterns in principle display cards', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'p1',
            text: '先暂停再回应',
            year: 2026,
            createdAt: 1,
            showOnHome: true,
            sourcePatternIds: ['pattern-1', 'pattern-2'],
          },
        ]}
        patterns={[
          { id: 'pattern-1', statement: '被催促时，你容易立刻答应。', status: 'confirmed' },
          { id: 'pattern-2', statement: '压力升高时，你会忽略自己的边界。', status: 'confirmed' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    expect(screen.queryByText('回应 2 个模式')).toBeNull();
    expect(screen.queryByText('被催促时，你容易立刻答应。')).toBeNull();
    expect(screen.queryByText('压力升高时，你会忽略自己的边界。')).toBeNull();
  });

  it('keeps principle writing independent from avatar patterns', () => {
    const onAddPrinciple = vi.fn();
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        onAddPrinciple={onAddPrinciple}
        patterns={[
          { id: 'pattern-1', statement: '面对压力时，你倾向于推迟行动。', status: 'confirmed' },
        ]}
      />,
    );

    expect(screen.queryByText('关联模式（可选）')).toBeNull();
    expect(screen.queryByText('面对压力时，你倾向于推迟行动。')).toBeNull();

    fireEvent.change(screen.getByLabelText(t.addPrinciple), { target: { value: '先做最小步骤' } });
    fireEvent.click(
      screen.getAllByRole('button').find((button) => button.textContent?.includes(t.addPrinciple))!,
    );
    expect(onAddPrinciple).toHaveBeenCalledWith(
      '先做最小步骤',
      expect.any(Number),
      true,
      undefined,
      undefined,
      undefined,
      [],
      [],
    );
  });

  it('creates a principle with system-owned metadata and no manual tag selection', () => {
    const onAddPrinciple = vi.fn();
    render(<ArchivePrinciplesView {...baseProps} language="zh" onAddPrinciple={onAddPrinciple} />);
    fireEvent.change(screen.getByLabelText(t.addPrinciple), {
      target: { value: '重要事情先开始' },
    });
    fireEvent.click(
      screen.getAllByRole('button').find((button) => button.textContent?.includes(t.addPrinciple))!,
    );
    expect(onAddPrinciple).toHaveBeenCalledWith(
      '重要事情先开始',
      new Date().getFullYear(),
      true,
      undefined,
      undefined,
      undefined,
      [],
      [],
    );
    expect(screen.queryByLabelText('标签（可选）')).toBeNull();
  });

  it('filters principles by tag and keeps unclassified principles accessible', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'growth',
            text: '每天推进一步',
            tags: ['成长'],
            year: 2026,
            createdAt: 2,
            showOnHome: true,
          },
          {
            id: 'work',
            text: '先对齐目标',
            tags: ['工作'],
            year: 2026,
            createdAt: 1,
            showOnHome: true,
          },
          { id: 'legacy', text: '保留旧原则', year: 2025, createdAt: 0, showOnHome: false },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '成长' }));
    expect(screen.getByText('每天推进一步')).toBeTruthy();
    expect(screen.queryByText('先对齐目标')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    expect(screen.getByText('保留旧原则')).toBeTruthy();
    expect(screen.queryByText('每天推进一步')).toBeNull();
  });

  it('separates extraction from each tag display page', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'growth',
            text: '每天推进一步',
            tags: ['个人成长'],
            year: 2026,
            createdAt: 2,
            showOnHome: true,
          },
        ]}
      />,
    );
    expect(screen.getByLabelText(t.addPrinciple)).toBeTruthy();
    expect(screen.queryByText('每天推进一步')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '个人成长' }));
    expect(screen.queryByLabelText(t.addPrinciple)).toBeNull();
    expect(screen.getByText('每天推进一步')).toBeTruthy();
  });

  it('does not render bottom tags or tag editing inside principle cards', () => {
    const { container } = render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'p1',
            text: '先倾听',
            tags: ['个人成长'],
            year: 2026,
            createdAt: 1,
            showOnHome: true,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '个人成长' }));
    expect(screen.getByText('先倾听')).toBeTruthy();
    expect(container.querySelector('.mobile-principle-card .principle-tags')).toBeNull();
    expect(screen.queryByRole('button', { name: '编辑标签' })).toBeNull();
  });

  it('does not render principle validation status in display cards', () => {
    render(
      <ArchivePrinciplesView
        {...baseProps}
        language="zh"
        principles={[
          {
            id: 'p1',
            text: '先暂停',
            year: 2026,
            createdAt: 1,
            showOnHome: true,
            helpfulCount: 5,
            recallCount: 2,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    expect(screen.queryByText('经验证')).toBeNull();
    expect(screen.queryByText('待复核')).toBeNull();
    expect(screen.queryByText('积累中')).toBeNull();
  });

  it('toggling the show-on-home star fires onUpdatePrinciple with the flipped flag', () => {
    const onUpdatePrinciple = vi.fn();
    const principles: Principle[] = [
      { id: 'p1', text: 'Pin me', year: 2025, createdAt: 1, showOnHome: false },
    ];
    render(
      <ArchivePrinciplesView
        {...baseProps}
        principles={principles}
        onUpdatePrinciple={onUpdatePrinciple}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));
    fireEvent.click(screen.getByLabelText(t.showOnHome));
    expect(onUpdatePrinciple).toHaveBeenCalledWith({
      id: 'p1',
      text: 'Pin me',
      year: 2025,
      createdAt: 1,
      showOnHome: true,
    });
  });
});

describe('Past principle failure and exit protection', () => {
  it('retains input when saving fails and allows retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValueOnce(undefined);
    render(<ArchivePrinciplesView {...baseProps} displayFirst onAddPrinciple={save} />);
    fireEvent.click(screen.getByRole('button', { name: '写原则' }));
    fireEvent.change(screen.getByLabelText(t.addPrinciple), { target: { value: '先验证再判断' } });
    fireEvent.click(screen.getByRole('button', { name: '保存原则' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('操作失败'));
    expect((screen.getByLabelText(t.addPrinciple) as HTMLTextAreaElement).value).toBe(
      '先验证再判断',
    );
    fireEvent.click(screen.getByRole('button', { name: '保存原则' }));
    await waitFor(() => expect(screen.queryByLabelText(t.addPrinciple)).toBeNull());
    expect(save).toHaveBeenCalledTimes(2);
  });
  it('keeps draft on cancel and discards only with an explicit choice', () => {
    render(<ArchivePrinciplesView {...baseProps} displayFirst />);
    fireEvent.click(screen.getByRole('button', { name: '写原则' }));
    fireEvent.change(screen.getByLabelText(t.addPrinciple), { target: { value: '未保存内容' } });
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    expect((screen.getByLabelText(t.addPrinciple) as HTMLTextAreaElement).value).toBe('未保存内容');
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    fireEvent.click(screen.getByRole('button', { name: '放弃修改' }));
    expect(screen.queryByLabelText(t.addPrinciple)).toBeNull();
  });
});

it('cancels principle deletion without mutation and retains dialog after a failed delete', async () => {
  const remove = vi.fn().mockRejectedValueOnce(new Error('disk'));
  render(
    <ArchivePrinciplesView
      {...baseProps}
      displayFirst
      onDeletePrinciple={remove}
      principles={[{ id: 'p1', text: '保留原则', year: 2026, createdAt: 1, showOnHome: true }]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '编辑原则：保留原则' }));
  fireEvent.click(screen.getByRole('button', { name: t.deletePrinciple }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '编辑原则：保留原则' }));
  fireEvent.click(screen.getByRole('button', { name: t.deletePrinciple }));
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith('p1'));
  await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
  expect(screen.getByRole('dialog', { name: '删除这条原则？' })).toBeTruthy();
});

it('does not expose any avatar-pattern linkage in the principle editor', () => {
  render(
    <ArchivePrinciplesView
      {...baseProps}
      displayFirst
      patterns={[{ id: 'yes', statement: '任务不清楚时延后开始', status: 'confirmed' }]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '写原则' }));
  expect(screen.queryByText('关联模式（可选）')).toBeNull();
  expect(screen.queryByText('任务不清楚时延后开始')).toBeNull();
});
