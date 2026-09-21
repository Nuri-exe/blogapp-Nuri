import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // The production bundle in both places. `ng serve` would run the
    // development configuration, where authEnabled is true — the write routes
    // would then redirect to /login instead of /blogs and the guard
    // assertions would fail locally while passing in CI. CI builds in an
    // earlier step, so only the local run needs the build chained on.
    command: process.env['CI'] ? 'npm run serve:e2e' : 'npm run build && npm run serve:e2e',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
  },
});
