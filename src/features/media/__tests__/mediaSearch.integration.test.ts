import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, seedTestUser } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { ilike } from 'drizzle-orm';

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  testDb = await createTestDb();
  await seedTestUser(testDb.db, 'u1');
  await testDb.db.insert(schema.media).values([
    { id: '1', userId: 'u1', title: 'sunset_beach.jpg', filePath: '1.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a' },
    { id: '2', userId: 'u1', title: 'mountain_view.jpg', filePath: '2.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b' },
    { id: '3', userId: 'u1', title: 'beach_party.png', filePath: '3.png', mimeType: 'image/png', size: 100, hash: 'c' },
  ]);
});

afterAll(async () => { await testDb?.cleanup(); });

describe('Media search', () => {
  it('finds by title substring', async () => {
    const results = await testDb.db.select().from(schema.media)
      .where(ilike(schema.media.title, '%beach%'));
    expect(results).toHaveLength(2);
  });

  it('finds by extension', async () => {
    const results = await testDb.db.select().from(schema.media)
      .where(ilike(schema.media.title, '%.png'));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
  });

  it('returns empty for no match', async () => {
    const results = await testDb.db.select().from(schema.media)
      .where(ilike(schema.media.title, '%nonexistent%'));
    expect(results).toHaveLength(0);
  });
});
