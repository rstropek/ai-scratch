import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { FAKE_ANTHROPIC_PORT, FAKE_IDENTITY } from './e2e/fake-anthropic.ts';
import { E2E_ADMIN, E2E_DATABASE_URL, E2E_OUTBOX } from './e2e/settings.ts';

const PORT = 3110;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    // answers the office's key checks instead of api.anthropic.com, and its federated ones instead of Azure
    {
      command: 'node e2e/fake-anthropic.ts',
      url: `http://localhost:${FAKE_ANTHROPIC_PORT}/healthz`,
      // never another process's server: anything else on the port would answer the key checks
      reuseExistingServer: false,
    },
    // the production build, started like in the image
    {
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
        MAIL_OUTBOX_DIR: E2E_OUTBOX,
        ADMIN_NOTIFY_EMAIL: E2E_ADMIN.email,
        // Cloudflare's dummy keys: the widget passes at once, siteverify accepts its token
        TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        JEV_DISABLED: '1',
        KEY_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
        ANTHROPIC_BASE_URL: `http://localhost:${FAKE_ANTHROPIC_PORT}`,
        // the managed identity as on App Service, its endpoint played by the fake Anthropic
        ANTHROPIC_FEDERATION_AUDIENCE: FAKE_IDENTITY.audience,
        ANTHROPIC_FEDERATION_CLIENT_ID: FAKE_IDENTITY.clientId,
        IDENTITY_ENDPOINT: FAKE_IDENTITY.endpoint,
        IDENTITY_HEADER: FAKE_IDENTITY.header,
      },
    },
  ],
});
