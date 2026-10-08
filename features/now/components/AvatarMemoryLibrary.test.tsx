import { clear } from 'idb-keyval';
import { readFutureSnapshot } from '../../../services/futureRepository';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AvatarMemoryLibrary } from './AvatarMemoryLibrary';
import type { AvatarAtomicMemory } from '../../avatar/types';
import {
  atomicMemoryFromUnderstanding,
  writeAvatarUnderstanding,
  readAvatarUnderstandings,
  readAvatarAtomicMemories,
  writeAvatarAtomicMemory,
} from '../../../services/avatarMemory';
import * as storage from '../../../services/browserStorage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it('keeps pending interpretations out of confirmed results and retains the dialog when saving fails', () => {
  const pattern = {
    id: 'pending',
    statement: '可能更喜欢独立工作',
    status: 'pending' as const,
    sourceEntryIds: ['locked'],
    createdAt: 1,
  };
  writeAvatarUnderstanding(pattern);
  const memory = atomicMemoryFromUnderstanding(pattern);
  memory.sourceRefs.push(
    { source: 'entry', id: 'locked', excerpt: '不可展示的旧原文' },
    { source: 'message', id: 'pattern-1', createdAt: Date.parse('2026-09-20T08:00:00Z') },
    { source: 'message', id: 'pattern-2', createdAt: Date.parse('2026-09-20T10:00:00Z') },
    { source: 'message', id: 'pattern-3', createdAt: Date.parse('2026-09-21T08:00:00Z') },
  );
  const refresh = vi.fn();
  const toast = vi.fn();
  render(
    <AvatarMemoryLibrary
      memories={[]}
      pendingMemories={[memory]}
      onRefresh={refresh}
      showToast={toast}
      onAdd={vi.fn()}
    />,
  );
  expect(screen.queryByText(pattern.statement)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '待确认 · 1' }));
  fireEvent.click(screen.getByRole('button', { name: pattern.statement }));
  expect(screen.queryByText(/不可展示的旧原文/)).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '记忆内容' }), {
    target: { value: '我喜欢协作' },
  });
  const failed = vi.spyOn(storage, 'setStoredJson').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '确认记住' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(toast).toHaveBeenCalledWith('保存失败，请重试');
  expect(refresh).not.toHaveBeenCalled();
  failed.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: '确认记住' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(readAvatarUnderstandings()[0]).toMatchObject({
    id: 'pending',
    statement: '我喜欢协作',
    status: 'confirmed',
  });
  expect(refresh).toHaveBeenCalledOnce();
});

it('confirms one direction candidate into the canonical action store', async () => {
  await clear();
  const memory = {
    id: 'direction-candidate',
    statement: '明天散步',
    nature: 'commitment' as const,
    facets: [],
    tags: [],
    contexts: [],
    sourceRefs: [{ source: 'message' as const, id: 'chat-1' }],
    confidence: 0.7,
    status: 'candidate' as const,
    sensitivity: 'normal' as const,
    createdAt: 1,
  };
  const refresh = vi.fn();
  render(
    <AvatarMemoryLibrary
      memories={[memory]}
      pendingMemories={[memory]}
      onRefresh={refresh}
      showToast={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '待确认 · 1' }));
  fireEvent.click(screen.getByRole('button', { name: memory.statement }));
  fireEvent.change(screen.getByRole('combobox', { name: '保存类型' }), {
    target: { value: 'action' },
  });
  fireEvent.click(screen.getByRole('button', { name: '确认记住' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const snapshot = await readFutureSnapshot();
  expect(snapshot.actions).toHaveLength(1);
  expect(snapshot.actions[0].title).toBe(memory.statement);
  expect(snapshot.state.archiveOrigins?.[memory.id]?.sourceRefs).toEqual(memory.sourceRefs);
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: '待确认 · 1' })).toBeNull();
  await clear();
});

