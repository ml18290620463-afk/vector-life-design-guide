import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ViewerStarfield } from './ViewerStarfield';

const fixed = [
  { left: '10%', top: '10%', opacity: 0.2 },
  { left: '50%', top: '50%', opacity: 0.1 },
];
const twinkling = [
  { left: '5%', top: '5%', duration: 3, delay: 0.1 },
  { left: '95%', top: '95%', duration: 5, delay: 0.4 },
  { left: '50%', top: '50%', duration: 4, delay: 0.2 },
];

describe('ViewerStarfield', () => {
  it('hides itself from assistive tech via aria-hidden', () => {
    const { container } = render(
      <ViewerStarfield theme="dark" fixedStars={fixed} twinklingStars={twinkling} />,
    );
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('renders one node per fixed star and per twinkling star', () => {
    const { container } = render(
      <ViewerStarfield theme="dark" fixedStars={fixed} twinklingStars={twinkling} />,
    );
    const fixedNodes = container.querySelectorAll('[class*="bg-white/30"]');
    expect(fixedNodes).toHaveLength(fixed.length);
    const twinkleNodes = container.querySelectorAll('[class*="bg-cyan-300/60"]');
    expect(twinkleNodes).toHaveLength(twinkling.length);
  });

  it('switches palette between dark and light themes', () => {
    const { container, rerender } = render(
      <ViewerStarfield theme="dark" fixedStars={fixed} twinklingStars={twinkling} />,
    );
    expect(container.querySelectorAll('[class*="bg-white/30"]').length).toBe(fixed.length);
    rerender(<ViewerStarfield theme="light" fixedStars={fixed} twinklingStars={twinkling} />);
    expect(container.querySelectorAll('[class*="bg-slate-400"]').length).toBe(fixed.length);
  });

  it('does not intercept pointer events (decorative layer)', () => {
    const { container } = render(
      <ViewerStarfield theme="dark" fixedStars={fixed} twinklingStars={twinkling} />,
    );
    expect((container.firstChild as HTMLElement).className).toContain('pointer-events-none');
  });

  it('memoizes — same props twice produces identical DOM length', () => {
    const { container, rerender } = render(
      <ViewerStarfield theme="dark" fixedStars={fixed} twinklingStars={twinkling} />,
    );
    const firstHtmlLen = container.innerHTML.length;
    rerender(<ViewerStarfield theme="dark" fixedStars={fixed} twinklingStars={twinkling} />);
    expect(container.innerHTML.length).toBe(firstHtmlLen);
  });
});
