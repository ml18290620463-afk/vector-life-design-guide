import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // The vite-plugin-pwa virtual module is only available when the
      // pwa plugin is loaded in vite.config.ts; vitest doesn't load
      // that plugin, so we stub it here so `import('virtual:pwa-register')`
      // resolves to a deterministic no-op `registerSW`.
      'virtual:pwa-register': path.resolve(__dirname, 'lib/__mocks__/virtual-pwa-register.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test-setup/indexeddb.ts'],
    exclude: ['node_modules/**', 'dist/**', 'coverage/**', 'e2e/**', 'output/**'],
    env: {
      NODE_ENV: 'test',
      // Keep PBKDF2 fast in tests; production / browsers always run at the
      // 600k default unless an operator overrides it intentionally.
      VECTOR_PBKDF2_ITERATIONS: '100000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Coverage thresholds protect the regression budget. Raise them only
      // after adding meaningful tests for changed behavior.
      thresholds: {
        lines: 82,
        branches: 61,
      },
      // Don't measure declarative configuration / generated assets or e2e
      // entry points; they would otherwise drag the percentages down for
      // no actionable reason.
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'e2e/**',
        '**/*.config.{ts,js,mjs}',
        '**/*.d.ts',
        'vite-env.d.ts',
        'index.tsx',
        'i18n/**',
        'constants.ts',
        'metadata.json',
        'manifest.json',
        // Decorative / animation modules: hard to assert on without a
        // browser, low risk.
        'components/SpaceTimeBackground.tsx',
        'components/MemoryFragments.tsx',
        'components/DeepArchiveAnimation.tsx',
        'components/GeometricBoat.tsx',
        'components/CoverScreen.tsx',
        'lib/markdownSchemes.ts',
        // Phase 2 §2.g panels — pure presentation components extracted
        // from Viewer.tsx. Their branches are theme / animation-state
        // toggles best validated by axe-playwright + visual review; the
        // workflow logic lives in `useViewerAccess` and
        // `useMorningStarPipeline`, both of which carry their own ≥5
        // unit tests (see ROADMAP §跨阶段 "每拆 1 个文件先补 5 个单测").
        'components/ViewerSealedPanel.tsx',
        'components/ViewerReadingPanel.tsx',
        'components/ViewerStarfield.tsx',
      ],
    },
  },
});
