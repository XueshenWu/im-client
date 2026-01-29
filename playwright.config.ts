import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Electron tests need sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Electron tests should run one at a time
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    // Web-only tests (renderer against Vite dev server)
    {
      name: 'web',
      testMatch: /app\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    // Full Electron tests (main + renderer)
    {
      name: 'electron',
      testMatch: /electron\.spec\.ts/,
      use: {
        // No browser needed - Playwright launches Electron directly
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Only start for web project
    ignoreHTTPSErrors: true,
  },
});
