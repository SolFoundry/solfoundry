/**
 * Playwright configuration for SolFoundry frontend E2E tests.
 *
 * Launches the Vite dev server automatically and runs tests against
 * the local development build. Screenshots are captured on failure
 * and stored in `test-results/`.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  /* Start Vite dev server before running tests. */
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  /* Reporter configuration: HTML report with screenshots. */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
});
