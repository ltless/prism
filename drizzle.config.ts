import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/services/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://prism:prism_dev_2024@localhost:5432/prism',
  },
});