it('filters about-me categories without duplicating multi-facet memories or hiding pending items', () => {
  const base = atomicMemoryFromUnderstanding({
    id: 'self-index',
    statement: '我偏好安静，也重视独立空间',
    status: 'confirmed',
    sourceEntryIds: [],
    createdAt: 1,
  });
  const preference = {
    ...base,
    id: 'self-preference',
    facets: ['preference', 'boundary'] as const,
  };
  const memory = { ...preference, facets: [...preference.facets] };
  const profile = {
    ...base,
    id: 'self-profile',
    statement: '我是一名设计师',
    nature: 'explicit' as const,
    category: 'profile' as const,
    facets: [],
  };
  const pending = {
    ...memory,
    id: 'pending-self',
    status: 'candidate' as const,
    statement: '待确认的偏好',
  };
  render(
    <AvatarMemoryLibrary
      memories={[memory, profile]}
      pendingMemories={[pending]}
      onRefresh={vi.fn()}
      showToast={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: memory.statement })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /偏好与边界/ }));
  expect(screen.getByRole('button', { name: memory.statement })).toBeTruthy();
  expect(screen.queryByRole('button', { name: profile.statement })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  fireEvent.click(screen.getByRole('button', { name: /基础与处境/ }));
  expect(screen.queryByRole('button', { name: memory.statement })).toBeNull();
  expect(screen.getByRole('button', { name: profile.statement })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '待确认 · 1' }));
  expect(screen.getByRole('button', { name: pending.statement })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: '关于我分类' })).toBeNull();
});

it('shows editable patterns without mirroring principles or future plans', () => {
  const makeMemory = (
    id: string,
    statement: string,
    source: 'pattern' | 'principle' | 'future' | 'action',
  ): AvatarAtomicMemory => ({
    id,
    statement,
    nature: 'explicit' as const,
    category: 'profile' as const,
    facets: [],
    tags: [],
    contexts: [],
    sourceRefs: [{ source, id: `${id}-source` }],
    confidence: 0.8,
    status: 'confirmed' as const,
    sensitivity: 'normal' as const,
    createdAt: 1,
  });
  const pattern = makeMemory('atomic_pattern_1', '我会在压力下先独自梳理问题', 'pattern');
  const principle = makeMemory('avatar_principle_1', '重要选择先留出一天思考', 'principle');
  const vision = makeMemory('avatar_vision_1', '愿景：建立稳定而自由的生活', 'future');
  const action = makeMemory('avatar_action_1', '本周完成作品集首页', 'action');
  render(
    <AvatarMemoryLibrary
      memories={[pattern, principle, vision, action]}
      onRefresh={vi.fn()}
      showToast={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '我的模式' }));
  fireEvent.click(screen.getByRole('button', { name: /理解与判断/ }));
  expect(screen.getByRole('button', { name: pattern.statement })).toBeTruthy();
  expect(screen.queryByText(principle.statement)).toBeNull();
  expect(screen.queryByText(vision.statement)).toBeNull();
  expect(screen.queryByText(action.statement)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: pattern.statement }));
  expect(screen.getByRole('button', { name: '调整表述' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '我的变化' }));
  fireEvent.click(screen.getByRole('button', { name: /认识更新/ }));
  expect(screen.getByText('暂无可对比的认识更新')).toBeTruthy();
  expect(screen.queryByText(pattern.statement)).toBeNull();
});

it('searches confirmed facts across drawers, excludes candidates and clears search on return and scope change', () => {
  const base = atomicMemoryFromUnderstanding({
    id: 'search-base',
    statement: '我喜欢安静工作',
    status: 'confirmed',
    sourceEntryIds: [],
    createdAt: 1,
  });
  const preference: AvatarAtomicMemory = {
    ...base,
    id: 'search-preference',
    nature: 'explicit',
    facets: ['preference'],
  };
  const profile: AvatarAtomicMemory = {
    ...base,
    id: 'search-profile',
    nature: 'explicit',
    category: 'profile',
    facets: [],
    statement: '我的工作是设计师',
  };
  const pending: AvatarAtomicMemory = {
    ...preference,
    id: 'search-pending',
    status: 'candidate',
    statement: '我喜欢远程工作',
  };
  render(
    <AvatarMemoryLibrary
      memories={[preference, profile]}
      pendingMemories={[pending]}
      onRefresh={vi.fn()}
      showToast={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: /偏好与边界/ }).textContent).toContain(
    preference.statement,
  );
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索记忆' }), {
    target: { value: '工作' },
  });
  expect(screen.getByRole('button', { name: preference.statement })).toBeTruthy();
  expect(screen.getByRole('button', { name: profile.statement })).toBeTruthy();
  expect(screen.queryByText(pending.statement)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('button', { name: /偏好与边界/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '工作' } });
  fireEvent.click(screen.getByRole('button', { name: '我的模式' }));
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('button', { name: preference.statement })).toBeNull();
});

