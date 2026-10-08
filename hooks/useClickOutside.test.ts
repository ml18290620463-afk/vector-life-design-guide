import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClickOutside } from './useClickOutside';

describe('useClickOutside', () => {
  it('does not fire when disabled even on outside clicks', () => {
    const onOutside = vi.fn();
    renderHook(() => useClickOutside(false, onOutside));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it('fires onOutside when a mousedown happens outside the ref element', () => {
    const onOutside = vi.fn();
    const inside = document.createElement('div');
    document.body.appendChild(inside);
    const { result } = renderHook(() => useClickOutside<HTMLDivElement>(true, onOutside));
    act(() => {
      result.current.current = inside;
    });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutside).toHaveBeenCalledTimes(1);
    document.body.removeChild(inside);
    document.body.removeChild(outside);
  });

  it('does NOT fire when a mousedown lands inside the ref element', () => {
    const onOutside = vi.fn();
    const inside = document.createElement('div');
    const child = document.createElement('button');
    inside.appendChild(child);
    document.body.appendChild(inside);
    const { result } = renderHook(() => useClickOutside<HTMLDivElement>(true, onOutside));
    act(() => {
      result.current.current = inside;
    });
    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutside).not.toHaveBeenCalled();
    document.body.removeChild(inside);
  });

  it('fires onOutside when the user presses Escape (regardless of ref location)', () => {
    const onOutside = vi.fn();
    renderHook(() => useClickOutside(true, onOutside));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it('detaches its listeners when `enabled` flips back to false', () => {
    const onOutside = vi.fn();
    const { rerender } = renderHook(({ on }: { on: boolean }) => useClickOutside(on, onOutside), {
      initialProps: { on: true },
    });
    rerender({ on: false });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutside).not.toHaveBeenCalled();
  });
});
