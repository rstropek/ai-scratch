// The Hono app: API routes + static files. Kept free of side effects so tests can call app.request().
import fs from 'node:fs';
import path from 'node:path';
import type { IdentityTokenProvider } from '@ai-scratch/anthropic';
import { createKeyBox, type Database } from '@ai-scratch/db';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { ASK_PATH } from '../shared/ki-block.ts';
import { LIVE_PATH } from '../shared/live.ts';
import { type AppEnv, accessInfo, createRefusedKeys, requireBudget, requireCode, testOnly } from './access.ts';
import { createAskHandler } from './ask.ts';
import { createBudget } from './budget.ts';
import { createChatHandler } from './chat.ts';
import { createCompactHandler } from './compact.ts';
import type { Config } from './config.ts';
import { createHearts } from './hearts.ts';
import { addLockerRoutes } from './locker.ts';
import { createModels } from './model.ts';
import { createStats } from './stats.ts';
import { createWarnings, logMail, type SendMail } from './warnings.ts';
import type { LogSink } from './wire-log.ts';

export interface AppDeps {
  config: Config;
  sink: LogSink;
  /** the fetch for Anthropic, OpenRouter and Jev (tests pass a fake) */
  fetch?: typeof fetch;
  /** the office's codes, the pool and the usage; required with `config.database` */
  db?: Database;
  /** our Azure identity's token, for federated pool entries */
  identityToken?: IdentityTokenProvider;
  /** the 80 % warnings to the admins */
  sendMail?: SendMail;
}

export const createApp = ({ config, sink, fetch, db, identityToken, sendMail = logMail }: AppDeps): Hono<AppEnv> => {
  if (config.database && !db) throw new Error('createApp: the config names a database, but none was passed');
  const stats = createStats();
  const box = config.keyEncryptionKey && createKeyBox(config.keyEncryptionKey);
  const budget = db && createBudget({ db, limits: config.limits, onRefresh: createWarnings({ db, send: sendMail }) });
  const refusedKeys = createRefusedKeys();
  const models = createModels({
    config,
    box,
    identityToken,
    baseFetch: fetch,
    entryOf: (id) => budget?.entryOf(id),
    refuse: (id, reason) => budget?.refuse(id, reason),
  });
  const deps = { config, sink, stats, hearts: createHearts(), budget, refusedKeys, models, fetch };
  const app = new Hono<AppEnv>();

  // for the deploy workflow and App Service: which commit is running, no access code needed
  app.get('/healthz', (c) => c.json({ version: config.version }));
  // the Locker works without a code, always: registered before the code check, so it never runs for these routes
  addLockerRoutes(app, deps);
  app.use('/api/*', requireCode(config.testCodes, budget, stats));
  // the code's budgets wherever the model is called, and for the gate's check
  const withBudget = requireBudget(budget, refusedKeys);
  app.get('/api/access', withBudget, accessInfo);
  app.post('/api/chat', withBudget, createChatHandler(deps));
  app.post('/api/compact', withBudget, createCompactHandler(deps));
  app.post(ASK_PATH, withBudget, createAskHandler(deps));
  app.get('/api/stats', testOnly, (c) => c.json(stats));
  app.all('/api/*', (c) => c.json({ error: 'Nicht gefunden' }, 404));

  // The slide deck for the video tutorial (slides/, built with base /slides/), public like the editor.
  // Slidev routes in the browser (/slides/11, /slides/presenter/3), so a path without a file extension
  // gets the deck's page; a missing file stays a 404.
  const slides = path.join(config.distDir, 'slides');
  if (fs.existsSync(slides)) {
    app.get('/slides', (c) => c.redirect('/slides/'));
    // set on the finished response: onFound's c.header() only reaches it under @hono/node-server's own Response
    app.use('/slides/*', async (c, next) => {
      await next();
      if (c.res.ok) {
        const immutable = c.req.path.startsWith('/slides/assets/');
        c.res.headers.set('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      }
    });
    app.use('/slides/*', serveStatic({ root: config.distDir, precompressed: true }));
    const deckPage = serveStatic({ root: slides, path: 'index.html', precompressed: true });
    app.get('/slides/*', (c, next) => (path.extname(c.req.path) ? next() : deckPage(c, next)));
  }

  // Production: the built host app, then the unmodified Scratch bundle, which must sit at the web root
  // (webpack publicPath "/"). Both precompressed by the build (.br/.gz next to each file).
  const client = path.join(config.distDir, 'client');
  const scratch = path.join(config.distDir, 'scratch');
  if (fs.existsSync(client)) {
    // the video page keeps the address that went out to the schools (in dev, Vite maps it the same way)
    app.get(
      LIVE_PATH,
      serveStatic({
        root: client,
        path: 'live.html',
        precompressed: true,
        onFound: (_path, c) => c.header('Cache-Control', 'no-cache'),
      }),
    );
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
