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
      <TagSelectPage
        draft={makeDraft()}
        setDraft={setDraft}
        onBack={onBack}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('开心'));
    fireEvent.click(screen.getByText('个人成长'));
    fireEvent.click(screen.getByText('确定'));

    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(makeDraft()).mood_tags).toEqual(['开心']);
    expect(updater(makeDraft()).event_tags).toEqual(['个人成长']);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('persists custom anchors and selects them immediately', () => {
    vi.stubGlobal('prompt', vi.fn(() => '长期主义'));
    const setDraft = vi.fn();

    render(
      <TagSelectPage
        draft={makeDraft()}
        setDraft={setDraft}
        onBack={vi.fn()}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('开心'));
    fireEvent.click(screen.getByText(/自定义锚点/));
    fireEvent.click(screen.getByText('确定'));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customAnchors) ?? '[]')).toEqual([
      '长期主义',
    ]);
    const updater = setDraft.mock.calls[0][0] as (draft: NowDraft) => NowDraft;
    expect(updater(makeDraft()).event_tags).toEqual(['长期主义']);
  });

  it('shows a toast when custom anchor length is invalid', () => {
    vi.stubGlobal('prompt', vi.fn(() => '长'));
    const showToast = vi.fn();

    render(
      <TagSelectPage
        draft={makeDraft()}
        setDraft={vi.fn()}
        onBack={vi.fn()}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByText(/自定义锚点/));

    expect(showToast).toHaveBeenCalledWith('自定义锚点需为 2～12 字');
  });
});
