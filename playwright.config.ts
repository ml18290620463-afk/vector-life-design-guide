import { defineConfig, devices } from '@playwright/test';

process.env.NO_PROXY = [process.env.NO_PROXY, '127.0.0.1', 'localhost'].filter(Boolean).join(',');

const port = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    // Phase 3 §3.f visual regression baselines. We pin the diff
    // tolerance to 2 % pixels so subpixel font rendering between
    // macOS / Linux CI doesn't trip the suite while still catching
    // any layout / colour regression. Per-test overrides
    // (`maxDiffPixelRatio: 0.05` etc.) are still allowed.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `PORT=${port} HOST=127.0.0.1 VITE_DEV_PORT=${port} VITE_DEV_HOST=127.0.0.1 VITE_HMR_PORT=${port + 1} npm run dev`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
