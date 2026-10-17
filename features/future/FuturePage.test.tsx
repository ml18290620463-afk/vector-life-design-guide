import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { clear, set } from 'idb-keyval';
import { FuturePage } from './FuturePage';
import {
  readFutureSnapshot,
  recordActionPractice,
  saveFutureAction,
  saveGoal,
  saveVision,
} from '../../services/futureRepository';
import { DiaryStorageKeys as K } from '../../services/diaryStorage';
import type { Principle } from '../../types';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

const mount = async (
  onNavigateModule = vi.fn(),
  onReflectInPast = vi.fn(),
  principles: Principle[] = [],
  entries: import('../../types').DiaryEntry[] = [],
) => {
  render(
    <FuturePage
      archiveMode
      entries={entries}
      principles={principles}
      onSelectEntry={vi.fn()}
      onNavigateModule={onNavigateModule}
      onReflectInPast={onReflectInPast}
    />,
  );
  await screen.findByRole('tablist', { name: '未来分区' });
  await screen.findByRole('heading', { name: '行动' });
  return { onNavigateModule, onReflectInPast };
};

const mountain = () =>
  saveGoal({
    title: '爬十座山',
    status: 'active',
    tags: [],
    measurement: { kind: 'quantity', target: 10, unit: '座', precision: 0, distinctItems: true },
  });

const switchToPractice = () =>
  fireEvent.click(
    within(screen.getByRole('tablist', { name: '未来分区' })).getByRole('tab', { name: '反馈' }),
  );

const openActionFeedback = (title: string) => {
  switchToPractice();
  fireEvent.click(screen.getByRole('button', { name: title }));
  return screen.getByRole('dialog', { name: title });
};

