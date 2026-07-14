import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, seedTestUser } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  testDb = await createTestDb();
  await seedTestUser(testDb.db, 'u1');
});

afterAll(async () => { await testDb?.cleanup(); });

describe('Media CRUD integration', () => {
  it('inserts and queries media', async () => {
    const id = crypto.randomUUID();
    await testDb.db.insert(schema.media).values({
      id, title: 'test.jpg', filePath: 'media/test.jpg',
      mimeType: 'image/jpeg', size: 1000, hash: 'abc123',
      userId: 'u1',
    });

    const items = await testDb.db.select().from(schema.media);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('test.jpg');
  });

  it('lists non-trashed media only', async () => {
    await testDb.db.insert(schema.media).values([
      { id: '1', userId: 'u1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', isTrash: false },
      { id: '2', userId: 'u1', title: 'b.jpg', filePath: 'b.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b', isTrash: true },
      { id: '3', userId: 'u1', title: 'c.jpg', filePath: 'c.jpg', mimeType: 'image/jpeg', size: 100, hash: 'c', isTrash: false },
    ]);

    const active = await testDb.db.select().from(schema.media).where(eq(schema.media.isTrash, false));
    expect(active).toHaveLength(2);
  });

  it('toggles favorite', async () => {
    await testDb.db.insert(schema.media).values({
      id: '1', userId: 'u1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a',
    });

    await testDb.db.update(schema.media).set({ isFavorite: true }).where(eq(schema.media.id, '1'));
    const fav = await testDb.db.select().from(schema.media).where(eq(schema.media.isFavorite, true));
    expect(fav).toHaveLength(1);

    await testDb.db.update(schema.media).set({ isFavorite: false }).where(eq(schema.media.id, '1'));
    const unfav = await testDb.db.select().from(schema.media).where(eq(schema.media.isFavorite, true));
    expect(unfav).toHaveLength(0);
  });
});
