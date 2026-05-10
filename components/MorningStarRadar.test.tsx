import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MorningStarRadar } from './MorningStarRadar';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const fullMetrics = {
  rationality: 7,
  emotionality: 8,
  futureFocus: 6,
  selfReflection: 9,
  resilience: 5,
};

describe('MorningStarRadar', () => {
  it('renders one labelled axis per dimension (5 axes)', () => {
    const { container } = render(<MorningStarRadar metrics={fullMetrics} t={t} theme="dark" />);
    // Axis labels (one per dimension) are rendered twice — once around
    // the radar SVG, once in the side bar — so we expect at least 5
    // unique label strings.
    const labels = [t.rationality, t.emotionality, t.futureFocus, t.selfReflection, t.resilience];
    for (const label of labels) {
      const matches = container.querySelectorAll(`*`);
      const found = Array.from(matches).some((el) => el.textContent?.includes(label));
      expect(found).toBe(true);
    }
  });

  it('draws 5 concentric reference rings inside the SVG', () => {
    const { container } = render(<MorningStarRadar metrics={fullMetrics} t={t} theme="dark" />);
    const circles = container.querySelectorAll('svg circle');
    // 5 concentric tick rings + 5 vertex dots = 10 circles total.
    expect(circles.length).toBeGreaterThanOrEqual(5);
  });

  it('falls back to 0 for any dimension missing from the metrics map', () => {
    const partial = { rationality: 7 };
    const { container } = render(<MorningStarRadar metrics={partial} t={t} theme="dark" />);
    // The numeric chip beside each axis label renders the metric value;
    // four of them should be "0" when only `rationality` is supplied.
    const zeroes = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent === '0',
    );
    expect(zeroes.length).toBeGreaterThanOrEqual(4);
  });

  it('switches palette between light and dark themes (axis stroke colour)', () => {
    const { container, rerender } = render(
      <MorningStarRadar metrics={fullMetrics} t={t} theme="dark" />,
    );
    const darkPolygon = container.querySelector('polygon');
    expect(darkPolygon?.getAttribute('stroke')).toBe('var(--color-vector-cyan-pure)');
    rerender(<MorningStarRadar metrics={fullMetrics} t={t} theme="light" />);
    const lightPolygon = container.querySelector('polygon');
    expect(lightPolygon?.getAttribute('stroke')).toBe('var(--color-vector-cyan-brand)');
  });

  it('renders one progress bar per dimension in the side panel (5 bars)', () => {
    const { container } = render(<MorningStarRadar metrics={fullMetrics} t={t} theme="dark" />);
    const bars = container.querySelectorAll('.h-1.rounded-full.overflow-hidden');
    expect(bars.length).toBe(5);
  });

  it('renders the "n/10" notation in each dimension row', () => {
    const { container } = render(<MorningStarRadar metrics={fullMetrics} t={t} theme="dark" />);
    const slash10 = Array.from(container.querySelectorAll('span')).filter((s) =>
      s.textContent?.endsWith('/10'),
    );
    expect(slash10.length).toBe(5);
    // Spot-check one specific value.
    expect(slash10.map((s) => s.textContent)).toContain('7/10');
    expect(slash10.map((s) => s.textContent)).toContain('5/10');
  });

  it('clamps values inside the polygon by mapping value/10 to a fraction of the radius', () => {
    // When all metrics are 10 the polygon should hit the rings; verify the
    // polygon attribute is non-empty and contains 5 coordinate pairs.
    const { container } = render(
      <MorningStarRadar
        metrics={{
          rationality: 10,
          emotionality: 10,
          futureFocus: 10,
          selfReflection: 10,
          resilience: 10,
        }}
        t={t}
        theme="dark"
      />,
    );
    const points = container.querySelector('polygon')?.getAttribute('points') ?? '';
    expect(points.split(' ').length).toBe(5);
    // Each "x,y" pair should contain a comma.
    for (const pair of points.split(' ')) {
      expect(pair).toContain(',');
    }
  });
});
