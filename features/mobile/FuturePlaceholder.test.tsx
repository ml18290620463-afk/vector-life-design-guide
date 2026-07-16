import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FuturePlaceholder } from './FuturePlaceholder';
import type { DiaryEntry, Principle } from '../../types';

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
});
