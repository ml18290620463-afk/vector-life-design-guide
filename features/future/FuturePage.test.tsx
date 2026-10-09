import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { clear, set } from 'idb-keyval';
import { FuturePage } from './FuturePage';
import {
  readFutureSnapshot,
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
) => {
  render(
    <FuturePage
      archiveMode
      entries={[]}
      principles={principles}
      onSelectEntry={vi.fn()}
      onNavigateModule={onNavigateModule}
      onReflectInPast={onReflectInPast}
    />,
  );
  await screen.findByRole('tablist', { name: '未来分区' });
  await screen.findByRole('heading', { name: '行动规划' });
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
    within(screen.getByRole('tablist', { name: '未来分区' })).getByRole('tab', { name: '践行' }),
  );

describe('Future page', () => {
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
    expect(within(navigation).getByRole('tab', { name: '践行' })).toBeTruthy();
  });

  it('uses one editor entry for all future planning types', async () => {
    await mount();
    const planningEntry = screen.getByRole('button', {
      name: /^(设计下一次尝试|编辑未来规划)$/,
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
    expect(screen.getByRole('button', { name: '设计下一次尝试' })).toBeTruthy();
    switchToPractice();
    expect(screen.getByText('先设计下一次尝试，再在这里记录实际发生了什么。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '去设计下一次尝试' }));
    expect(
      within(screen.getByRole('tablist', { name: '未来分区' })).getByRole('tab', {
        name: '设计',
        selected: true,
      }),
    ).toBeTruthy();
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

    for (const title of ['愿景', '目标', '行动规划'])
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getAllByText('1 条记录')).toHaveLength(3);
    expect(screen.getByText('拥有持续探索世界的生活')).toBeTruthy();
    // The card keeps the decision itself prominent and moves date / linkage
    // into a quieter second line, so long planning chains remain scannable.
    expect(screen.getByText('今年完成十次登山')).toBeTruthy();
    expect(screen.getByText('2026.12.31 前完成 · 关联愿景 · 拥有持续探索世界的生活')).toBeTruthy();
    expect(screen.getAllByText('规划黄山路线')).toHaveLength(2);
    expect(
      screen.getAllByText('所属目标 · 今年完成十次登山 · 状态 · 待开始 · 2026.10.01 计划'),
    ).toHaveLength(2);
    expect(screen.queryByText('行动结果')).toBeNull();
    expect(screen.queryByText(/完成「规划黄山路线」/)).toBeNull();
  });

  it('puts one actionable item before the planning summaries and exposes its working context', async () => {
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

    const now = screen.getByRole('heading', { name: '现在推进' }).closest('section')!;
    expect(within(now).getByText('今天确认路线')).toBeTruthy();
    expect(
      within(now).getByText(/所属目标 · 爬十座山 · 状态 · 待开始 · 2000.01.01 计划/),
    ).toBeTruthy();
  });

  it('keeps extra design records folded and labels the total count', async () => {
    await saveVision({ text: '第一条愿景', status: 'active' });
    await saveVision({ text: '第二条愿景', status: 'active' });
    await mount();
    const section = screen.getByRole('heading', { name: '愿景' }).closest('section')!;
    expect(within(section).getByText('2 条记录')).toBeTruthy();
    const details = section.querySelector('details')!;
    expect(details.open).toBe(false);
    fireEvent.click(within(section).getByText('查看其余 1 条'));
    expect(details.open).toBe(true);
  });

  it('shows the saved result directly with optional reflection', async () => {
    const goal = await mountain();
    await saveFutureAction({
      title: '完成泰山路线勘察',
      scheduledOn: '2000-01-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await mount();
    switchToPractice();
    expect(screen.getByRole('heading', { name: '尝试结果' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '行动记录' })).toBeNull();
    expect(screen.getByRole('button', { name: '待检视 1' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '待检视 1' }));
    const dialog = screen.getByRole('dialog', { name: '待检视' });
    fireEvent.click(within(dialog).getByRole('button', { name: /完成泰山路线勘察/ }));
    const workspace = screen.getByRole('dialog', { name: '行动记录' });
    expect(within(workspace).getByText('完成泰山路线勘察')).toBeTruthy();
    expect(within(workspace).getByText('所属目标 · 爬十座山')).toBeTruthy();
    expect(within(workspace).getByLabelText('本次执行状态')).toBeTruthy();
    expect(within(workspace).getByLabelText('实际发生了什么（可选）')).toBeTruthy();
    expect(within(workspace).queryByLabelText('下一步')).toBeNull();

    fireEvent.change(within(workspace).getByLabelText('实际发生了什么（可选）'), {
      target: { value: '路线已经确认，可以按计划出发' },
    });
    fireEvent.click(within(workspace).getByRole('button', { name: '保存记录' }));
    await screen.findByText('结果已保存');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: '回顾这次尝试' })).toBeTruthy();

    const snapshot = await readFutureSnapshot();
    expect(snapshot.actions[0].status).toBe('completed');
    expect(snapshot.state.events).toEqual([]);
    expect(snapshot.state.practiceRecords).toMatchObject([
      {
        actionId: snapshot.actions[0].id,
        status: 'completed',
        note: '路线已经确认，可以按计划出发',
        nextStep: 'end',
      },
    ]);
    expect(screen.getAllByText('路线已经确认，可以按计划出发')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /待检视/ })).toBeNull();
    expect(
      screen.getByRole('heading', { name: '尝试结果' }).closest('section')?.querySelector('select'),
    ).toBeNull();
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
    await saveFutureAction({
      title: '为客户会写下决策目标',
      scheduledOn: '2000-01-01',
      resultIntent: 'preparation',
      status: 'pending',
      principleId: linkedPrinciple.id,
    });
    await mount(vi.fn(), vi.fn(), [linkedPrinciple]);
    switchToPractice();
    fireEvent.click(screen.getByRole('button', { name: '待检视 1' }));
    fireEvent.click(screen.getByRole('button', { name: /为客户会写下决策目标/ }));
    const dialog = screen.getByRole('dialog', { name: '行动记录' });

    expect(within(dialog).getByText(`关联原则：${linkedPrinciple.text}`)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('我的判断'), {
      target: { value: 'unhelpful' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存记录' }));

    await screen.findByText(`原则判断：${linkedPrinciple.text} · 挑战`);
    expect((await readFutureSnapshot()).state.practiceRecords?.[0].principleFeedback).toEqual({
      principleId: linkedPrinciple.id,
      principleText: linkedPrinciple.text,
      outcome: 'unhelpful',
    });
  });

  it('shows an action source chain before editing its planning details', async () => {
    const linkedPrinciple: Principle = {
      id: 'principle-1',
      text: '重要沟通前先定义目标',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
    };
    await saveFutureAction({
      title: '在下次客户会前确定决策目标',
      status: 'pending',
      resultIntent: 'preparation',
      principleId: linkedPrinciple.id,
      sourceEntryId: 'entry-1',
      evidenceEntryIds: ['entry-2'],
      rationale: '把复盘中的有效准备方法用于下一次沟通。',
    });
    render(
      <FuturePage
        archiveMode
        entries={[
          {
            id: 'entry-1',
            title: '客户会复盘',
            content: '...',
            tags: [],
            createdAt: 1,
            isLocked: false,
          },
          {
            id: 'entry-2',
            title: '会前准备记录',
            content: '...',
            tags: [],
            createdAt: 2,
            isLocked: false,
          },
        ]}
        principles={[linkedPrinciple]}
        onSelectEntry={vi.fn()}
      />,
    );
    await screen.findByRole('heading', { name: '行动规划' });
    fireEvent.click(
      screen.getByRole('button', { name: /编辑行动规划：行动「在下次客户会前确定决策目标」/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '查看行动脉络' }));

    const dialog = screen.getByRole('dialog', { name: '行动脉络' });
    expect(
      within(dialog).getByText('行动依据：把复盘中的有效准备方法用于下一次沟通。'),
    ).toBeTruthy();
    expect(within(dialog).getByText(`关联原则：${linkedPrinciple.text}`)).toBeTruthy();
    expect(within(dialog).getByText('客户会复盘')).toBeTruthy();
    expect(within(dialog).getByText('会前准备记录')).toBeTruthy();
  });

  it('links a completed action to past and avatar without creating another record', async () => {
    const onNavigateModule = vi.fn();
    const onReflectInPast = vi.fn();
    const goal = await mountain();
    await saveFutureAction({
      title: '完成泰山路线勘察',
      scheduledOn: '2000-01-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await mount(onNavigateModule, onReflectInPast);
    switchToPractice();
    fireEvent.click(screen.getByRole('button', { name: '待检视 1' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '待检视' })).getByRole('button', {
        name: /完成泰山路线勘察/,
      }),
    );
    const workspace = screen.getByRole('dialog', { name: '行动记录' });
    fireEvent.change(within(workspace).getByLabelText('实际发生了什么（可选）'), {
      target: { value: '路线已经确认，可以按计划出发' },
    });
    fireEvent.click(within(workspace).getByRole('button', { name: '保存记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '回顾这次尝试' }));
    expect(onReflectInPast).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: expect.any(String),
        practiceRecordId: expect.any(String),
        occurredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        actionTitle: '完成泰山路线勘察',
      }),
    );
    expect(onNavigateModule).not.toHaveBeenCalled();

    const snapshot = await readFutureSnapshot();
    expect(snapshot.actions).toHaveLength(1);
    expect(snapshot.state.events).toHaveLength(0);
    expect(snapshot.state.practiceRecords).toHaveLength(1);
  });

  it('does not label unfinished practice as a completed growth loop', async () => {
    const goal = await mountain();
    await saveFutureAction({
      title: '完成泰山路线勘察',
      scheduledOn: '2000-01-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await mount();
    switchToPractice();
    fireEvent.click(screen.getByRole('button', { name: '待检视 1' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '待检视' })).getByRole('button', {
        name: /完成泰山路线勘察/,
      }),
    );
    const workspace = screen.getByRole('dialog', { name: '行动记录' });
    fireEvent.change(within(workspace).getByLabelText('本次执行状态'), {
      target: { value: 'partial' },
    });
    fireEvent.change(within(workspace).getByLabelText('实际发生了什么（可选）'), {
      target: { value: '路线已初步确认' },
    });
    fireEvent.change(within(workspace).getByLabelText('下一步'), { target: { value: 'continue' } });
    fireEvent.click(within(workspace).getByRole('button', { name: '保存记录' }));
    await screen.findByText('结果已保存');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: '回顾这次尝试' })).toBeNull();
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
    expect(within(goalSection).getByText(/2026.12.31 前完成/).className).toContain(
      'future-summary-result__context',
    );

    const actionSection = screen.getByRole('heading', { name: '行动规划' }).closest('section')!;
    expect(within(actionSection).getByText('2 条记录')).toBeTruthy();
    expect(within(actionSection).getByText('查看其余 1 条')).toBeTruthy();
    expect(within(actionSection).queryByText('行动结果')).toBeNull();
    fireEvent.click(within(actionSection).getByText('查看其余 1 条'));
    expect(within(actionSection).getByText('联系同行伙伴确认各自负责的出行准备事项')).toBeTruthy();
  });

  it('warns before saving a repeated vision', async () => {
    await saveVision({ text: '持续探索世界并保持好奇', status: 'active' });
    await saveVision({ text: '建立稳定而从容的生活', status: 'active' });
    await mount();
    const section = screen.getByRole('heading', { name: '愿景' }).closest('section')!;
    const displayed = section.querySelector('.future-summary-result__primary')!.textContent;
    const duplicate =
      displayed === '持续探索世界并保持好奇' ? '建立稳定而从容的生活' : '持续探索世界并保持好奇';
    fireEvent.click(within(section).getByRole('button', { name: /编辑愿景/ }));
    const dialog = screen.getByRole('dialog', { name: '愿景' });
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

describe('Future practice continuation', () => {
  it('keeps an active action available for another practice record after continuing', async () => {
    const goal = await mountain();
    const action = await saveFutureAction({
      title: '每周练习西语三次',
      scheduledOn: '2000-01-01',
      goalId: goal.id,
      resultIntent: 'outcome',
      status: 'pending',
    });
    await mount();
    switchToPractice();

    fireEvent.click(screen.getByRole('button', { name: '待检视 1' }));
    fireEvent.click(screen.getByRole('button', { name: /每周练习西语三次/ }));
    const firstEditor = screen.getByRole('dialog', { name: '行动记录' });
    fireEvent.change(within(firstEditor).getByLabelText('本次执行状态'), {
      target: { value: 'partial' },
    });
    fireEvent.change(within(firstEditor).getByLabelText('实际发生了什么（可选）'), {
      target: { value: '已完成两次练习' },
    });
    fireEvent.change(within(firstEditor).getByLabelText('下一步'), {
      target: { value: 'continue' },
    });
    fireEvent.click(within(firstEditor).getByRole('button', { name: '保存记录' }));
    await screen.findByText('结果已保存');

    expect(screen.getByRole('button', { name: '继续记录' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /待检视/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '继续记录' }));
    const secondEditor = screen.getByRole('dialog', { name: '行动记录' });
    expect(within(secondEditor).getByText('所属目标 · 爬十座山')).toBeTruthy();
    expect(within(secondEditor).getByRole('button', { name: '‹ 返回践行' })).toBeTruthy();
    fireEvent.change(within(secondEditor).getByLabelText('实际发生了什么（可选）'), {
      target: { value: '第三次练习也完成了' },
    });
    fireEvent.click(within(secondEditor).getByRole('button', { name: '保存记录' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await waitFor(async () => {
      const snapshot = await readFutureSnapshot();
      expect(snapshot.actions.find((item) => item.id === action.id)?.status).toBe('completed');
      expect(
        snapshot.state.practiceRecords.filter((item) => item.actionId === action.id),
      ).toHaveLength(2);
      expect(snapshot.state.events).toEqual([]);
    });
    expect(screen.getByText('已完成两次练习')).toBeTruthy();
    expect(screen.getByText('第三次练习也完成了')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续记录' })).toBeNull();
  });
});
