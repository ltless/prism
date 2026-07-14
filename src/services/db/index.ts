import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getDatabaseUrl } from '@/core/utils/paths';

const pool = new Pool({ connectionString: getDatabaseUrl() });
export const db = drizzle(pool, { schema });

// Run migrations on startup (Go backend handles schema creation via embedded
// postgres.sql — this is a safety net for dev/Next-only contexts).
export { pool };
