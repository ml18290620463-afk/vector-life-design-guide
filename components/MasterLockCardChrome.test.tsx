import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MasterLockCardChrome } from './MasterLockCardChrome';

describe('MasterLockCardChrome', () => {
  it('hides itself from assistive tech via aria-hidden', () => {
    const { container } = render(<MasterLockCardChrome theme="dark" />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a layered set of fluid edge glints instead of mechanical corners', () => {
    const { container } = render(<MasterLockCardChrome theme="dark" />);
    const glints = container.querySelectorAll('[data-testid="fluid-glint"]');
    expect(glints).toHaveLength(5);
    expect(container.innerHTML).toContain('w-[42%]');
    expect(container.innerHTML).toContain('h-[46%]');
  });

  it('does not render the retired top-right animated stars', () => {
    const { container } = render(<MasterLockCardChrome theme="dark" />);
    const stars = container.querySelectorAll('.absolute.w-0\\.5.h-0\\.5.bg-white.rounded-full');
    expect(stars.length).toBe(0);
  });

  it('does not render the retired top-right indigo halo', () => {
    const { container, rerender } = render(<MasterLockCardChrome theme="dark" />);
    expect(container.querySelector('[class*="bg-indigo-500/20"]')).toBeNull();
    rerender(<MasterLockCardChrome theme="light" />);
    expect(container.querySelector('[class*="bg-indigo-500/20"]')).toBeNull();
  });

  it('switches the fluid glint palette between themes', () => {
    const { container, rerender } = render(<MasterLockCardChrome theme="dark" />);
    expect(container.innerHTML).toContain('border-cyan-200/40');
    rerender(<MasterLockCardChrome theme="light" />);
    expect(container.innerHTML).toContain('border-cyan-400/60');
  });

  it('memoises — same theme twice produces identical DOM length', () => {
    const { container, rerender } = render(<MasterLockCardChrome theme="dark" />);
    const before = container.innerHTML.length;
    rerender(<MasterLockCardChrome theme="dark" />);
    expect(container.innerHTML.length).toBe(before);
  });
});
