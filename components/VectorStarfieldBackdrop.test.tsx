import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return { ...actual, useReducedMotion: () => false };
});

import { VectorSeededStarfieldBackdrop, VectorStarfieldLayer } from './VectorStarfieldBackdrop';

const fixedStars = [
  { left: '10%', top: '20%', opacity: 0.2 },
  { left: '30%', top: '40%', opacity: 0.3 },
];

const twinklingStars = [
  { left: '15%', top: '25%', duration: 3, delay: 0 },
  { left: '35%', top: '45%', duration: 4, delay: 0.2 },
  { left: '55%', top: '65%', duration: 5, delay: 0.4 },
];

describe('VectorStarfieldLayer', () => {
  it('renders supplied fixed and twinkling stars as a hidden decorative layer', () => {
    const { container } = render(
      <VectorStarfieldLayer
        theme="dark"
        fixedStars={fixedStars}
        twinklingStars={twinklingStars}
        className="absolute inset-0"
      />,
    );

    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
    expect((container.firstChild as HTMLElement).className).toContain('pointer-events-none');
    expect(container.querySelectorAll('[class*="bg-white/40"]')).toHaveLength(fixedStars.length);
    expect(container.querySelectorAll('[class*="bg-cyan-300"]')).toHaveLength(twinklingStars.length);
  });
});

describe('VectorSeededStarfieldBackdrop', () => {
  it('generates stable seeded stars with caller-defined counts', () => {
    const { container, rerender } = render(
      <VectorSeededStarfieldBackdrop theme="dark" seed="unit-test" fixedCount={7} twinklingCount={3} />,
    );

    const firstHtml = container.innerHTML;
    expect(container.querySelectorAll('[class*="bg-white/40"]')).toHaveLength(7);
    expect(container.querySelectorAll('[class*="bg-cyan-300"]')).toHaveLength(3);

    rerender(<VectorSeededStarfieldBackdrop theme="dark" seed="unit-test" fixedCount={7} twinklingCount={3} />);
    expect(container.innerHTML).toBe(firstHtml);
  });

  it('uses the shared light palette', () => {
    const { container } = render(
      <VectorSeededStarfieldBackdrop theme="light" seed="unit-test-light" fixedCount={4} twinklingCount={2} />,
    );

    expect(container.querySelectorAll('[class*="bg-slate-400"]')).toHaveLength(4);
    expect(container.querySelectorAll('[class*="bg-cyan-600"]')).toHaveLength(2);
  });
});
