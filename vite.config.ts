import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devPort = Number(env.VITE_DEV_PORT || env.PORT || 3000);
  const hmrPort = Number(env.VITE_HMR_PORT || 24678);
  return {
    server: {
      port: Number.isFinite(devPort) ? devPort : 3000,
      host: env.VITE_DEV_HOST || '127.0.0.1',
      hmr: {
        port: Number.isFinite(hmrPort) ? hmrPort : 24678,
      },
    },
    build: {
      // Phase 4 §W1.5 — emit hidden sourcemaps so the CI Sentry upload
      // step has them, but no `//# sourceMappingURL=...` comment is
      // appended to the JS bundles. The map files themselves are
      // deleted from `dist/` after upload (see
      // `.github/workflows/ci.yml`) so the deployed static assets
      // don't expose them publicly.
      sourcemap: 'hidden',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
              return 'pdf';
            }

            if (id.includes('motion')) {
              return 'motion';
            }

            if (id.includes('lucide-react')) {
              return 'icons';
            }

            if (id.includes('zustand') || id.includes('@tanstack/react-virtual')) {
              return 'data';
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'react';
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      // Phase 4.5 §D — hoist the bundled `<link rel="stylesheet">`
      // to ABOVE the `<script type="module">` tag in <head>. Vite
      // default emits the stylesheet AFTER the entry script +
      // every `<link rel="modulepreload">`, which can push the
      // render-blocking CSS dispatch past the FCP critical path
      // on slow networks. Moving the stylesheet up lets the
      // browser's preload scanner see it first and prioritise
      // the request.
      //
      // Behaviour: no-op when no production `<link rel="stylesheet">`
      // is present (e.g. the dev server, where HMR injects CSS
      // via JS).
      {
        name: 'vector-hoist-stylesheet',
        enforce: 'post',
        transformIndexHtml(html) {
          const styleLinkRe = /<link rel="stylesheet"[^>]*>/;
          const styleLinkMatch = html.match(styleLinkRe);
          if (!styleLinkMatch) return html;
          const styleLink = styleLinkMatch[0];
          // Remove the original occurrence (and a trailing newline
          // if any) and re-insert directly before the entry script.
          const withoutOriginal = html.replace(
            new RegExp(`\\n?\\s*${styleLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
            '',
          );
          return withoutOriginal.replace(
            /(<script type="module"[^>]*><\/script>)/,
            `${styleLink}\n    $1`,
          );
        },
      },
      // Phase 4 §W3.2 — PWA service worker via Workbox.
      //
      // Strategy: precache the app shell (every hashed JS/CSS asset
      // emitted by Vite + the icons + manifest) and runtime-cache the
      // OpenRouter / Gemini upstream responses with a network-first
      // policy. The buffered + streaming Morning Star endpoints stay
      // network-first because:
      //   - The output is JSON the user reasonably expects to be fresh
      //   - SSE responses must NOT be cached (would reread stale tokens)
      //
      // `registerType: 'prompt'` opens the door for an "update available"
      // banner later without forcing every user to reload silently the
      // moment a new build ships. We don't render that banner yet —
      // Workbox calls `useRegisterSW` from the existing PWA install
      // banner hook so adding the prompt is a one-liner when we're
      // ready.
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        // We already have a hand-crafted manifest.json checked in
        // alongside richer iconography; keep it as the source of truth
        // so the plugin doesn't generate a competing one.
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff,woff2}'],
          // Don't precache .map files (we already strip them post-build
          // for production but local dev shouldn't pre-cache them either).
          globIgnores: ['**/*.map'],
          // Default 2 MiB is too small for the pdf.js + react chunks.
          // Bump to 4 MiB so warmstart actually works without warnings.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // SPA fallback: serve index.html for any in-app navigation
          // request the SW intercepts (so the app shell renders even
          // when offline + the user clicks a deep link).
          navigateFallback: '/index.html',
          // Don't try to fallback to the SPA shell for /api/* requests
          // — those need to fail fast so the React layer can surface
          // an offline state instead of getting a fake 200.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            // Same-origin static assets the dev server / SSR might
            // produce (the precache covers most production assets).
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'vector-static-assets',
                expiration: {
                  maxEntries: 64,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            // OpenRouter + Gemini are NEVER cached — fresh tokens.
            // Listed explicitly so any future runtime-cache regression
            // doesn't accidentally start serving stale AI responses.
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith('openrouter.ai') || url.hostname.endsWith('googleapis.com'),
              handler: 'NetworkOnly',
              options: { cacheName: 'vector-ai-no-cache' },
            },
            // Same-origin /api/* — network-first with a tight 5 s
            // timeout so flaky networks fall back to the cached body
            // (if any) instead of hanging the request.
            {
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'vector-api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
          ],
        },
        devOptions: {
          // Disabled by default — registering a SW in dev confuses HMR
          // and causes hard-to-debug stale-asset warnings. Set
          // `VITE_PWA_DEV=1` to opt in for manual offline testing.
          enabled: process.env.VITE_PWA_DEV === '1',
          type: 'module',
        },
      }),
    ],
    define: {
      'process.env.API_KEY': 'undefined',
      'process.env.GEMINI_API_KEY': 'undefined',
      'process.env.SENTRY_DSN': JSON.stringify(env.SENTRY_DSN || ''),
      // Phase 4 §W1.5 — surface the Sentry release tag (typically the
      // commit SHA injected by CI) so the runtime SDK can match
      // exceptions to the sourcemaps the CI step uploaded.
      // Reads from process.env (NOT vite's loadEnv) because CI sets
      // these as workflow `env:` vars, not via .env files.
      'process.env.SENTRY_RELEASE': JSON.stringify(
        process.env.SENTRY_RELEASE || process.env.GITHUB_SHA || process.env.COMMIT_SHA || '',
      ),
      'process.env.SENTRY_ENV': JSON.stringify(
        process.env.SENTRY_ENV || (mode === 'production' ? 'production' : 'development'),
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
