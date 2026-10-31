import { fileURLToPath } from 'node:url';

/** drizzle-kit's output, for code that runs from the repo (scripts, tests); the office's image sets MIGRATIONS_DIR */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url));
