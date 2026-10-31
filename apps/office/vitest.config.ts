import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['lib/**/*.test.ts'],
          exclude: [...configDefaults.exclude],
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['app/**/*.test.tsx'],
          setupFiles: ['test/setup-dom.ts'],
        },
      },
    ],
  },
});
