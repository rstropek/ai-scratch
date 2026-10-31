import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // the Docker image runs .next/standalone; tracing starts at the workspace root, where npm hoists the packages
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // the server migrates on start (instrumentation.ts) and finds the migrations at the same relative place
  outputFileTracingIncludes: { '/*': ['../../packages/db/drizzle/**/*'] },
  // @ai-scratch/db ships TypeScript source
  transpilePackages: ['@ai-scratch/db'],
  // loaded from node_modules, not bundled: MSAL inside it requires modules dynamically
  serverExternalPackages: ['@azure/identity'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
