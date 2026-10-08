import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TagSelectPage } from './TagSelectPage';
import { STORAGE_KEYS } from '../constants/config';
import type { NowDraft } from '../types/now';

const makeDraft = (overrides: Partial<NowDraft> = {}): NowDraft => ({
  text: '',
  materials: [],
  mood_tags: [],
  event_tags: [],
  record_time: '2026-07-09T10:30:00.000Z',
  display_time: '2026年7月9日10点30分',
  updated_at: '2026-07-09T10:30:00.000Z',
  ...overrides,
});

describe('TagSelectPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('selects mood and event tags before confirming into draft', () => {
    const setDraft = vi.fn();
    const onBack = vi.fn();

    render(
      <TagSelectPage draft={makeDraft()} setDraft={setDraft} onBack={onBack} showToast={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('开心'));
    fireEvent.click(screen.getByText('学习探索'));
    fireEvent.click(screen.getByText('确定'));

    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(makeDraft()).mood_tags).toEqual(['开心']);
    expect(updater(makeDraft()).event_tags).toEqual(['学习探索']);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows passive hints and preserves a historical tag when confirming', () => {
    const setDraft = vi.fn();
    const draft = makeDraft({ event_tags: ['自我实现'] });
    render(
      <TagSelectPage draft={draft} setDraft={setDraft} onBack={vi.fn()} showToast={vi.fn()} />,
    );
    expect(screen.getByText('居住 · 家务 · 出行')).not.toBeNull();
    expect(screen.getByRole('button', { name: '自我实现' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: '生活起居' }));
    fireEvent.click(screen.getByText('确定'));
    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(draft).event_tags).toEqual(['自我实现', '生活起居']);
  });

  it('persists custom anchors and selects them immediately', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => '长期主义'),
    );
    const setDraft = vi.fn();

    render(
      <TagSelectPage
        draft={makeDraft()}
        setDraft={setDraft}
        onBack={vi.fn()}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '为事件添加自定义锚点' }));
    fireEvent.click(screen.getByText('确定'));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customAnchors) ?? '[]')).toEqual([
      '长期主义',
    ]);
    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(makeDraft()).event_tags).toEqual(['长期主义']);
  });

  it('allows a custom mood anchor while keeping mood optional', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => '充满希望'),
    );
    const setDraft = vi.fn();

    render(
      <TagSelectPage
        draft={makeDraft()}
        setDraft={setDraft}
        onBack={vi.fn()}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '为心情添加自定义锚点' }));
    fireEvent.click(screen.getByText('学习探索'));
    fireEvent.click(screen.getByText('确定'));

    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(makeDraft()).mood_tags).toEqual(['充满希望']);
    expect(updater(makeDraft()).event_tags).toEqual(['学习探索']);
  });

  it('allows confirming without mood or event tags', () => {
    const setDraft = vi.fn();
    const onBack = vi.fn();
    const showToast = vi.fn();

    render(
      <TagSelectPage
        draft={makeDraft()}
        setDraft={setDraft}
        onBack={onBack}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText('确定'));
    expect(showToast).not.toHaveBeenCalled();
    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(makeDraft()).mood_tags).toEqual([]);
    expect(updater(makeDraft()).event_tags).toEqual([]);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a toast when custom anchor length is invalid', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => '长'),
    );
    const showToast = vi.fn();

    render(
      <TagSelectPage
        draft={makeDraft()}
        setDraft={vi.fn()}
        onBack={vi.fn()}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '为心情添加自定义锚点' }));

    expect(showToast).toHaveBeenCalledWith('自定义锚点需为 2～12 字');
  });
});
