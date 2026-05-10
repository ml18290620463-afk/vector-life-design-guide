import * as Sentry from '@sentry/react';
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

/**
 * Subscribe to Core Web Vitals (`LCP`, `INP`, `CLS`) plus the supporting
 * load-timing signals (`FCP`, `TTFB`) and forward them to Sentry as
 * **time-series distributions**, not as `captureMessage` log lines.
 *
 * Why distributions:
 *  - `Sentry.captureMessage` produces an Issue per call, which gets
 *    aggressively sampled and rate-limited. After ~1k events the SDK
 *    silently starts dropping — bad signal-to-noise for a per-pageview
 *    beacon.
 *  - `Sentry.metrics.distribution()` writes to the metrics endpoint
 *    where the backend computes P50 / P75 / P95 / P99 server-side,
 *    plots them on the Performance dashboard out of the box, and
 *    supports threshold-based alerting (LCP P75 > 2.5s, INP P75 >
 *    200ms, CLS P75 > 0.1).
 *
 * The forwarder is a no-op when Sentry has not been initialised
 * (i.e. `SENTRY_DSN` was empty at build time), so we never emit
 * orphan beacons.
 *
 * Phase 4 §W1.2 (formerly §3.f-2) — see ROADMAP "关键信息 / 不可妥协项 #5".
 */

const VITAL_UNITS: Record<string, 'millisecond' | 'none'> = {
  LCP: 'millisecond',
  INP: 'millisecond',
  FCP: 'millisecond',
  TTFB: 'millisecond',
  CLS: 'none',
};

const sentryActive = (): boolean => {
  try {
    return Boolean(Sentry.getClient?.());
  } catch {
    return false;
  }
};

const reportMetric = (metric: Metric): void => {
  if (!sentryActive()) return;
  try {
    const unit = VITAL_UNITS[metric.name] ?? 'none';
    // Distributions land on Sentry's metrics endpoint and the backend
    // computes percentiles + plots time-series automatically. The unit
    // hint lets the UI label the axis correctly (ms vs unitless for
    // CLS).
    //
    // `attributes` is the v10 SDK shape for low-cardinality slicing
    // dimensions (older docs show `tags`). Both rating and
    // navigation_type are bounded enums so dashboards can slice
    // without hitting Sentry's cardinality cap.
    Sentry.metrics.distribution(`webvitals.${metric.name.toLowerCase()}`, metric.value, {
      unit,
      attributes: {
        rating: metric.rating,
        navigation_type: metric.navigationType ?? 'unknown',
      },
    });
  } catch {
    // Reporting failures must never crash the app.
  }
};

/** Wires the web-vitals listeners. Call exactly once at app boot. */
export const initWebVitalsReporter = (): void => {
  if (typeof window === 'undefined') return;
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
};
