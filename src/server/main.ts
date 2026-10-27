// Server entry point: `node src/server/main.ts` (Node runs the TypeScript directly).

import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig, loadDotEnv } from './config.ts';
import { createFileLogSink, noLogSink } from './wire-log.ts';

loadDotEnv();
const config = loadConfig();
const app = createApp({ config, sink: config.logDir ? createFileLogSink(config.logDir) : noLogSink });

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(
    `Digiferien KI-Scratch on http://localhost:${port}, ${config.logDir ? `call log in ${config.logDir}` : 'no call log'}`,
  );
});
