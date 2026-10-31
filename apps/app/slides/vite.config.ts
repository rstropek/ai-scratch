import { defineConfig } from 'vite';

export default defineConfig({
  // the deck is built into the app's dist/slides, outside this folder: clear it explicitly (Vite only warns otherwise)
  build: { emptyOutDir: true },
});
