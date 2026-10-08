import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewerStars } from './useViewerStars';

describe('useViewerStars', () => {
  it('returns the four star buckets at the documented sizes', () => {
    const { result } = renderHook(() => useViewerStars('entry-A'));
    expect(result.current.fixedStars).toHaveLength(80);
    expect(result.current.twinklingStars).toHaveLength(30);
    expect(result.current.rippleStars).toHaveLength(8);
    expect(result.current.decodedStars).toHaveLength(6);
  });

  it('is deterministic — same entryId yields the same coordinates twice', () => {
    const a = renderHook(() => useViewerStars('seed-1'));
    const b = renderHook(() => useViewerStars('seed-1'));
    expect(a.result.current.fixedStars[0]).toEqual(b.result.current.fixedStars[0]);
    expect(a.result.current.twinklingStars[5]).toEqual(b.result.current.twinklingStars[5]);
    expect(a.result.current.decodedStars).toEqual(b.result.current.decodedStars);
  });

  it('different entry ids produce different starfields', () => {
    const a = renderHook(() => useViewerStars('entry-A'));
    const b = renderHook(() => useViewerStars('entry-B'));
    expect(a.result.current.fixedStars).not.toEqual(b.result.current.fixedStars);
  });

  it('memoizes — re-rendering with the same id returns the same array reference', () => {
    const { result, rerender } = renderHook(({ id }: { id: string }) => useViewerStars(id), {
      initialProps: { id: 'stable' },
    });
    const before = result.current.fixedStars;
    rerender({ id: 'stable' });
    expect(result.current.fixedStars).toBe(before);
  });

  it('coords stay within the documented percentage ranges', () => {
    const { result } = renderHook(() => useViewerStars('range-check'));
    for (const star of result.current.fixedStars) {
      const left = parseFloat(star.left);
      const top = parseFloat(star.top);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(100);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(100);
      expect(star.opacity).toBeGreaterThanOrEqual(0);
      expect(star.opacity).toBeLessThanOrEqual(0.4);
    }
    for (const star of result.current.rippleStars) {
      const top = parseFloat(star.top);
      const right = parseFloat(star.right);
      expect(top).toBeGreaterThanOrEqual(10);
      expect(top).toBeLessThanOrEqual(50);
      expect(right).toBeGreaterThanOrEqual(10);
      expect(right).toBeLessThanOrEqual(50);
    }
  });
});
