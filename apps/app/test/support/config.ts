// The server's configuration for tests: test codes only (no database), fake hosts for Anthropic, OpenRouter and
// the Locker.
import { DEFAULT_LIMITS } from '@ai-scratch/db';
import type { Config } from '../../src/server/config.ts';

export const testConfig: Config = {
  port: 0,
  database: false,
  keyEncryptionKey: undefined,
  limits: DEFAULT_LIMITS,
  testCodes: new Set(['schule1', 'admin_test']),
  anthropicApiKey: 'test-key',
  anthropicWorkspaceId: 'ws-test',
  anthropicBaseUrl: 'https://anthropic.test',
  federation: undefined,
  resendApiKey: undefined,
  mailFrom: 'AI-Scratch <test@example.com>',
  model: 'claude-haiku-5-5',
  openRouterUrl: 'https://openrouter.test/api/v1',
  openRouterModel: 'anthropic/claude-haiku-5.5',
  effort: 'high',
  instructions: undefined,
  jevApiKey: 'jev-key',
  jevModel: 'jev-1.13.0',
  logDir: undefined,
  distDir: 'does-not-exist',
  version: 'abc123',
  lockerUrl: 'https://locker.test',
};
