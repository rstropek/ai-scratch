// Server entry point: `node src/server/main.ts` (Node runs the TypeScript directly).

import { createEntraTokenProvider } from '@ai-scratch/anthropic';
import { createDb, createPool } from '@ai-scratch/db';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig, loadDotEnv } from './config.ts';
import { createResendMail, logMail } from './warnings.ts';
import { createFileLogSink, noLogSink } from './wire-log.ts';

loadDotEnv();
const config = loadConfig();
const app = createApp({
  config,
  sink: config.logDir ? createFileLogSink(config.logDir) : noLogSink,
  db: config.database ? createDb(createPool()) : undefined,
  identityToken: config.federation && createEntraTokenProvider(config.federation),
  sendMail: config.resendApiKey ? createResendMail({ apiKey: config.resendApiKey, from: config.mailFrom }) : logMail,
});

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(
    `AI-Scratch on http://localhost:${port}, ${config.database ? 'codes from the database' : 'test codes only'}, ${config.logDir ? `call log in ${config.logDir}` : 'no call log'}`,
  );
});
