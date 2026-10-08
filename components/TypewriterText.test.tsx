import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TypewriterText } from './TypewriterText';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TypewriterText', () => {
  it('renders nothing initially and reveals one character per tick', () => {
    render(<TypewriterText text="hi!" speed={10} />);
    expect(screen.queryByText(/hi!/)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByText('h')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByText('hi')).toBeTruthy();
  });

  it('eventually renders the full text and stops when complete', () => {
    render(<TypewriterText text="abcd" speed={5} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText('abcd')).toBeTruthy();
  });

  it('preserves whitespace via the whitespace-pre-wrap class', () => {
    const { container } = render(<TypewriterText text="a b" speed={1} />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('whitespace-pre-wrap');
  });

  it('honours custom className alongside the default whitespace class', () => {
    const { container } = render(<TypewriterText text="x" className="custom" speed={1} />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom');
    expect(div.className).toContain('whitespace-pre-wrap');
  });

  it('restarts cleanly when the text prop changes', () => {
    const { rerender } = render(<TypewriterText text="aaa" speed={5} />);
    act(() => {
      vi.advanceTimersByTime(15);
    });
    expect(screen.getByText('aaa')).toBeTruthy();
    rerender(<TypewriterText text="bbb" speed={5} />);
    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(screen.getByText('b')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(15);
    });
    expect(screen.getByText('bbb')).toBeTruthy();
  });
});
