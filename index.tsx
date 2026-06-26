import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import * as Sentry from '@sentry/react';
import { initWebVitalsReporter } from './lib/vitals';
import { registerVectorServiceWorker } from './lib/pwaRegister';

const SENTRY_REDACT_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|api|access|secret|bearer)[\s_:=-]+[A-Za-z0-9._\-+/=]{12,}/gi,
  /Bearer\s+[A-Za-z0-9._\-+/=]{12,}/gi,
  /\b[A-Za-z0-9+/=]{120,}\b/g,
];

const scrubText = (input: string): string => {
  let next = input;
  for (const pattern of SENTRY_REDACT_PATTERNS) {
    next = next.replace(pattern, '[REDACTED]');
  }
  return next;
};

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Phase 4 §W1.5 — release matches the SHA the CI sentry-cli step
    // uploaded sourcemaps under, so Sentry can de-minify stack traces
    // automatically. Falls back to undefined (Sentry's own auto-detect)
    // if the build didn't set the env var.
    release: process.env.SENTRY_RELEASE || undefined,
    environment:
      process.env.SENTRY_ENV ||
      (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      if (event.message) event.message = scrubText(event.message);
      if (event.exception?.values) {
        for (const value of event.exception.values) {
          if (value?.value) value.value = scrubText(value.value);
        }
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb?.message) breadcrumb.message = scrubText(breadcrumb.message);
      return breadcrumb;
    },
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

// Phase 2 §2.m — start collecting Core Web Vitals after Sentry has had a
// chance to init. The reporter is a no-op when Sentry is disabled, so
// this is safe to call unconditionally.
initWebVitalsReporter();

// W3.2 — register the PWA service worker. No-ops in dev (unless
// VITE_PWA_DEV=1) and in environments without serviceWorker support.
registerVectorServiceWorker();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
