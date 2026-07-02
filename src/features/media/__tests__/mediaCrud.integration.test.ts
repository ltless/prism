import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import crypto from 'crypto';
import { createTestDb } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';

let testDb: ReturnType<typeof createTestDb>;

beforeEach(() => {
  testDb = createTestDb();
});

afterAll(() => { testDb?.cleanup(); });

describe('Media CRUD integration', () => {
  it('inserts and queries media', () => {
    const id = crypto.randomUUID();
    testDb.db.insert(schema.media).values({
      id, title: 'test.jpg', filePath: 'media/test.jpg',
      mimeType: 'image/jpeg', size: 1000, hash: 'abc123',
      createdAt: new Date(),
    }).run();

    const items = testDb.db.select().from(schema.media).all();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('test.jpg');
  });

  it('lists non-trashed media only', () => {
    testDb.db.insert(schema.media).values([
      { id: '1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', isTrash: false, createdAt: new Date() },
      { id: '2', title: 'b.jpg', filePath: 'b.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b', isTrash: true, createdAt: new Date() },
      { id: '3', title: 'c.jpg', filePath: 'c.jpg', mimeType: 'image/jpeg', size: 100, hash: 'c', isTrash: false, createdAt: new Date() },
    ]).run();

    const active = testDb.db.select().from(schema.media).where(eq(schema.media.isTrash, false)).all();
    expect(active).toHaveLength(2);
  });

  it('toggles favorite', () => {
    testDb.db.insert(schema.media).values({
      id: '1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', createdAt: new Date(),
    }).run();

    testDb.db.update(schema.media).set({ isFavorite: true }).where(eq(schema.media.id, '1')).run();
    const fav = testDb.db.select().from(schema.media).where(eq(schema.media.isFavorite, true)).all();
    expect(fav).toHaveLength(1);

    testDb.db.update(schema.media).set({ isFavorite: false }).where(eq(schema.media.id, '1')).run();
    const unfav = testDb.db.select().from(schema.media).where(eq(schema.media.isFavorite, true)).all();
    expect(unfav).toHaveLength(0);
  });
});
