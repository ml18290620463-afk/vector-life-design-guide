import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGuidingStarsEditor } from './useGuidingStarsEditor';

const baseArgs = (overrides: Partial<Parameters<typeof useGuidingStarsEditor>[0]> = {}) => ({
  guidingStars: ['Custom A'],
  selectedStars: [] as string[],
  language: 'zh' as const,
  showSettings: true,
  limitMessage: 'limit reached',
  onSaveGuidingStars: vi.fn(),
  onSaveSelectedStars: vi.fn(),
  ...overrides,
});

describe('useGuidingStarsEditor', () => {
  it('seeds tempDirectory with the persisted stars merged with the language defaults', () => {
    const { result } = renderHook(() => useGuidingStarsEditor(baseArgs()));
    expect(result.current.tempDirectory).toContain('Custom A');
    // No duplicates.
    expect(new Set(result.current.tempDirectory).size).toBe(result.current.tempDirectory.length);
  });

  it('toggleTempStar adds and removes within the maxSelected cap', () => {
    const { result } = renderHook(() => useGuidingStarsEditor(baseArgs({ maxSelected: 2 })));
    act(() => result.current.toggleTempStar('A'));
    act(() => result.current.toggleTempStar('B'));
    expect(result.current.tempSelected).toEqual(['A', 'B']);
    act(() => result.current.toggleTempStar('A'));
    expect(result.current.tempSelected).toEqual(['B']);
  });

  it('toggleTempStar past the cap leaves selection unchanged and notifies via onLimitExceeded', () => {
    const onLimitExceeded = vi.fn();
    const { result } = renderHook(() =>
      useGuidingStarsEditor(baseArgs({ maxSelected: 2, onLimitExceeded })),
    );
    act(() => result.current.toggleTempStar('A'));
    act(() => result.current.toggleTempStar('B'));
    act(() => result.current.toggleTempStar('C'));
    expect(result.current.tempSelected).toEqual(['A', 'B']);
    expect(onLimitExceeded).toHaveBeenCalledWith('limit reached');
  });

  it('handleAddCustomStar adds to both directory and selection when there is room, then clears the input', () => {
    const { result } = renderHook(() => useGuidingStarsEditor(baseArgs()));
    act(() => result.current.setCustomStarName('  Brand New  '));
    act(() => result.current.handleAddCustomStar());
    expect(result.current.tempDirectory).toContain('Brand New');
    expect(result.current.tempSelected).toContain('Brand New');
    expect(result.current.customStarName).toBe('');
  });

  it('handleDeleteCustomStar removes from both directory and selection', () => {
    const { result } = renderHook(() =>
      useGuidingStarsEditor(baseArgs({ guidingStars: ['Doomed'], selectedStars: ['Doomed'] })),
    );
    act(() => result.current.handleDeleteCustomStar('Doomed'));
    expect(result.current.tempDirectory).not.toContain('Doomed');
    expect(result.current.tempSelected).not.toContain('Doomed');
  });

  it('handleSaveStars persists the temp values via the supplied callbacks and exits edit mode', () => {
    const onSaveGuidingStars = vi.fn();
    const onSaveSelectedStars = vi.fn();
    const { result } = renderHook(() =>
      useGuidingStarsEditor(baseArgs({ onSaveGuidingStars, onSaveSelectedStars })),
    );
    act(() => result.current.setIsEditing(true));
    act(() => result.current.toggleTempStar('Picked'));
    act(() => result.current.handleSaveStars());
    expect(onSaveGuidingStars).toHaveBeenCalledWith(result.current.tempDirectory);
    expect(onSaveSelectedStars).toHaveBeenCalledWith(['Picked']);
    expect(result.current.isEditing).toBe(false);
  });

  it('closing the settings drawer (showSettings → false) discards an in-progress edit', () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useGuidingStarsEditor(baseArgs({ showSettings: open, selectedStars: ['Persisted'] })),
      { initialProps: { open: true } },
    );
    act(() => result.current.toggleTempStar('Draft'));
    expect(result.current.tempSelected).toContain('Draft');
    rerender({ open: false });
    expect(result.current.tempSelected).toEqual(['Persisted']);
    expect(result.current.isEditing).toBe(false);
  });
});