it('shows concise evidence counts and lets a person confirm or set aside an interpretation', () => {
  const memory: AvatarAtomicMemory = {
    id: 'traceable-memory',
    statement: '我在复杂选择前会先独处整理判断',
    nature: 'inferred',
    category: 'judgment',
    facets: ['cognitive_pattern'],
    tags: [],
    contexts: [],
    sourceRefs: [
      { source: 'entry', id: 'entry-1', excerpt: '一次复杂的选择' },
      { source: 'message', id: 'message-1', excerpt: '我需要一点时间想清楚' },
    ],
    confidence: 0.8,
    status: 'confirmed',
    sensitivity: 'normal',
    createdAt: 1,
  };
  expect(writeAvatarAtomicMemory(memory)).toBe(true);
  const toast = vi.fn();
  render(
    <AvatarMemoryLibrary
      memories={[memory]}
      onRefresh={vi.fn()}
      showToast={toast}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '我的模式' }));
  fireEvent.click(screen.getByRole('button', { name: /理解与判断/ }));
  expect(screen.queryByText('基于 2 条依据')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: memory.statement }));
  expect(screen.queryByText('基于 2 条依据')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '准确' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(readAvatarAtomicMemories()[0]).toMatchObject({
    id: memory.id,
    status: 'confirmed',
    confirmedBy: 'user',
  });
  expect(toast).toHaveBeenCalledWith('记忆已更新');
});

it('sets aside an interpretation without deleting the original evidence', () => {
  const memory: AvatarAtomicMemory = {
    id: 'set-aside-memory',
    statement: '我总是在压力下拖延',
    nature: 'inferred',
    category: 'judgment',
    facets: ['cognitive_pattern'],
    tags: [],
    contexts: [],
    sourceRefs: [{ source: 'entry', id: 'entry-2', excerpt: '一次压力很大的项目' }],
    confidence: 0.6,
    status: 'confirmed',
    sensitivity: 'normal',
    createdAt: 1,
  };
  expect(writeAvatarAtomicMemory(memory)).toBe(true);
  render(
    <AvatarMemoryLibrary
      memories={[memory]}
      onRefresh={vi.fn()}
      showToast={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '我的模式' }));
  fireEvent.click(screen.getByRole('button', { name: /理解与判断/ }));
  fireEvent.click(screen.getByRole('button', { name: memory.statement }));
  fireEvent.click(screen.getByRole('button', { name: '暂不采用' }));
  expect(screen.getByText('分身将不再使用这条理解，原始记录和经历不会删除。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '暂不采用' }));
  expect(readAvatarAtomicMemories()[0]).toMatchObject({
    id: memory.id,
    status: 'rejected',
    sourceRefs: memory.sourceRefs,
  });
});

it('lets a person update a current state and then compare the dated prior wording in my changes', () => {
  const state: AvatarAtomicMemory = {
    id: 'state-role-before',
    statement: '我目前在杭州从事产品设计',
    nature: 'state',
    category: 'recent_state',
    facets: ['domain_background'],
    tags: [],
    contexts: [],
    sourceRefs: [{ source: 'message', id: 'state-chat-1' }],
    confidence: 1,
    status: 'confirmed',
    sensitivity: 'normal',
    createdAt: Date.parse('2026-09-01T08:00:00Z'),
    confirmedAt: Date.parse('2026-09-01T08:00:00Z'),
    confirmedBy: 'user',
  };
  expect(writeAvatarAtomicMemory(state)).toBe(true);
  const toast = vi.fn();
  const refresh = vi.fn();
  const { rerender } = render(
    <AvatarMemoryLibrary
      memories={[state]}
      historyMemories={[state]}
      onRefresh={refresh}
      showToast={toast}
      onAdd={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /基础与处境/ }));
  fireEvent.click(screen.getByRole('button', { name: state.statement }));
  expect(screen.getByText(/当前状态 · 最近更新于/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '仍适用' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '已经变化' }));
  fireEvent.change(screen.getByRole('textbox', { name: '记忆内容' }), {
    target: { value: '我目前在上海从事产品策略' },
  });
  fireEvent.click(screen.getByRole('button', { name: '确认更新' }));
  expect(toast).toHaveBeenCalledWith('已更新记忆，旧表述已归入我的变化');

  const history = readAvatarAtomicMemories();
  rerender(
    <AvatarMemoryLibrary
      memories={history}
      historyMemories={history}
      onRefresh={refresh}
      showToast={toast}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '我的变化' }));
  fireEvent.click(screen.getByRole('button', { name: /认识更新/ }));
  expect(screen.getByText('此前')).toBeTruthy();
  expect(screen.getByText(state.statement)).toBeTruthy();
  expect(screen.getByText('现在')).toBeTruthy();
  expect(screen.getByText('我目前在上海从事产品策略')).toBeTruthy();
});

