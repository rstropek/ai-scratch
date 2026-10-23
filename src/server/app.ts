// The Hono app: API routes + static files. Kept free of side effects so tests can call app.request().
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { requireAccessCode } from './access.ts';
import { createChatHandler } from './chat.ts';
import type { Config } from './config.ts';
import { createStats } from './stats.ts';
import type { LogSink } from './wire-log.ts';

export interface AppDeps {
  config: Config;
  sink: LogSink;
  /** the fetch the Anthropic provider uses (tests pass a fake) */
  fetch?: typeof fetch;
}

export const createApp = ({ config, sink, fetch }: AppDeps): Hono => {
  const stats = createStats();
  const app = new Hono();

  app.use('/api/*', requireAccessCode(config.accessCodes));
  app.post('/api/chat', createChatHandler({ config, sink, stats, fetch }));
  app.get('/api/stats', (c) => c.json(stats));
  app.all('/api/*', (c) => c.json({ error: 'Nicht gefunden' }, 404));

  // Production: the built host app, then the unmodified Scratch bundle, which must sit at the web root
  // (webpack publicPath "/"). Both precompressed by the build (.br/.gz next to each file).
  const client = path.join(config.distDir, 'client');
  const scratch = path.join(config.distDir, 'scratch');
  if (fs.existsSync(client)) {
    app.use(
      '/*',
      serveStatic({
        root: client,
        precompressed: true,
        // Vite's file names under /assets contain a content hash; the HTML must always be fresh
        onFound: (filePath, c) =>
          c.header('Cache-Control', filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'),
      }),
    );
    app.use(
      '/*',
      serveStatic({
        root: scratch,
        precompressed: true,
        // file names don't change within one Scratch version; a day is plenty for the event
        onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=86400'),
      }),
    );
  }
  return app;
};
