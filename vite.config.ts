import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const SERVER_PORT = Number(process.env.PORT ?? 3000);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/client', import.meta.url)) } },
  // The unmodified Scratch standalone build expects its chunks/static files at the web root
  // (webpack publicPath "/"). In dev Vite serves them from node_modules; the production build
  // copies and precompresses them separately (scripts/prepare-scratch.ts).
  publicDir: 'node_modules/@scratch/scratch-gui/dist',
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': `http://localhost:${SERVER_PORT}` },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        editor: fileURLToPath(new URL('./editor.html', import.meta.url)),
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/shared/**/*.test.ts',
            'src/server/**/*.test.ts',
            'src/client/**/*.test.ts',
            'src/editor/**/*.test.ts',
          ],
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/client/**/*.test.tsx'],
          setupFiles: ['test/support/setup-dom.ts'],
        },
      },
    ],
  },
});
