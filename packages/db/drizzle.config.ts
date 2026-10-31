import { defineConfig } from 'drizzle-kit';

// `npm run generate` diffs the schema against drizzle/ and writes the next migration; it never connects
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
});
