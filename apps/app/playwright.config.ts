import { defineConfig, devices } from '@playwright/test';

const PORT = 3012;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } }],
  // The production build, served like in production. /api/chat is mocked per test (page.route); the
  // dummy keys make sure a test without a mock can never call (and pay for) the real model.
  webServer: {
    command: 'npm run build && node src/server/main.ts',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      ACCESS_CODES: 'e2e',
      ANTHROPIC_API_KEY: 'e2e-no-real-calls',
      JEV_API_KEY: 'e2e-no-real-calls',
      // a key typed into the gate is never checked with the real OpenRouter (tests mock /api/access)
      OPENROUTER_URL: 'http://127.0.0.1:9/api/v1',
      LOG_DIR: 'test-results/logs',
    },
  },
});
