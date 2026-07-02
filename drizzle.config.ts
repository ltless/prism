import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/services/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './prism.db',
  },
});