it('revises a confirmed pattern cautiously and exposes its prior wording in my changes', () => {
  const pattern = {
    id: 'pattern-version-ui',
    statement: '面对压力时我会先独自整理',
    status: 'confirmed' as const,
    sourceEntryIds: ['entry-1', 'entry-2'],
    createdAt: Date.parse('2026-09-01T08:00:00Z'),
    confirmedAt: Date.parse('2026-09-01T08:00:00Z'),
    confirmedBy: 'user' as const,
    patternDomain: 'cognitive' as const,
  };
  expect(writeAvatarUnderstanding(pattern)).toBe(true);
  const toast = vi.fn();
  const refresh = vi.fn();
  const toPatternMemories = () =>
    readAvatarUnderstandings()
      .filter((item) => item.status === 'confirmed')
      .map(atomicMemoryFromUnderstanding);
  const { rerender } = render(
    <AvatarMemoryLibrary
      memories={toPatternMemories()}
      patterns={readAvatarUnderstandings()}
      onRefresh={refresh}
      showToast={toast}
      onAdd={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '我的模式' }));
  fireEvent.click(screen.getByRole('button', { name: /理解与判断/ }));
  fireEvent.click(screen.getByRole('button', { name: pattern.statement }));
  fireEvent.click(screen.getByRole('button', { name: '调整表述' }));
  expect(
    screen.getByText('只有当这个规律持续变化时再修订；一次情绪或事件更适合留在记录中。'),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: '记忆内容' }), {
    target: { value: '面对持续压力时我会先判断是否需要支持' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  expect(toast).toHaveBeenCalledWith('已更新模式，旧表述已归入我的变化');
  expect(refresh).toHaveBeenCalledOnce();

  rerender(
    <AvatarMemoryLibrary
      memories={toPatternMemories()}
      patterns={readAvatarUnderstandings()}
      onRefresh={refresh}
      showToast={toast}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '我的变化' }));
  fireEvent.click(screen.getByRole('button', { name: /认识更新/ }));
  expect(screen.getByText('此前')).toBeTruthy();
  expect(screen.getByText(pattern.statement)).toBeTruthy();
  expect(screen.getByText('现在')).toBeTruthy();
  expect(screen.getByText('面对持续压力时我会先判断是否需要支持')).toBeTruthy();
});

it('explains a retained pattern after its original experience was deleted without exposing unavailable evidence', () => {
  const retainedPattern = atomicMemoryFromUnderstanding({
    id: 'retained-pattern',
    statement: '我会在复杂选择前先留出独处时间',
    status: 'confirmed',
    sourceEntryIds: [],
    retainedAfterSourceDeletion: true,
    createdAt: 1,
    patternDomain: 'cognitive',
  });
  render(
    <AvatarMemoryLibrary
      memories={[retainedPattern]}
      onRefresh={vi.fn()}
      showToast={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '我的模式' }));
  fireEvent.click(screen.getByRole('button', { name: /理解与判断/ }));
  expect(screen.getByText('已保留 · 原始经历已删除')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(retainedPattern.statement) }));
  expect(
    screen.getByText('这条理解由你选择保留；原始经历已删除，因此不再显示经历依据。'),
  ).toBeTruthy();
  expect(screen.queryByText(/基于 \d+ 条依据/)).toBeNull();
  expect(screen.queryByText('查看依据')).toBeNull();
  expect(screen.getByRole('button', { name: '调整表述' })).toBeTruthy();
});
