import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ArchiveVaultBackground } from './ArchiveVaultBackground';

describe('ArchiveVaultBackground', () => {
  it('hides itself from assistive tech via aria-hidden on the wrapper', () => {
    const { container } = render(<ArchiveVaultBackground theme="dark" />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('renders three floating bubble decorations', () => {
    const { container } = render(<ArchiveVaultBackground theme="dark" />);
    const bubbles = container.querySelectorAll('.absolute.rounded-full');
    expect(bubbles.length).toBe(3);
  });

  it('renders the two matrix-style data-rain gradient lines', () => {
    const { container } = render(<ArchiveVaultBackground theme="dark" />);
    const matrixLines = container.querySelectorAll('.absolute.top-0.w-\\[1px\\].h-full');
    expect(matrixLines.length).toBe(2);
  });

  it('switches the radial gradient between dark and light themes', () => {
    const { container, rerender } = render(<ArchiveVaultBackground theme="dark" />);
    // Phase 3 §3.a-2: rgba literals replaced by `color-mix()` over CSS
    // vars. The dark gradient now references slate-900 at 80 %, the
    // light gradient references white at 80 %.
    expect(container.innerHTML).toContain('color-mix(in_srgb,_var(--color-slate-900)_80%');
    rerender(<ArchiveVaultBackground theme="light" />);
    expect(container.innerHTML).toContain('color-mix(in_srgb,_white_80%');
  });

  it('memoises — same theme twice produces identical DOM length', () => {
    const { container, rerender } = render(<ArchiveVaultBackground theme="dark" />);
    const before = container.innerHTML.length;
    rerender(<ArchiveVaultBackground theme="dark" />);
    expect(container.innerHTML.length).toBe(before);
  });
});
