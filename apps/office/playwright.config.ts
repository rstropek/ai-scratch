import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './e2e/settings.ts';

const PORT = 3110;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // the production build, started like in the image
  webServer: {
    command: 'npm run build && node .next/standalone/apps/office/server.js',
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
    },
  },
});
