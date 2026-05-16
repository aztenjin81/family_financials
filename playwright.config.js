import { defineConfig } from '@playwright/test';

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH || '/usr/bin/google-chrome',
      args: isRoot ? ['--no-sandbox'] : [],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/playwright-server.mjs',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
