// Server entry point: `node src/server/main.ts` (Node runs the TypeScript directly).

import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { azureUpload, createBlobLogSink } from './blob-log.ts';
import { loadConfig, loadDotEnv } from './config.ts';
import { blobStore, dirStore } from './live.ts';
import { createFileLogSink } from './wire-log.ts';

loadDotEnv();
const config = loadConfig();
const files = createFileLogSink(config.logDir);
const blobs = config.logBlobUrl ? createBlobLogSink(azureUpload(config.logBlobUrl), files) : undefined;
// TEMPORARY: the teacher page's data, from Blob on Azure, from live/ locally
const liveBlobUrl = process.env.LIVE_BLOB_URL?.trim();
const live = liveBlobUrl ? blobStore(liveBlobUrl) : fs.existsSync('live') ? dirStore('live') : undefined;
const app = createApp({ config, sink: blobs ?? files, live });

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(
    `Digiferien KI-Scratch on http://localhost:${port}, research log in ${config.logBlobUrl ?? config.logDir}`,
  );
});

// App Service stops the container with SIGTERM (restart, swap): finish the running log uploads first
process.on('SIGTERM', () => {
  setTimeout(() => process.exit(0), 10_000).unref();
  void (blobs?.flush() ?? Promise.resolve()).then(() => process.exit(0));
});
