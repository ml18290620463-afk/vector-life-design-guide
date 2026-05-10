import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// All web-vitals listeners are mocked so each test can synchronously
// invoke the registered callback without relying on a real
// PerformanceObserver / browser timeline.
const callbacks: Record<string, ((m: unknown) => void) | undefined> = {};

vi.mock('web-vitals', () => ({
  onCLS: vi.fn((cb: (m: unknown) => void) => {
    callbacks.CLS = cb;
  }),
  onINP: vi.fn((cb: (m: unknown) => void) => {
    callbacks.INP = cb;
  }),
  onLCP: vi.fn((cb: (m: unknown) => void) => {
    callbacks.LCP = cb;
  }),
  onFCP: vi.fn((cb: (m: unknown) => void) => {
    callbacks.FCP = cb;
  }),
  onTTFB: vi.fn((cb: (m: unknown) => void) => {
    callbacks.TTFB = cb;
  }),
}));

const distributionMock = vi.fn();
const getClientMock = vi.fn();
vi.mock('@sentry/react', () => ({
  metrics: {
    distribution: (...args: unknown[]) => distributionMock(...args),
  },
  getClient: () => getClientMock(),
}));

import { initWebVitalsReporter } from './vitals';

describe('initWebVitalsReporter', () => {
  beforeEach(() => {
    distributionMock.mockReset();
    getClientMock.mockReset();
    Object.keys(callbacks).forEach((key) => delete callbacks[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to all five core/loading vitals', () => {
    initWebVitalsReporter();
    expect(callbacks.CLS).toBeTypeOf('function');
    expect(callbacks.INP).toBeTypeOf('function');
    expect(callbacks.LCP).toBeTypeOf('function');
    expect(callbacks.FCP).toBeTypeOf('function');
    expect(callbacks.TTFB).toBeTypeOf('function');
  });

  it('skips emission when Sentry has not been initialised', () => {
    getClientMock.mockReturnValue(undefined);
    initWebVitalsReporter();
    callbacks.LCP?.({ name: 'LCP', value: 1234, rating: 'good', navigationType: 'navigate' });
    expect(distributionMock).not.toHaveBeenCalled();
  });

  it('reports millisecond-unit distribution for LCP/INP/FCP/TTFB', () => {
    getClientMock.mockReturnValue({});
    initWebVitalsReporter();
    callbacks.LCP?.({ name: 'LCP', value: 1234, rating: 'good', navigationType: 'navigate' });
    expect(distributionMock).toHaveBeenCalledWith(
      'webvitals.lcp',
      1234,
      expect.objectContaining({
        unit: 'millisecond',
        attributes: { rating: 'good', navigation_type: 'navigate' },
      }),
    );
  });

  it('reports unit "none" for CLS (CLS is unitless)', () => {
    getClientMock.mockReturnValue({});
    initWebVitalsReporter();
    callbacks.CLS?.({
      name: 'CLS',
      value: 0.0345,
      rating: 'needs-improvement',
      navigationType: 'navigate',
    });
    expect(distributionMock).toHaveBeenCalledWith(
      'webvitals.cls',
      0.0345,
      expect.objectContaining({
        unit: 'none',
        attributes: { rating: 'needs-improvement', navigation_type: 'navigate' },
      }),
    );
  });

  it('falls back to "unknown" navigation_type when missing', () => {
    getClientMock.mockReturnValue({});
    initWebVitalsReporter();
    callbacks.INP?.({ name: 'INP', value: 250, rating: 'poor' });
    expect(distributionMock).toHaveBeenCalledWith(
      'webvitals.inp',
      250,
      expect.objectContaining({
        attributes: { rating: 'poor', navigation_type: 'unknown' },
      }),
    );
  });

  it('never throws even if Sentry.metrics.distribution itself errors', () => {
    getClientMock.mockReturnValue({});
    distributionMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    initWebVitalsReporter();
    expect(() =>
      callbacks.LCP?.({ name: 'LCP', value: 1, rating: 'good', navigationType: 'navigate' }),
    ).not.toThrow();
  });
});
