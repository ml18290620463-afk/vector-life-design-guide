import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Stub `useReducedMotion` so the test doesn't depend on the happy-dom
// matchMedia shim — both code paths (animated / static) are covered
// explicitly below.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return { ...actual, useReducedMotion: () => false };
});

import { MasterLockBackdrop } from './MasterLockBackdrop';

describe('MasterLockBackdrop', () => {
  it('hides itself from assistive tech via aria-hidden', () => {
    const { container } = render(<MasterLockBackdrop theme="dark" />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('does not intercept pointer events (purely decorative)', () => {
    const { container } = render(<MasterLockBackdrop theme="dark" />);
    expect((container.firstChild as HTMLElement).className).toContain('pointer-events-none');
  });

  it('renders 60 fixed stars and 20 twinkling stars regardless of theme', () => {
    const { container, rerender } = render(<MasterLockBackdrop theme="dark" />);
    const fixed = container.querySelectorAll('[class*="bg-white/40"]');
    const twinkling = container.querySelectorAll('[class*="bg-cyan-300"]');
    expect(fixed.length).toBe(60);
    expect(twinkling.length).toBe(20);

    rerender(<MasterLockBackdrop theme="light" />);
    expect(container.querySelectorAll('[class*="bg-slate-400"]').length).toBe(60);
    expect(container.querySelectorAll('[class*="bg-cyan-600"]').length).toBe(20);
  });

  it('keeps star positions stable across re-renders (seeded RNG)', () => {
    const { container, rerender } = render(<MasterLockBackdrop theme="dark" />);
    const firstHtml = container.innerHTML;
    rerender(<MasterLockBackdrop theme="dark" />);
    expect(container.innerHTML).toBe(firstHtml);
  });
});

describe('MasterLockBackdrop with reduced motion', () => {
  it('still renders the same number of stars but skips animation drivers', async () => {
    vi.resetModules();
    vi.doMock('motion/react', async () => {
      const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
      return { ...actual, useReducedMotion: () => true };
    });
    const { MasterLockBackdrop: Reduced } = await import('./MasterLockBackdrop');
    const { container } = render(<Reduced theme="dark" />);
    const twinkling = container.querySelectorAll('[class*="bg-cyan-300"]');
    expect(twinkling.length).toBe(20);
    vi.doUnmock('motion/react');
  });
});
