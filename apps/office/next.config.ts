import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // the Docker image runs .next/standalone; tracing starts at the workspace root, where npm hoists the packages
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
};

export default nextConfig;
