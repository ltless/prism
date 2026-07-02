import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

async function globalSetup() {
  const dbPath = path.resolve(__dirname, '..', 'prism.db');
  const sqlite = new Database(dbPath);

  const existing = sqlite.prepare('SELECT id FROM users WHERE username = ?').get('e2euser') as { id: string } | undefined;
  if (existing) {
    // Clean up previous E2E run — remove user data for fresh state
    sqlite.prepare('DELETE FROM media_tags WHERE media_id IN (SELECT id FROM media WHERE id IN (SELECT id FROM users WHERE username = ?))').run('e2euser');
    sqlite.prepare('DELETE FROM media WHERE id IN (SELECT id FROM users WHERE username = ?)').run('e2euser');
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  }

  const hash = bcrypt.hashSync('testpass123', 10);
  const id = crypto.randomUUID();
  sqlite.prepare(`
    INSERT INTO users (id, username, password_hash, role, has_completed_setup, created_at)
    VALUES (?, ?, ?, 'user', 1, unixepoch())
  `).run(id, 'e2euser', hash);
  console.log('  Seeded e2euser');

  sqlite.close();
}

export default globalSetup;
