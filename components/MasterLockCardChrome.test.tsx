import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MasterLockCardChrome } from './MasterLockCardChrome';

describe('MasterLockCardChrome', () => {
  it('hides itself from assistive tech via aria-hidden', () => {
    const { container } = render(<MasterLockCardChrome theme="dark" />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('renders all four cyber corner accents', () => {
    const { container } = render(<MasterLockCardChrome theme="dark" />);
    // Each corner has a unique combination of border-{l,r}-2 + border-{t,b}-2.
    const corners = [
      container.querySelector('.absolute.top-0.left-0.w-4.h-4.border-l-2.border-t-2'),
      container.querySelector('.absolute.top-0.right-0.w-4.h-4.border-r-2.border-t-2'),
      container.querySelector('.absolute.bottom-0.left-0.w-4.h-4.border-l-2.border-b-2'),
      container.querySelector('.absolute.bottom-0.right-0.w-4.h-4.border-r-2.border-b-2'),
    ];
    for (const corner of corners) {
      expect(corner).not.toBeNull();
    }
  });

  it('renders 10 twinkling stars (deterministic count)', () => {
    const { container } = render(<MasterLockCardChrome theme="dark" />);
    const stars = container.querySelectorAll('.absolute.w-0\\.5.h-0\\.5.bg-white.rounded-full');
    expect(stars.length).toBe(10);
  });

  it('renders the indigo halo only in the dark theme', () => {
    const { container, rerender } = render(<MasterLockCardChrome theme="dark" />);
    expect(container.querySelector('[class*="bg-indigo-500/20"]')).not.toBeNull();
    rerender(<MasterLockCardChrome theme="light" />);
    expect(container.querySelector('[class*="bg-indigo-500/20"]')).toBeNull();
  });

  it('switches the corner accent palette between themes', () => {
    const { container, rerender } = render(<MasterLockCardChrome theme="dark" />);
    expect(container.querySelector('.border-cyan-500\\/50')).not.toBeNull();
    rerender(<MasterLockCardChrome theme="light" />);
    expect(container.querySelector('.border-cyan-400')).not.toBeNull();
  });

  it('memoises — same theme twice produces identical DOM length', () => {
    const { container, rerender } = render(<MasterLockCardChrome theme="dark" />);
    const before = container.innerHTML.length;
    rerender(<MasterLockCardChrome theme="dark" />);
    expect(container.innerHTML.length).toBe(before);
  });
});
