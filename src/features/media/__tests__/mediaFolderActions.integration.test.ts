import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';

let testDb: ReturnType<typeof createTestDb>;

beforeEach(() => {
  testDb = createTestDb();
});

afterAll(() => { testDb?.cleanup(); });

describe('Folder operations integration', () => {
  it('creates and queries a folder', () => {
    testDb.db.insert(schema.folders).values({
      id: 'f1', name: 'Test Folder', color: '#ff0000', folderType: 'manual',
    }).run();

    const folders = testDb.db.select().from(schema.folders).all();
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('Test Folder');
    expect(folders[0].color).toBe('#ff0000');
  });

  it('moves media to folder', () => {
    testDb.db.insert(schema.media).values({
      id: 'm1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', createdAt: new Date(),
    }).run();
    testDb.db.insert(schema.folders).values({ id: 'f1', name: 'My Folder', folderType: 'manual' }).run();

    testDb.db.update(schema.media).set({ folderId: 'f1' }).where(eq(schema.media.id, 'm1')).run();

    const inFolder = testDb.db.select().from(schema.media).where(eq(schema.media.folderId, 'f1')).all();
    expect(inFolder).toHaveLength(1);
  });

  it('smart folder query filters by tag category + min score', () => {
    testDb.db.insert(schema.media).values([
      { id: 'm1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', createdAt: new Date() },
      { id: 'm2', title: 'b.jpg', filePath: 'b.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b', createdAt: new Date() },
      { id: 'm3', title: 'c.jpg', filePath: 'c.jpg', mimeType: 'image/jpeg', size: 100, hash: 'c', createdAt: new Date() },
    ]).run();

    testDb.db.insert(schema.mediaTags).values([
      { mediaId: 'm1', tag: 'sunset', score: 0.95, category: 'Sky & Light' },
      { mediaId: 'm2', tag: 'cloud', score: 0.80, category: 'Sky & Light' },
      { mediaId: 'm3', tag: 'dog', score: 0.99, category: 'Animals' },
    ]).run();

    const smartIds = testDb.db.select({ mediaId: schema.mediaTags.mediaId })
      .from(schema.mediaTags)
      .where(
        and(
          inArray(schema.mediaTags.category, ['Sky & Light']),
          gte(schema.mediaTags.score, 0.85)
        )
      ).all();
    expect(smartIds).toHaveLength(1);
    expect(smartIds[0].mediaId).toBe('m1');
  });
});
