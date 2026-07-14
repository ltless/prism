import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

async function globalSetup() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://prism:prism_dev_2024@localhost:5432/prism';
  const pool = new Pool({ connectionString });

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['e2euser']);
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    // Clean up previous E2E run — remove user data for fresh state
    await pool.query('DELETE FROM media_tags WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM media WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM folders WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  const hash = bcrypt.hashSync('testpass123', 10);
  const id = crypto.randomUUID();
  await pool.query(`
    INSERT INTO users (id, username, password_hash, role, has_completed_setup)
    VALUES ($1, $2, $3, 'user', true)
  `, [id, 'e2euser', hash]);
  console.log('  Seeded e2euser');

  await pool.end();
}

export default globalSetup;