describe('Future page', () => {
  it('keeps prior feedback collapsed while the next result can be entered', async () => {
    let action = await saveFutureAction({ title: '核对路线', status: 'pending' });
    for (let index = 1; index <= 4; index++) {
      await recordActionPractice({
        actionId: action.id,
        expectedActionRevision: action.revision,
        occurredOn: '2026-10-14',
        status: 'partial',
        nextStep: 'continue',
        note: `第${index}次核对`,
      });
      action = (await readFutureSnapshot()).actions[0];
    }
    await mount();
    const dialog = openActionFeedback(action.title);
    expect(within(dialog).queryByLabelText('反馈内容（可选）')).toBeNull();
    expect(within(dialog).getByRole('region', { name: '最新结果' })).toBeTruthy();
    const history = within(dialog).getByText('历史反馈（3）').closest('details')!;
    expect(history.open).toBe(false);
    fireEvent.click(within(dialog).getByText('历史反馈（3）'));
    expect(history.open).toBe(true);
    expect(within(history).getByText('第2次核对')).toBeTruthy();
    expect(within(history).queryByText('第4次核对')).toBeNull();
    expect(within(history).getByText('第1次核对')).toBeTruthy();
    expect(within(dialog).getByText('第4次核对')).toBeTruthy();
  });
  it('separates reading and editing and discards unsaved input when returning', async () => {
    const action = await saveFutureAction({ title: '整理路线', status: 'pending' });
    await mount();
    const dialog = openActionFeedback(action.title);
    expect(within(dialog).queryByRole('button', { name: '保存' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    fireEvent.change(within(dialog).getByLabelText('反馈内容（可选）'), {
      target: { value: '尚未保存' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '返回' }));
    expect(within(dialog).queryByLabelText('反馈内容（可选）')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    expect((within(dialog).getByLabelText('反馈内容（可选）') as HTMLTextAreaElement).value).toBe(
      '',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '返回' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '返回' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await readFutureSnapshot()).state.practiceRecords ?? []).toHaveLength(0);
  });

  it('carries a deliberate record context into a newly saved action', async () => {
    render(
      <FuturePage
        archiveMode
        entries={[]}
        onSelectEntry={vi.fn()}
        initialActionContext={{
          sourceEntryId: 'entry-1',
          evidenceEntryIds: ['entry-1'],
          rationale: '项目复盘记录',
        }}
      />,
    );
    const dialog = await screen.findByRole('dialog', { name: '行动规划' });
    expect(within(dialog).getByText('行动依据：项目复盘记录')).toBeTruthy();
    fireEvent.change(within(dialog).getByRole('textbox', { name: '行动内容' }), {
      target: { value: '先确认下次会议的问题' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '确定' }));

    await waitFor(async () => {
      const snapshot = await readFutureSnapshot();
      expect(snapshot.actions[0]).toMatchObject({
        title: '先确认下次会议的问题',
        sourceEntryId: 'entry-1',
        evidenceEntryIds: ['entry-1'],
        rationale: '项目复盘记录',
      });
    });
  });

  it('uses design and practice as the only primary navigation', async () => {
    await mount();
    const navigation = screen.getByRole('tablist', { name: '未来分区' });
    expect(within(navigation).getAllByRole('tab')).toHaveLength(2);
    expect(within(navigation).getByRole('tab', { name: '设计', selected: true })).toBeTruthy();
    expect(within(navigation).getByRole('tab', { name: '反馈' })).toBeTruthy();
  });

  it('uses one editor entry for all future planning types', async () => {
    await mount();
    const planningEntry = screen.getByRole('button', {
      name: '添加行动',
    });
    expect(planningEntry).toBeTruthy();
    expect(screen.queryByRole('button', { name: '新增' })).toBeNull();

    fireEvent.click(planningEntry);
    const dialog = screen.getByRole('dialog', { name: '行动规划' });
    expect(within(dialog).getByRole('button', { name: '行动规划', pressed: true })).toBeTruthy();
    expect(within(dialog).getByText('可选设置').closest('details')?.open).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: '目标' }));
    expect(screen.getByRole('dialog', { name: '目标' })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '目标' })).getByRole('button', {
        name: '行动规划',
      }),
    );
    expect(screen.getByRole('dialog', { name: '行动规划' })).toBeTruthy();
  });

  it('gives an empty future a single, explicit first step', async () => {
    await mount();
    for (const name of ['添加愿景', '添加目标', '添加行动'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByText('暂未记录')).toBeNull();
    switchToPractice();
    expect(screen.getByText('暂无行动。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '去添加规划' })).toBeNull();
  });

  it('presents vision, goal and action planning without action-result language', async () => {
    const vision = await saveVision({ text: '拥有持续探索世界的生活', status: 'active' });
    const goal = await saveGoal({
      title: '今年完成十次登山',
      visionId: vision.id,
      dueDate: '2026-12-31',
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    await saveFutureAction({
      title: '规划黄山路线',
      scheduledOn: '2026-10-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await mount();

    for (const title of ['愿景', '目标', '行动'])
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.queryByText('1 条记录')).toBeNull();
    expect(screen.getByText('拥有持续探索世界的生活')).toBeTruthy();
    // The card keeps the decision itself prominent and moves date / linkage
    // into a quieter second line, so long planning chains remain scannable.
    expect(screen.getByText('今年完成十次登山')).toBeTruthy();
    expect(screen.queryByText('截止 2026.12.31 · 关联愿景 · 拥有持续探索世界的生活')).toBeNull();
    expect(screen.getAllByText('规划黄山路线')).toHaveLength(1);
    expect(screen.queryByText('今年完成十次登山 · 2026.10.01')).toBeNull();
    expect(screen.queryByText('行动结果')).toBeNull();
    expect(screen.queryByText(/完成「规划黄山路线」/)).toBeNull();
  });

  it('shows direction before the next action and exposes its working context', async () => {
    const goal = await mountain();
    await saveFutureAction({
      title: '稍后整理装备',
      goalId: goal.id,
      status: 'pending',
    });
    await saveFutureAction({
      title: '今天确认路线',
      scheduledOn: '2000-01-01',
      goalId: goal.id,
      status: 'pending',
    });
    await mount();

    const now = screen.getByRole('heading', { name: '行动' }).closest('section')!;
    expect(within(now).getByText('今天确认路线')).toBeTruthy();
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings.indexOf('愿景')).toBeLessThan(headings.indexOf('目标'));
    expect(headings.indexOf('目标')).toBeLessThan(headings.indexOf('行动'));
    expect(within(now).queryByText(/爬十座山 · 2000.01.01/)).toBeNull();
  });

  it('shows three visions and expands or collapses the remaining items', async () => {
    await saveVision({ text: '第一条愿景', status: 'active' });
    await saveVision({ text: '第二条愿景', status: 'active' });
    await saveVision({ text: '第三条愿景', status: 'active' });
    await saveVision({ text: '第四条愿景', status: 'active' });
    await mount();
    const section = screen.getByRole('heading', { name: '愿景' }).closest('section')!;
    expect(within(section).queryByText('2 条记录')).toBeNull();
    expect(section.querySelectorAll('.future-summary-result')).toHaveLength(3);
    const toggle = within(section).getByRole('button', { name: '展开更多（1）' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(section.querySelectorAll('.future-summary-result')).toHaveLength(4);
    expect(within(section).getByText('第四条愿景')).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: '收起' }));
    expect(section.querySelectorAll('.future-summary-result')).toHaveLength(3);
  });

  it('keeps action feedback with the action without associating a past experience', async () => {
    const goal = await mountain();
    const action = await saveFutureAction({
      title: '完成泰山路线勘察',
      scheduledOn: '2000-01-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await mount();
    const dialog = openActionFeedback(action.title);
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    const row = dialog;
    const note = within(row).getByLabelText('反馈内容（可选）');
    expect(within(row).queryByLabelText('关联经历（可选）')).toBeNull();
    fireEvent.change(note, { target: { value: '路线已经确认，可以按计划出发' } });
    fireEvent.click(within(row).getByRole('button', { name: '保存' }));
    await screen.findByText('行动反馈已保存');

    const snapshot = await readFutureSnapshot();
    expect(snapshot.actions.find((item) => item.id === action.id)?.status).toBe('completed');
    expect(snapshot.state.practiceRecords).toMatchObject([
      { actionId: action.id, status: 'completed', note: '路线已经确认，可以按计划出发' },
    ]);
    expect(snapshot.state.events).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: action.title }));
    expect(screen.getByText('路线已经确认，可以按计划出发')).toBeTruthy();
    expect(screen.queryByLabelText('本次执行状态')).toBeNull();
  });

  it('lets a practice explicitly challenge its linked principle and preserves that judgment', async () => {
    const linkedPrinciple: Principle = {
      id: 'principle-1',
      text: '重要沟通前先定义目标',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
    };
    await set(K.principles, [linkedPrinciple]);
    const action = await saveFutureAction({
      title: '为客户会写下决策目标',
      resultIntent: 'preparation',
      status: 'pending',
      principleId: linkedPrinciple.id,
    });
    await mount(vi.fn(), vi.fn(), [linkedPrinciple]);
    switchToPractice();
    fireEvent.click(screen.getByRole('button', { name: /为客户会写下决策目标/ }));
    const dialog = screen.getByRole('dialog', { name: action.title });
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    expect(within(dialog).getByLabelText('本次执行状态')).toBeTruthy();
    fireEvent.click(within(dialog).getByText('评价这次行动（可选）'));
    fireEvent.change(within(dialog).getByLabelText('我的判断'), { target: { value: 'unhelpful' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await screen.findByRole('status');
    const snapshot = await readFutureSnapshot();
    expect(snapshot.state.practiceRecords?.[0].principleFeedback).toEqual({
      principleId: linkedPrinciple.id,
      principleText: linkedPrinciple.text,
      outcome: 'unhelpful',
    });
    expect(snapshot.state.events).toEqual([]);
    expect(snapshot.actions.find((item) => item.id === action.id)?.status).toBe('completed');
  });

  it('keeps unfinished actions available for further feedback', async () => {
    const goal = await mountain();
    const action = await saveFutureAction({
      title: '每周练习西语三次',
      goalId: goal.id,
      status: 'pending',
    });
    await mount();
    const dialog = openActionFeedback(action.title);
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    const row = dialog;
    fireEvent.change(within(row).getByLabelText('本次执行状态'), { target: { value: 'partial' } });
    fireEvent.click(within(row).getByText('下一步（默认继续完成）'));
    fireEvent.change(within(row).getByLabelText('下一步'), { target: { value: 'continue' } });
    fireEvent.click(within(row).getByRole('button', { name: '保存' }));
    await screen.findByText('行动反馈已保存');
    expect(screen.getByRole('button', { name: action.title })).toBeTruthy();
    expect((await readFutureSnapshot()).actions.find((item) => item.id === action.id)?.status).toBe(
      'active',
    );
  });

  it('keeps long planning details secondary and collects remaining plans', async () => {
    const vision = await saveVision({
      text: '在不同的人生阶段保持好奇、安定与持续创造，并让探索成为生活的一部分',
      status: 'active',
    });
    const goal = await saveGoal({
      title: '在年底前完成一组可以代表当前能力与方向的旅行摄影作品',
      visionId: vision.id,
      dueDate: '2026-12-31',
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    await saveFutureAction({
      title: '整理路线、器材与每日拍摄主题，形成一份可执行的出行清单',
      scheduledOn: '2026-10-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await saveFutureAction({
      title: '联系同行伙伴确认各自负责的出行准备事项',
      scheduledOn: '2026-10-02',
      goalId: goal.id,
      resultIntent: 'preparation',
      status: 'pending',
    });
    await mount();

    const goalSection = screen.getByRole('heading', { name: '目标' }).closest('section')!;
    expect(
      within(goalSection).getByText('在年底前完成一组可以代表当前能力与方向的旅行摄影作品')
        .className,
    ).toContain('future-summary-result__primary');
    expect(within(goalSection).queryByText(/2026.12.31/)).toBeNull();

    const actionSection = screen.getByRole('heading', { name: '行动' }).closest('section')!;
    expect(within(actionSection).queryByText('2 条记录')).toBeNull();
    expect(within(actionSection).getByText('联系同行伙伴确认各自负责的出行准备事项')).toBeTruthy();
    expect(within(actionSection).queryByText('行动结果')).toBeNull();
  });

  it('warns before saving a repeated vision', async () => {
    await saveVision({ text: '持续探索世界并保持好奇', status: 'active' });
    await saveVision({ text: '建立稳定而从容的生活', status: 'active' });
    await mount();
    const section = screen.getByRole('heading', { name: '愿景' }).closest('section')!;
    const displayed = section.querySelector('.future-summary-result__primary')!.textContent;
    const duplicate =
      displayed === '持续探索世界并保持好奇' ? '建立稳定而从容的生活' : '持续探索世界并保持好奇';
    fireEvent.click(within(section).getByRole('button', { name: `查看愿景：${displayed}` }));
    const dialog = screen.getByRole('dialog', { name: '愿景' });
    expect(within(dialog).getByText(displayed!)).toBeTruthy();
    expect(within(dialog).queryByLabelText('愿景内容')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑' }));
    fireEvent.change(within(dialog).getByLabelText('愿景内容'), { target: { value: duplicate } });
    fireEvent.click(within(dialog).getByRole('button', { name: '确定' }));
    await screen.findByText('发现相似愿景');
    expect(screen.getByRole('button', { name: '继续已有愿景' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '仍然保存' })).toBeTruthy();
  });

  it('shows no write controls while the vault is locked', async () => {
    await set(K.passwordHash, 'test-only-existing-password');
    render(<FuturePage archiveMode entries={[]} onSelectEntry={vi.fn()} />);
    await screen.findByRole('heading', { name: '资料库已锁定' });
    const navigation = screen.getByRole('tablist', { name: '未来分区' });
    expect(within(navigation).getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '编辑未来规划' })).toBeNull();
    switchToPractice();
    expect(screen.getByRole('heading', { name: '资料库已锁定' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Action detail goal context', () => {
  it('allows reviewing the goal after the action was stopped without appending another action result', async () => {
    const goal = await mountain();
    const action = await saveFutureAction({
      title: '登山已结束',
      status: 'pending',
      goalId: goal.id,
    });
    await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision ?? 0,
      status: 'cancelled',
      nextStep: 'end',
      note: '已登顶',
      occurredOn: '2026-10-14',
    });
    await mount();
    const dialog = openActionFeedback('登山已结束');
    expect(within(dialog).queryByRole('button', { name: '保存' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    expect(within(dialog).queryByLabelText('本次执行状态')).toBeNull();
    expect(
      (within(dialog).getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('同步目标完成情况'), {
      target: { value: 'continue' },
    });
    fireEvent.change(within(dialog).getByLabelText('目标进展（可选）'), {
      target: { value: '完成一座，还有九座' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const { state } = await readFutureSnapshot();
    expect(state.practiceRecords).toHaveLength(1);
    expect(state.goals[0].status).toBe('active');
    expect(state.goalFeedbackRecords?.[0].note).toBe('完成一座，还有九座');
  });
  it('shows the linked vision and goal and saves an explicit goal review with action feedback', async () => {
    const vision = await saveVision({ text: '保持健康', status: 'active' });
    const goal = await saveGoal({
      title: '完成登山',
      visionId: vision.id,
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    await saveFutureAction({ title: '登顶黄山', status: 'pending', goalId: goal.id });
    await mount();
    const dialog = openActionFeedback('登顶黄山');
    expect(within(dialog).getByText('愿景 · 保持健康')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: '目标 · 完成登山' })).toBeTruthy();
    expect(within(dialog).queryByLabelText('同步目标完成情况')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
    expect((within(dialog).getByLabelText('同步目标完成情况') as HTMLSelectElement).value).toBe('');
    fireEvent.change(within(dialog).getByLabelText('同步目标完成情况'), {
      target: { value: 'complete' },
    });
    fireEvent.change(within(dialog).getByLabelText('目标进展（可选）'), {
      target: { value: '完成本年度登山目标' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const snapshot = await readFutureSnapshot();
    expect(snapshot.state.goals[0].status).toBe('completed');
    expect(snapshot.state.goalFeedbackRecords?.[0].note).toBe('完成本年度登山目标');
    expect(snapshot.state.practiceRecords?.[0].goalFeedbackId).toBe(
      snapshot.state.goalFeedbackRecords?.[0].id,
    );
  });
});

it('allows retained long-term actions to append progress and later archive', async () => {
  const action = await saveFutureAction({ title: '每周整理', status: 'pending' });
  await recordActionPractice({
    actionId: action.id,
    expectedActionRevision: action.revision,
    occurredOn: '2026-10-14',
    status: 'completed',
    nextStep: 'end',
    note: '第一阶段',
    completionDestination: 'long_term',
  });
  await mount();
  const dialog = openActionFeedback(action.title);
  fireEvent.click(within(dialog).getByRole('button', { name: '更新进展' }));
  fireEvent.change(within(dialog).getByLabelText('反馈内容（可选）'), {
    target: { value: '第二阶段完成' },
  });
  fireEvent.change(within(dialog).getByLabelText('完成后'), { target: { value: 'past' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(async () => {
    const snapshot = await readFutureSnapshot();
    expect(snapshot.state.practiceRecords).toHaveLength(2);
    expect(snapshot.actions[0].archivedToPast).toBe(true);
    expect(snapshot.actions[0].status).toBe('completed');
  });
});
